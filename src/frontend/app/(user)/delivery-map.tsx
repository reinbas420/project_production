import locationService from "@/api/services/locationService";
import { Colors, Radius, Spacing, Typography } from "@/constants/theme";
import useAppStore from "@/store/useAppStore";
import * as Location from "expo-location";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Keyboard,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import MapView, { Circle, Marker } from "react-native-maps";
import { SafeAreaView } from "react-native-safe-area-context";

// Default region (Hyderabad) — overridden once GPS resolves
const DEFAULT_REGION = {
  latitude: 17.385,
  longitude: 78.4867,
  latitudeDelta: 0.04,
  longitudeDelta: 0.04,
};

const LIBRARY_RADIUS_METERS = 8000; // 8 km

interface LibraryBranch {
  _id: string;
  name: string;
  address: string;
  location?: { type: string; coordinates: number[] };
  serviceRadiusKm?: number;
}

interface NominatimResult {
  display_name: string;
  lat: string;
  lon: string;
}

export default function DeliveryMapScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ next?: string }>();
  const { userId, setHasDeliveryAddress } = useAppStore();
  const mapRef = useRef<MapView>(null);

  // If ?next=select-profile, this is the post-signup / post-login flow
  const isOnboarding = params.next === "select-profile";
  const fromAddressSelect = params.next === "select-address";

  const [region, setRegion] = useState(DEFAULT_REGION);
  const [address, setAddress] = useState("Fetching address…");
  const [saving, setSaving] = useState(false);
  const [locationReady, setLocationReady] = useState(false);
  // Structured geocode fields — stored separately so we don't
  // have to re-split the display string (which causes comma bugs).
  const [geoFields, setGeoFields] = useState({
    street: "",
    city: "",
    state: "",
    pincode: "",
  });
  // Library branches for markers + circles
  const [libraries, setLibraries] = useState<LibraryBranch[]>([]);

  // Nominatim search state
  const [searchText, setSearchText] = useState("");
  const [searchResults, setSearchResults] = useState<NominatimResult[]>([]);
  const [searching, setSearching] = useState(false);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ───────────────────────────────────────────────────────
  //  1. Request permission & jump to user's GPS location
  // ───────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission required",
          "Location permission is needed to set your delivery address.",
        );
        setLocationReady(true);
        return;
      }

      try {
        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });

        const newRegion = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          latitudeDelta: 0.04,
          longitudeDelta: 0.04,
        };

        setRegion(newRegion);
        getAddressFromCoordinates(pos.coords.latitude, pos.coords.longitude);

        // Animate map to the user's position
        mapRef.current?.animateToRegion(newRegion, 600);
      } catch {
        Alert.alert("Error", "Could not fetch your current location.");
      } finally {
        setLocationReady(true);
      }
    })();
  }, []);

  // ───────────────────────────────────────────────────────
  //  2. Fetch all library branches for map overlays
  // ───────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const res = await locationService.getAllLibraries();
        if (res?.data?.libraries) {
          setLibraries(res.data.libraries);
        }
      } catch (err) {
        console.warn("Could not load library branches for map", err);
      }
    })();
  }, []);

  // ───────────────────────────────────────────────────────
  //  3. Reverse geocode coordinates → readable address
  // ───────────────────────────────────────────────────────

  /** Strip trailing/leading commas and whitespace from a geocoded field. */
  const clean = (s?: string | null): string =>
    (s || "").replace(/^[,\s]+|[,\s]+$/g, "").trim();

  const getAddressFromCoordinates = async (
    latitude: number,
    longitude: number,
  ) => {
    try {
      const geocodeArray = await Location.reverseGeocodeAsync({
        latitude,
        longitude,
      });
      if (geocodeArray.length > 0) {
        const p = geocodeArray[0];

        // Clean every field individually
        const street = clean(p.street) || clean(p.name);
        const city = clean(p.city) || clean(p.subregion);
        const state = clean(p.region);
        const pincode = clean(p.postalCode);

        setGeoFields({ street, city, state, pincode });

        const parts = [street, city, state, pincode].filter(Boolean);
        setAddress(parts.join(", ") || "Unknown location");
      }
    } catch {
      setAddress("Could not fetch address");
    }
  };

  // ───────────────────────────────────────────────────────
  //  4. Called every time the user stops dragging the map
  // ───────────────────────────────────────────────────────
  const handleRegionChangeComplete = (newRegion: typeof DEFAULT_REGION) => {
    setRegion(newRegion);
    getAddressFromCoordinates(newRegion.latitude, newRegion.longitude);
  };

  // ───────────────────────────────────────────────────────
  //  5. Nominatim search (debounced)
  // ───────────────────────────────────────────────────────
  const handleSearchChange = useCallback((text: string) => {
    setSearchText(text);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);

    if (text.length < 3) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    searchTimeout.current = setTimeout(async () => {
      const results = await locationService.searchNominatim(text);
      setSearchResults(results);
      setSearching(false);
    }, 500); // 500ms debounce to respect Nominatim rate limits
  }, []);

  const selectSearchResult = (result: NominatimResult) => {
    const lat = parseFloat(result.lat);
    const lng = parseFloat(result.lon);

    const newRegion = {
      latitude: lat,
      longitude: lng,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    };

    setRegion(newRegion);
    mapRef.current?.animateToRegion(newRegion, 800);
    getAddressFromCoordinates(lat, lng);

    // Clear search
    setSearchText("");
    setSearchResults([]);
    Keyboard.dismiss();
  };

  // ───────────────────────────────────────────────────────
  //  6. Confirm & send to backend
  // ───────────────────────────────────────────────────────
  const confirmLocation = async () => {
    if (!userId) {
      Alert.alert("Error", "You must be logged in to set a delivery address.");
      return;
    }

    setSaving(true);
    try {
      // Use the structured geocode fields directly — never re-split
      // the display string, which breaks when fields contain commas.
      await locationService.updateDeliveryLocation(userId, {
        latitude: region.latitude,
        longitude: region.longitude,
        street: geoFields.street,
        city: geoFields.city,
        state: geoFields.state,
        pincode: geoFields.pincode,
        label: geoFields.city || geoFields.street || "Home",
      });

      // Mark that the user now has a delivery address
      setHasDeliveryAddress(true);

      Alert.alert("Success", "Delivery location saved!", [
        {
          text: "OK",
          onPress: () => {
            if (isOnboarding) {
              router.replace("/(select-profile)");
            } else if (fromAddressSelect) {
              // Came from the address-selection screen after login — go home
              router.replace("/(user)");
            } else {
              router.back();
            }
          },
        },
      ]);
    } catch (err: any) {
      const msg =
        err.response?.data?.message || "Failed to save location. Try again.";
      Alert.alert("Error", msg);
    } finally {
      setSaving(false);
    }
  };

  // ───────────────────────────────────────────────────────
  //  Render
  // ───────────────────────────────────────────────────────
  if (!locationReady) {
    return (
      <SafeAreaView style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={Colors.accentSage} />
        <Text style={styles.loadingText}>Getting your location…</Text>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      {/* ── Map with library markers + circles ──────── */}
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={region}
        onRegionChangeComplete={handleRegionChangeComplete}
        showsUserLocation
        showsMyLocationButton={Platform.OS === "android"}
      >
        {/* Library branch markers + 8 km delivery circles */}
        {libraries
          .filter((lib) => lib.location?.coordinates?.length === 2)
          .map((lib) => {
            const [lng, lat] = lib.location!.coordinates;
            const radiusKm = lib.serviceRadiusKm || 8;
            return (
              <React.Fragment key={lib._id}>
                <Marker
                  coordinate={{ latitude: lat, longitude: lng }}
                  title={lib.name}
                  description={lib.address}
                  pinColor="#4A7C59"
                />
                <Circle
                  center={{ latitude: lat, longitude: lng }}
                  radius={radiusKm * 1000}
                  strokeColor="rgba(74, 124, 89, 0.6)"
                  fillColor="rgba(74, 124, 89, 0.1)"
                  strokeWidth={2}
                />
              </React.Fragment>
            );
          })}
      </MapView>

      {/* ── Fixed pin in the dead center ──────────────── */}
      <View style={styles.fixedMarker} pointerEvents="none">
        <Text style={styles.pinEmoji}>📍</Text>
      </View>

      {/* ── Back / Skip button ─────────────────────────── */}
      <TouchableOpacity
        style={styles.backBtn}
        onPress={() => {
          if (isOnboarding) {
            router.replace("/(select-profile)");
          } else if (fromAddressSelect) {
            router.back();
          } else {
            router.back();
          }
        }}
      >
        <Text style={styles.backText}>
          {isOnboarding ? "Skip for now →" : "← Back"}
        </Text>
      </TouchableOpacity>

      {/* ── Search bar (Nominatim) ─────────────────────── */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search for a location…"
            placeholderTextColor={Colors.textMuted}
            value={searchText}
            onChangeText={handleSearchChange}
            returnKeyType="search"
          />
          {searching && (
            <ActivityIndicator
              size="small"
              color={Colors.accentSage}
              style={{ marginRight: 8 }}
            />
          )}
          {searchText.length > 0 && !searching && (
            <TouchableOpacity
              onPress={() => {
                setSearchText("");
                setSearchResults([]);
              }}
              style={{ padding: 4, marginRight: 4 }}
            >
              <Text style={{ fontSize: 16, color: Colors.textMuted }}>✕</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Search results dropdown */}
        {searchResults.length > 0 && (
          <View style={styles.searchDropdown}>
            <FlatList
              data={searchResults}
              keyExtractor={(item, idx) => `${item.lat}-${item.lon}-${idx}`}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.searchResultItem}
                  onPress={() => selectSearchResult(item)}
                >
                  <Text style={styles.searchResultIcon}>📍</Text>
                  <Text style={styles.searchResultText} numberOfLines={2}>
                    {item.display_name}
                  </Text>
                </TouchableOpacity>
              )}
            />
          </View>
        )}
      </View>

      {/* ── Bottom panel ──────────────────────────────── */}
      <View style={styles.footer}>
        <Text style={styles.addressLabel}>Delivery Address</Text>
        <Text style={styles.addressText} numberOfLines={2}>
          {address}
        </Text>

        <TouchableOpacity
          style={[styles.confirmBtn, saving && styles.confirmBtnDisabled]}
          onPress={confirmLocation}
          disabled={saving}
          activeOpacity={0.8}
        >
          {saving ? (
            <ActivityIndicator color={Colors.buttonPrimaryText} />
          ) : (
            <Text style={styles.confirmText}>Confirm Delivery Location</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  centered: { justifyContent: "center", alignItems: "center" },
  map: { flex: 1 },

  // Fixed pin
  fixedMarker: {
    position: "absolute",
    top: "50%",
    left: "50%",
    marginLeft: -20,
    marginTop: -40,
  },
  pinEmoji: { fontSize: 40 },

  // Back button
  backBtn: {
    position: "absolute",
    top: Platform.OS === "ios" ? 56 : 40,
    left: Spacing.md,
    backgroundColor: Colors.card,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.sm,
    elevation: 3,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  backText: {
    fontSize: Typography.label,
    fontWeight: "600",
    color: Colors.accentSage,
  },

  // Search bar
  searchContainer: {
    position: "absolute",
    top: Platform.OS === "ios" ? 56 : 40,
    left: 100,
    right: Spacing.md,
    zIndex: 10,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.card,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.sm,
    elevation: 4,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  searchIcon: { fontSize: 16, marginRight: 6 },
  searchInput: {
    flex: 1,
    height: 42,
    fontSize: Typography.label,
    color: Colors.textPrimary,
  },
  searchDropdown: {
    backgroundColor: Colors.card,
    borderRadius: Radius.md,
    marginTop: 4,
    maxHeight: 200,
    elevation: 6,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    overflow: "hidden",
  },
  searchResultItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.cardBorder,
  },
  searchResultIcon: { fontSize: 14, marginRight: 8 },
  searchResultText: {
    flex: 1,
    fontSize: Typography.label,
    color: Colors.textPrimary,
    lineHeight: 18,
  },

  // Footer panel
  footer: {
    position: "absolute",
    bottom: 0,
    width: "100%",
    backgroundColor: Colors.card,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xl,
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
    elevation: 8,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: -4 },
  },
  addressLabel: {
    fontSize: Typography.label,
    fontWeight: "700",
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
  },
  addressText: {
    fontSize: Typography.body,
    color: Colors.textSecondary,
    marginBottom: Spacing.lg,
  },
  confirmBtn: {
    backgroundColor: Colors.buttonPrimary,
    paddingVertical: 14,
    borderRadius: Radius.md,
    alignItems: "center",
  },
  confirmBtnDisabled: { opacity: 0.6 },
  confirmText: {
    fontSize: Typography.body,
    fontWeight: "700",
    color: Colors.buttonPrimaryText,
  },

  loadingText: {
    marginTop: Spacing.md,
    fontSize: Typography.body,
    color: Colors.textSecondary,
  },
});
