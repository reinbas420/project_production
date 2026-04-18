/**
 * LeafletDeliveryMap.tsx
 * Contains all react-leaflet / leaflet imports.
 * MUST only be loaded dynamically (via React.lazy) to avoid
 * "window is not defined" during Metro's server-side pre-pass.
 */
import locationService from "@/api/services/locationService";
import { Colors, Radius, Spacing, Typography } from "@/constants/theme";
import useAppStore from "@/store/useAppStore";
import { useLocalSearchParams, useRouter } from "expo-router";
import L from "leaflet";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { Circle, MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";

const DEFAULT_CENTER: [number, number] = [17.385, 78.4867];

interface LibraryBranch {
    _id: string;
    name: string;
    location?: { coordinates: number[] };
    serviceRadiusKm?: number;
}

interface NominatimResult {
    display_name: string;
    lat: string;
    lon: string;
}

// Emoji marker — avoids broken default Leaflet marker images with Metro bundler
const makeLibraryIcon = () =>
    L.divIcon({
        html: '<span style="font-size:26px;line-height:1;filter:drop-shadow(0 2px 4px rgba(0,0,0,.35))">📚</span>',
        className: "",
        iconSize: [32, 32],
        iconAnchor: [16, 16],
    });

// ── Inner helpers (rendered inside <MapContainer>) ────────────────────────────
function MapEventHandler({ onMoveEnd }: { onMoveEnd: (lat: number, lng: number) => void }) {
    useMapEvents({
        moveend(e) {
            const c = e.target.getCenter();
            onMoveEnd(c.lat, c.lng);
        },
    });
    return null;
}

function PanController({ target }: { target: [number, number] | null }) {
    const map = useMap();
    const prevKey = useRef("");
    useEffect(() => {
        if (!target) return;
        const key = target.join(",");
        if (key === prevKey.current) return;
        prevKey.current = key;
        map.flyTo(target, 16, { duration: 0.8 });
    }, [target, map]);
    return null;
}

// ── Main export ───────────────────────────────────────────────────────────────
export default function LeafletDeliveryMap() {
    const router = useRouter();
    const params = useLocalSearchParams<{ next?: string }>();
    const { userId, setHasDeliveryAddress } = useAppStore();

    const isOnboarding = params.next === "select-profile";
    const fromAddressSelect = params.next === "select-address";

    const [cssReady, setCssReady] = useState(false);
    const [center, setCenter] = useState<[number, number]>(DEFAULT_CENTER);
    const [flyTarget, setFlyTarget] = useState<[number, number] | null>(null);
    const [address, setAddress] = useState("Move the map to set your location…");
    const [geoFields, setGeoFields] = useState({ street: "", city: "", state: "", pincode: "" });
    const [saving, setSaving] = useState(false);
    const [libraries, setLibraries] = useState<LibraryBranch[]>([]);
    const libraryIcon = useRef(makeLibraryIcon());

    const [searchText, setSearchText] = useState("");
    const [searchResults, setSearchResults] = useState<NominatimResult[]>([]);
    const [searching, setSearching] = useState(false);
    const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

    // ── Inject Leaflet CSS (Metro can't bundle .css files) ───────────────────
    useEffect(() => {
        if (document.getElementById("leaflet-css")) { setCssReady(true); return; }
        const link = document.createElement("link");
        link.id = "leaflet-css";
        link.rel = "stylesheet";
        link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
        link.integrity = "sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=";
        link.crossOrigin = "";
        link.onload = () => setCssReady(true);
        document.head.appendChild(link);
    }, []);

    // ── Fetch library branches ────────────────────────────────────────────────
    useEffect(() => {
        (async () => {
            try {
                const res = await locationService.getAllLibraries();
                if (res?.data?.libraries) setLibraries(res.data.libraries);
            } catch (e) {
                console.warn("Could not load library branches", e);
            }
        })();
    }, []);

    // ── Browser GPS ──────────────────────────────────────────────────────────
    useEffect(() => {
        if (!navigator?.geolocation) return;
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const c: [number, number] = [pos.coords.latitude, pos.coords.longitude];
                setCenter(c);
                setFlyTarget(c);
                reverseGeocode(c[0], c[1]);
            },
            () => {},
            { timeout: 8000 },
        );
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ── Reverse geocode via Nominatim ─────────────────────────────────────────
    const clean = (s?: string | null) => (s ?? "").replace(/^[,\s]+|[,\s]+$/g, "").trim();

    const reverseGeocode = useCallback(async (lat: number, lng: number) => {
        try {
            const res = await fetch(
                `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
                { headers: { "User-Agent": "HyperLocalCloudLibrary/1.0" } },
            );
            const data = await res.json();
            const a = data.address ?? {};
            const street = clean(a.road || a.pedestrian || a.footway || a.path);
            const city = clean(a.city || a.town || a.village || a.county);
            const state = clean(a.state);
            const pincode = clean(a.postcode);
            setGeoFields({ street, city, state, pincode });
            setAddress(
                [street, city, state, pincode].filter(Boolean).join(", ") ||
                data.display_name ||
                "Unknown location",
            );
        } catch {
            setAddress("Could not fetch address");
        }
    }, []);

    const handleMoveEnd = useCallback((lat: number, lng: number) => {
        setCenter([lat, lng]);
        reverseGeocode(lat, lng);
    }, [reverseGeocode]);

    // ── Nominatim search (debounced 500 ms) ───────────────────────────────────
    const handleSearchChange = (text: string) => {
        setSearchText(text);
        if (searchTimeout.current) clearTimeout(searchTimeout.current);
        if (text.length < 3) { setSearchResults([]); return; }
        setSearching(true);
        searchTimeout.current = setTimeout(async () => {
            try {
                const results = await locationService.searchNominatim(text);
                setSearchResults(results);
            } catch { setSearchResults([]); }
            setSearching(false);
        }, 500);
    };

    const selectResult = (result: NominatimResult) => {
        const lat = parseFloat(result.lat);
        const lng = parseFloat(result.lon);
        const c: [number, number] = [lat, lng];
        setCenter(c);
        setFlyTarget(c);
        reverseGeocode(lat, lng);
        setSearchText("");
        setSearchResults([]);
    };

    // ── Save to backend ───────────────────────────────────────────────────────
    const confirmLocation = async () => {
        if (!userId) { alert("You must be logged in."); return; }
        setSaving(true);
        try {
            await locationService.updateDeliveryLocation(userId, {
                latitude: center[0],
                longitude: center[1],
                street: geoFields.street,
                city: geoFields.city,
                state: geoFields.state,
                pincode: geoFields.pincode,
                label: geoFields.city || geoFields.street || "Home",
            });
            setHasDeliveryAddress(true);
            alert("✅ Delivery location saved!");
            if (isOnboarding) router.replace("/(select-profile)");
            else if (fromAddressSelect) router.replace("/(user)");
            else router.back();
        } catch (err: any) {
            alert(err?.response?.data?.message ?? "Failed to save location. Try again.");
        } finally {
            setSaving(false);
        }
    };

    const handleBack = () => {
        if (isOnboarding) router.replace("/(select-profile)");
        else router.back();
    };

    const [locating, setLocating] = useState(false);
    const goToCurrentLocation = () => {
        if (!navigator?.geolocation) { alert("Geolocation is not supported by your browser."); return; }
        setLocating(true);
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const c: [number, number] = [pos.coords.latitude, pos.coords.longitude];
                setCenter(c);
                setFlyTarget(c);
                reverseGeocode(c[0], c[1]);
                setLocating(false);
            },
            () => { alert("Could not get your location. Please allow location access."); setLocating(false); },
            { timeout: 10000 },
        );
    };

    if (!cssReady) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator size="large" color={Colors.accentSage} />
                <Text style={{ color: Colors.textSecondary, marginTop: 12 }}>Loading map…</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {/* ── Leaflet map ───────────────────────────────────────── */}
            <View style={styles.mapWrapper}>
                <MapContainer
                    center={center}
                    zoom={15}
                    style={{ width: "100%", height: "100%" }}
                    zoomControl
                    attributionControl
                >
                    <TileLayer
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                        maxZoom={19}
                    />
                    <MapEventHandler onMoveEnd={handleMoveEnd} />
                    <PanController target={flyTarget} />

                    {libraries
                        .filter((lib) => lib.location?.coordinates?.length === 2)
                        .map((lib) => {
                            const [lng, lat] = lib.location!.coordinates;
                            const radiusM = (lib.serviceRadiusKm ?? 8) * 1000;
                            return (
                                <React.Fragment key={lib._id}>
                                    <Marker position={[lat, lng]} icon={libraryIcon.current} />
                                    <Circle
                                        center={[lat, lng]}
                                        radius={radiusM}
                                        pathOptions={{
                                            color: "rgba(74,124,89,0.7)",
                                            fillColor: "rgba(74,124,89,0.15)",
                                            fillOpacity: 1,
                                            weight: 2,
                                        }}
                                    />
                                </React.Fragment>
                            );
                        })}
                </MapContainer>

                {/* Fixed centre pin */}
                <View style={styles.fixedPin} pointerEvents="none">
                    <Text style={styles.pinEmoji}>📍</Text>
                </View>
            </View>

            {/* ── Back / Skip ───────────────────────────────────────── */}
            <TouchableOpacity style={styles.backBtnOverlay} onPress={handleBack}>
                <Text style={styles.backBtnText}>{isOnboarding ? "Skip for now →" : "← Back"}</Text>
            </TouchableOpacity>

            {/* ── Current Location button ───────────────────────────── */}
            <TouchableOpacity
                style={[styles.locateMeBtn, locating && { opacity: 0.6 }]}
                onPress={goToCurrentLocation}
                disabled={locating}
                activeOpacity={0.8}
            >
                {locating
                    ? <ActivityIndicator size="small" color={Colors.accentSage} />
                    : <Text style={styles.locateMeText}>📡 Current Location</Text>
                }
            </TouchableOpacity>

            {/* ── Search bar ────────────────────────────────────────── */}
            <View style={styles.searchWrapper}>
                <View style={styles.searchBar}>
                    <Text style={styles.searchIcon}>🔍</Text>
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search for a location…"
                        placeholderTextColor={Colors.textMuted}
                        value={searchText}
                        onChangeText={handleSearchChange}
                    />
                    {searching && (
                        <ActivityIndicator size="small" color={Colors.accentSage} style={{ marginRight: 8 }} />
                    )}
                    {searchText.length > 0 && !searching && (
                        <TouchableOpacity
                            onPress={() => { setSearchText(""); setSearchResults([]); }}
                            style={{ padding: 4, marginRight: 4 }}
                        >
                            <Text style={{ fontSize: 16, color: Colors.textMuted }}>✕</Text>
                        </TouchableOpacity>
                    )}
                </View>

                {searchResults.length > 0 && (
                    <ScrollView style={styles.dropdown} keyboardShouldPersistTaps="handled">
                        {searchResults.map((item, idx) => (
                            <TouchableOpacity
                                key={`${item.lat}-${item.lon}-${idx}`}
                                style={styles.dropdownItem}
                                onPress={() => selectResult(item)}
                            >
                                <Text style={{ fontSize: 14, marginRight: 6 }}>📍</Text>
                                <Text style={styles.dropdownText} numberOfLines={2}>
                                    {item.display_name}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                )}
            </View>

            {/* ── Address panel + confirm ───────────────────────────── */}
            <View style={styles.footer}>
                <Text style={styles.addressLabel}>Delivery Address</Text>
                <Text style={styles.addressText} numberOfLines={2}>{address}</Text>

                <TouchableOpacity
                    style={[styles.confirmBtn, saving && { opacity: 0.6 }]}
                    onPress={confirmLocation}
                    disabled={saving}
                    activeOpacity={0.82}
                >
                    {saving
                        ? <ActivityIndicator color={Colors.buttonPrimaryText} />
                        : <Text style={styles.confirmText}>Confirm Delivery Location</Text>
                    }
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background } as any,
    centered: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        padding: Spacing.xl,
        backgroundColor: Colors.background,
    },
    mapWrapper: { flex: 1, position: "relative" as any },

    fixedPin: {
        position: "absolute" as any,
        top: "50%",
        left: "50%",
        marginLeft: -20,
        marginTop: -40,
        zIndex: 1000,
        pointerEvents: "none",
    },
    pinEmoji: { fontSize: 40 },

    backBtnOverlay: {
        position: "absolute" as any,
        top: 20,
        left: Spacing.md,
        zIndex: 2000,
        backgroundColor: Colors.card,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
        borderRadius: Radius.sm,
        shadowColor: "#000",
        shadowOpacity: 0.12,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 2 },
        elevation: 4,
    },
    backBtnText: { fontSize: Typography.label, fontWeight: "700", color: Colors.accentSage },

    locateMeBtn: {
        position: "absolute" as any,
        bottom: 170,
        right: Spacing.md,
        zIndex: 2000,
        backgroundColor: Colors.card,
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: Spacing.md,
        paddingVertical: 10,
        borderRadius: Radius.full,
        shadowColor: "#000",
        shadowOpacity: 0.15,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 2 },
        elevation: 5,
        borderWidth: 1.5,
        borderColor: Colors.accentSage,
    },
    locateMeText: { fontSize: Typography.label, fontWeight: "700", color: Colors.accentSage },

    searchWrapper: {
        position: "absolute" as any,
        top: 16,
        left: 120,
        right: Spacing.md,
        zIndex: 2000,
    },
    searchBar: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: Colors.card,
        borderRadius: Radius.md,
        paddingHorizontal: Spacing.sm,
        shadowColor: "#000",
        shadowOpacity: 0.12,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 2 },
        elevation: 4,
    },
    searchIcon: { fontSize: 16, marginRight: 6 },
    searchInput: {
        flex: 1,
        height: 44,
        fontSize: Typography.label,
        color: Colors.textPrimary,
        outlineStyle: "none",
    } as any,
    dropdown: {
        backgroundColor: Colors.card,
        borderRadius: Radius.md,
        marginTop: 4,
        maxHeight: 220,
        shadowColor: "#000",
        shadowOpacity: 0.1,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 2 },
        elevation: 4,
    },
    dropdownItem: {
        flexDirection: "row",
        alignItems: "flex-start",
        padding: Spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: Colors.cardBorder,
    },
    dropdownText: {
        flex: 1,
        fontSize: Typography.label,
        color: Colors.textPrimary,
        lineHeight: 18,
    },

    footer: {
        position: "absolute" as any,
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: Colors.card,
        padding: Spacing.lg,
        borderTopLeftRadius: Radius.xl,
        borderTopRightRadius: Radius.xl,
        shadowColor: "#000",
        shadowOpacity: 0.15,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: -4 },
        elevation: 10,
        gap: Spacing.sm,
    },
    addressLabel: {
        fontSize: Typography.label,
        fontWeight: "700",
        color: Colors.textSecondary,
        textTransform: "uppercase",
        letterSpacing: 0.8,
    },
    addressText: {
        fontSize: Typography.body,
        fontWeight: "600",
        color: Colors.textPrimary,
        lineHeight: 22,
    },
    confirmBtn: {
        backgroundColor: Colors.buttonPrimary,
        borderRadius: Radius.full,
        paddingVertical: 16,
        alignItems: "center",
        marginTop: Spacing.xs,
    },
    confirmText: {
        fontSize: Typography.body,
        fontWeight: "800",
        color: Colors.buttonPrimaryText,
    },
});
