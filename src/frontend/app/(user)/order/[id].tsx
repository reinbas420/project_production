import bookService from "@/api/services/bookService";
import locationService from "@/api/services/locationService";
import AddressPickerModal from "@/components/AddressPickerModal";
import { BookCover } from "@/components/BookCover";
import { NavBar, NAV_BOTTOM_PAD } from "@/components/NavBar";
import { type Book } from "@/constants/mockData";
import { Colors, Radius, Spacing, Typography } from "@/constants/theme";
import useAppStore from "@/store/useAppStore";
import { useFocusEffect } from "@react-navigation/native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

interface LibraryBranch {
  branchId: string;
  branchName: string;
  distance: number;
  availableCopies: number;
  isWithinReach: boolean;
}

function mapBook(b: any): Book {
  return {
    id: b._id || b.id,
    title: b.title || "Unknown Title",
    author: b.author || "Unknown Author",
    pages: b.pageCount || null,
    releaseYear: new Date(b.createdAt || Date.now()).getFullYear(),
    genres: b.genre || [],
    summary: b.summary || "",
    rating: 4.5,
    coverColor: "#C5DDB8",
    coverAccent: "#4A7C59",
    isDigital: true,
    isPhysical: true,
    availableCopies: parseInt(b.availableCopies ?? 0),
    nearestLibrary: "Local Library",
    ageMin: b.minAge ?? (parseInt(String(b.ageRating || '').split("-")[0]) || 0),
    ageMax: 99,
    keyWords: [],
    coverImage: b.coverImage,
  };
}

const RETURN_PERIODS = ["7 days", "14 days", "21 days"];

export default function OrderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const { activeProfileId, userId } = useAppStore();

  const [book, setBook] = useState<Book | null>(null);
  const [libraries, setLibraries] = useState<LibraryBranch[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedLib, setSelectedLib] = useState<string | null>(null);
  const [returnDays, setReturnDays] = useState("14 days");
  const [step, setStep] = useState<"address" | "select" | "confirm" | "placed">(
    "address",
  );
  const [orderProcessing, setOrderProcessing] = useState(false);
  const [issuedId, setIssuedId] = useState<string | null>(null);

  const [loadingLibraries, setLoadingLibraries] = useState(false);

  const autoSelectNearestLibrary = (nextLibraries: LibraryBranch[]) => {
    if (!Array.isArray(nextLibraries) || nextLibraries.length === 0) {
      setSelectedLib(null);
      return;
    }

    const currentlySelectedExists =
      !!selectedLib && nextLibraries.some((branch) => branch.branchId === selectedLib && branch.isWithinReach);
    if (currentlySelectedExists) {
      return;
    }

    const nearestReachable = nextLibraries.find((branch) => branch.isWithinReach);
    setSelectedLib(nearestReachable ? nearestReachable.branchId : null);
  };

  // Address picker state
  const [showAddressPicker, setShowAddressPicker] = useState(false);
  const [selectedAddress, setSelectedAddress] = useState<any>(null);
  const [savedAddresses, setSavedAddresses] = useState<any[]>([]);
  const [addressLoading, setAddressLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const fetchDetails = async () => {
      try {
        const bookRes = await bookService.getBookById(id as string);
        if (active && bookRes?.data?.book) {
          setBook(mapBook(bookRes.data.book));
        }

        const availRes = await bookService.getBookAvailability(id as string);
        if (active && availRes?.data?.branches) {
          const nextLibraries = availRes.data.branches;
          setLibraries(nextLibraries);
          autoSelectNearestLibrary(nextLibraries);
        }
      } catch (err) {
        console.warn("Failed to load book data for order", err);
      } finally {
        if (active) setLoading(false);
      }
    };
    fetchDetails();
    return () => {
      active = false;
    };
  }, [id]);

  // Track whether this is the initial mount vs returning from map
  const isInitialMount = useRef(true);
  const prevAddressCount = useRef(0);

  // Fetch saved delivery addresses on every screen focus
  useFocusEffect(
    useCallback(() => {
      if (!userId) return;
      let active = true;
      (async () => {
        setAddressLoading(true);
        try {
          const res: any = await locationService.getDeliveryAddresses(userId);
          const addresses = res?.data?.addresses ?? res?.addresses ?? [];
          if (!active) return;
          setSavedAddresses(addresses);

          // Auto-select the default or first address
          const def = addresses.find((a: any) => a.isDefault);
          if (def) setSelectedAddress(def);
          else if (addresses.length > 0) setSelectedAddress(addresses[0]);

          // If returning from map (not initial mount) and a new address was added,
          // auto-advance to the library selection step
          if (
            !isInitialMount.current &&
            addresses.length > prevAddressCount.current &&
            addresses.length > 0
          ) {
            const newest = addresses[addresses.length - 1];
            setSelectedAddress(newest);
            setStep("select");
          }

          prevAddressCount.current = addresses.length;
          isInitialMount.current = false;
        } catch (err) {
          console.warn("Failed to load addresses", err);
        } finally {
          if (active) setAddressLoading(false);
        }
      })();
      return () => {
        active = false;
      };
    }, [userId]),
  );

  const formatAddress = (addr: any) => {
    if (!addr) return "";
    const parts = [addr.street, addr.city, addr.state, addr.pincode].filter(
      Boolean,
    );
    return parts.join(", ") || "Unknown location";
  };

  const handleAddressSelected = (addr: any) => {
    setSelectedAddress(addr);
    setShowAddressPicker(false);
  };

  const proceedToLibrarySelection = async () => {
    if (!selectedAddress) return;
    setStep('select');
    setLoadingLibraries(true);
    try {
      const coords = selectedAddress?.location?.coordinates;
      // coords is [lng, lat] in GeoJSON format
      const lat = coords?.[1];
      const lng = coords?.[0];
      const availRes = await bookService.getBookAvailability(id as string, lat, lng);
      if (availRes?.data?.branches) {
        const nextLibraries = availRes.data.branches;
        setLibraries(nextLibraries);
        autoSelectNearestLibrary(nextLibraries);
      }
    } catch (err) {
      console.warn('Failed to refresh availability', err);
    } finally {
      setLoadingLibraries(false);
    }
  };

  const confirmOrder = async () => {
    if (!book || !selectedLib || !activeProfileId) return;
    setOrderProcessing(true);
    try {
      const result = await bookService.issueBook(book.id, selectedLib, activeProfileId);
      setIssuedId(result?.data?.issue?._id ?? null);
      setStep("placed");
    } catch (err: any) {
      console.warn("Failed to issue book", err);
      alert(err.response?.data?.message || "Failed to process order");
    } finally {
      setOrderProcessing(false);
    }
  };

  const lib = libraries.find((l) => l.branchId === selectedLib);
  const DELIVERY_FEE = 20;
  const LATE_FEE_PER_DAY = 2;

  if (step === "placed") {
    return (
      <SafeAreaView style={s.safe}>
        {Platform.OS === 'web' && <NavBar role="user" active="mybooks" />}
        <View style={s.successScreen}>
          <Text style={s.successTitle}>Order Placed!</Text>
          <Text style={s.successSub}>
            Your book will arrive in 1–2 working days.{"\n"}
            You&apos;ll get a notification when it ships.
          </Text>
          <TouchableOpacity
            style={s.btnPrimary}
            onPress={() => router.push(`/(user)/track/${issuedId || 'unknown'}`)}
          >
            <Text style={s.btnPrimaryText}>📦 Track my order</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={s.btnGhost}
            onPress={() => router.replace("/(user)")}
          >
            <Text style={s.btnGhostText}>← Back home</Text>
          </TouchableOpacity>
        </View>
        {Platform.OS !== 'web' && <NavBar role="user" active="mybooks" />}
      </SafeAreaView>
    );
  }

  if (loading || !book) {
    return (
      <SafeAreaView
        style={[s.safe, { justifyContent: "center", alignItems: "center" }]}
      >
        <ActivityIndicator size="large" color={Colors.accentSage} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe}>
      {Platform.OS === 'web' && <NavBar role="user" active="mybooks" />}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.scroll}
      >
        <TouchableOpacity
          style={s.backBtn}
          onPress={() => {
            if (step === "address") router.back();
            else if (step === "select") setStep("address");
            else setStep("select");
          }}
        >
          <Text style={s.backText}>
            ←{" "}
            {step === "confirm"
              ? "Back"
              : step === "select"
                ? "Change address"
                : "Back to book"}
          </Text>
        </TouchableOpacity>

        {/* Book summary */}
        <View style={s.bookSummary}>
          <BookCover book={book} width={70} height={100} fontSize={9} />
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={s.bookTitle}>{book.title}</Text>
            <Text style={s.bookAuthor}>by {book.author}</Text>
            <View
              style={[
                s.badge,
                {
                  backgroundColor: Colors.accentSageLight,
                  alignSelf: "flex-start",
                },
              ]}
            >
              <Text style={[s.badgeText, { color: Colors.accentSage }]}>
                📦 Physical delivery
              </Text>
            </View>
          </View>
        </View>

        {step === "address" && (
          <>
            <Text style={s.sectionTitle}>Deliver to</Text>

            {addressLoading ? (
              <View
                style={{ alignItems: "center", paddingVertical: Spacing.xl }}
              >
                <ActivityIndicator size="large" color={Colors.accentSage} />
                <Text
                  style={{ color: Colors.textMuted, marginTop: Spacing.sm }}
                >
                  Loading saved addresses…
                </Text>
              </View>
            ) : (
              <>
                {/* Show saved addresses */}
                {savedAddresses.length > 0 ? (
                  <>
                    {savedAddresses.map((addr: any) => (
                      <TouchableOpacity
                        key={addr._id}
                        style={[
                          s.libCard,
                          selectedAddress?._id === addr._id &&
                            s.libCardSelected,
                        ]}
                        onPress={() => setSelectedAddress(addr)}
                        activeOpacity={0.82}
                      >
                        <View style={{ flex: 1, gap: 3 }}>
                          <View
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              gap: 6,
                            }}
                          >
                            <Text style={s.libName}>
                              📍 {addr.label || "Saved"}
                            </Text>
                            {addr.isDefault && (
                              <View
                                style={{
                                  backgroundColor: Colors.accentSageLight,
                                  paddingHorizontal: 6,
                                  paddingVertical: 1,
                                  borderRadius: 10,
                                }}
                              >
                                <Text
                                  style={{
                                    fontSize: 10,
                                    fontWeight: "700",
                                    color: Colors.accentSage,
                                  }}
                                >
                                  Default
                                </Text>
                              </View>
                            )}
                          </View>
                          <Text style={s.libMeta}>{formatAddress(addr)}</Text>
                        </View>
                        <View
                          style={[
                            s.radio,
                            selectedAddress?._id === addr._id &&
                              s.radioSelected,
                          ]}
                        >
                          {selectedAddress?._id === addr._id && (
                            <View style={s.radioFill} />
                          )}
                        </View>
                      </TouchableOpacity>
                    ))}
                  </>
                ) : (
                  <View
                    style={{
                      alignItems: "center",
                      paddingVertical: Spacing.xl,
                      gap: 8,
                    }}
                  >
                    <Text style={{ fontSize: 48 }}>📭</Text>
                    <Text
                      style={{
                        fontSize: Typography.body,
                        color: Colors.textSecondary,
                        textAlign: "center",
                      }}
                    >
                      No saved addresses yet.{"\n"}Add one to continue!
                    </Text>
                  </View>
                )}

                {/* Add new address button */}
                <TouchableOpacity
                  style={[
                    s.btnGhost,
                    {
                      marginTop: Spacing.sm,
                      flexDirection: "row",
                      justifyContent: "center",
                      gap: 6,
                    },
                  ]}
                  onPress={() => router.push("/(user)/delivery-map")}
                  activeOpacity={0.82}
                >
                  <Text
                    style={[
                      s.btnGhostText,
                      { color: Colors.accentSage, fontWeight: "700" },
                    ]}
                  >
                    ＋ Add a new address
                  </Text>
                </TouchableOpacity>

                {/* Continue button */}
                <TouchableOpacity
                  style={[
                    s.btnPrimary,
                    { marginTop: Spacing.lg },
                    !selectedAddress && s.btnDisabled,
                  ]}
                  disabled={!selectedAddress}
                  onPress={proceedToLibrarySelection}
                  activeOpacity={0.82}
                >
                  <Text style={s.btnPrimaryText}>
                    Continue to select library →
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </>
        )}

        {step === "select" && (
          <>
            {/* Library picker */}
            <Text style={s.sectionTitle}>Choose an available library</Text>
            {loadingLibraries ? (
              <View style={{ alignItems: 'center', paddingVertical: Spacing.xl }}>
                <ActivityIndicator size="large" color={Colors.accentSage} />
                <Text style={{ color: Colors.textMuted, marginTop: Spacing.sm }}>
                  Finding branches near you…
                </Text>
              </View>
            ) : libraries.length === 0 ? (
              <Text
                style={{ color: Colors.textMuted, marginVertical: Spacing.sm }}
              >
                No branches currently have this book in stock nearby.
              </Text>
            ) : null}
            {!loadingLibraries && libraries.map((lib) => (
              <TouchableOpacity
                key={lib.branchId}
                style={[
                  s.libCard,
                  selectedLib === lib.branchId && s.libCardSelected,
                  !lib.isWithinReach && {
                    opacity: 0.6,
                    borderColor: Colors.cardBorder,
                  },
                ]}
                onPress={() =>
                  lib.isWithinReach && setSelectedLib(lib.branchId)
                }
                activeOpacity={lib.isWithinReach ? 0.82 : 1}
              >
                <View style={{ flex: 1, gap: 3 }}>
                  <Text
                    style={[
                      s.libName,
                      !lib.isWithinReach && { color: Colors.textSecondary },
                    ]}
                  >
                    {lib.branchName}
                  </Text>
                  <Text style={s.libMeta}>
                    📍 {lib.distance} km · 🕐 1–2 working days
                  </Text>
                  {lib.isWithinReach ? (
                    <Text style={s.libStock}>
                      {lib.availableCopies} copies available
                    </Text>
                  ) : (
                    <Text style={[s.libStock, { color: Colors.error }]}>
                      ✗ Out of delivery radius
                    </Text>
                  )}
                </View>
                <View
                  style={[
                    s.radio,
                    selectedLib === lib.branchId && s.radioSelected,
                    !lib.isWithinReach && { opacity: 0.4 },
                  ]}
                >
                  {selectedLib === lib.branchId && <View style={s.radioFill} />}
                </View>
              </TouchableOpacity>
            ))}

            {/* Return period */}
            <Text style={[s.sectionTitle, { marginTop: Spacing.lg }]}>
              Return period
            </Text>
            <View style={s.returnRow}>
              {RETURN_PERIODS.map((p) => (
                <TouchableOpacity
                  key={p}
                  style={[s.periodBtn, returnDays === p && s.periodBtnActive]}
                  onPress={() => setReturnDays(p)}
                >
                  <Text
                    style={[
                      s.periodText,
                      returnDays === p && s.periodTextActive,
                    ]}
                  >
                    {p}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={s.fineNote}>
              ⚠️ Late returns are charged ₹{LATE_FEE_PER_DAY}/day automatically.
            </Text>

            <TouchableOpacity
              style={[s.btnPrimary, !selectedLib && s.btnDisabled]}
              disabled={!selectedLib}
              onPress={() => setStep("confirm")}
              activeOpacity={0.82}
            >
              <Text style={s.btnPrimaryText}>Continue to confirm →</Text>
            </TouchableOpacity>
          </>
        )}

        {step === "confirm" && lib && (
          <>
            <Text style={s.sectionTitle}>Confirm your order</Text>

            {/* Summary card */}
            <View style={s.confirmCard}>
              {[
                ["Book", book.title],
                [
                  "Deliver to",
                  selectedAddress ? formatAddress(selectedAddress) : "Not set",
                ],
                ["Library", lib.branchName],
                ["Distance", `${lib.distance} km`],
                ["Expected delivery", "1–2 working days"],
                ["Return by", returnDays + " from delivery"],
                ["Delivery fee", `₹${DELIVERY_FEE}`],
                ["Late fee (if any)", `₹${LATE_FEE_PER_DAY}/day`],
              ].map(([label, value]) => (
                <View key={label} style={s.confirmRow}>
                  <Text style={s.confirmLabel}>{label}</Text>
                  <Text style={s.confirmValue}>{value}</Text>
                </View>
              ))}
            </View>

            <Text style={s.payNote}>
              💳 Payment is online only — you&apos;ll be redirected to the
              payment gateway.
            </Text>

            <TouchableOpacity
              style={[s.btnPrimary, orderProcessing && s.btnDisabled]}
              activeOpacity={0.82}
              onPress={confirmOrder}
              disabled={orderProcessing}
            >
              <Text style={s.btnPrimaryText}>
                {orderProcessing
                  ? "Processing…"
                  : `Pay ₹${DELIVERY_FEE} & confirm →`}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={s.btnGhost}
              onPress={() => setStep("select")}
            >
              <Text style={s.btnGhostText}>← Change library</Text>
            </TouchableOpacity>
          </>
        )}

        <View style={{ height: Spacing.xxl }} />
      </ScrollView>

      {/* Address picker modal (alternative entry point) */}
      <AddressPickerModal
        visible={showAddressPicker}
        onClose={() => setShowAddressPicker(false)}
        onSelect={handleAddressSelected}
      />
      {Platform.OS !== 'web' && <NavBar role="user" active="mybooks" />}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  scroll: { paddingHorizontal: Spacing.xl, paddingBottom: NAV_BOTTOM_PAD + Spacing.xl },
  successScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.xl,
    gap: Spacing.md,
  },

  backBtn: { marginTop: Spacing.md, marginBottom: Spacing.lg },
  backText: {
    fontSize: Typography.body,
    color: Colors.accentSage,
    fontWeight: "700",
  },

  bookSummary: {
    flexDirection: "row",
    gap: Spacing.md,
    alignItems: "center",
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.xl,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  bookTitle: {
    fontSize: Typography.body + 1,
    fontWeight: "800",
    color: Colors.textPrimary,
  },
  bookAuthor: { fontSize: Typography.label, color: Colors.textSecondary },
  badge: {
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: { fontSize: Typography.label - 1, fontWeight: "700" },

  sectionTitle: {
    fontSize: Typography.body + 1,
    fontWeight: "800",
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },

  libCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 2,
    borderColor: Colors.cardBorder,
    gap: Spacing.sm,
  },
  libCardSelected: {
    borderColor: Colors.accentSage,
    backgroundColor: "#F0F8ED",
  },
  libName: {
    fontSize: Typography.body,
    fontWeight: "700",
    color: Colors.textPrimary,
  },
  libMeta: { fontSize: Typography.label, color: Colors.textSecondary },
  libStock: {
    fontSize: Typography.label,
    color: Colors.accentSage,
    fontWeight: "600",
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: Radius.full,
    borderWidth: 2,
    borderColor: Colors.cardBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  radioSelected: { borderColor: Colors.accentSage },
  radioFill: {
    width: 12,
    height: 12,
    borderRadius: Radius.full,
    backgroundColor: Colors.accentSage,
  },

  returnRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  periodBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: Radius.full,
    backgroundColor: Colors.card,
    borderWidth: 1.5,
    borderColor: Colors.cardBorder,
    alignItems: "center",
  },
  periodBtnActive: {
    backgroundColor: Colors.accentSage,
    borderColor: Colors.accentSage,
  },
  periodText: {
    fontSize: Typography.label,
    fontWeight: "700",
    color: Colors.textSecondary,
  },
  periodTextActive: { color: Colors.textOnDark },

  fineNote: {
    fontSize: Typography.label,
    color: Colors.warning,
    fontWeight: "600",
    marginBottom: Spacing.lg,
    lineHeight: 20,
  },

  confirmCard: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    marginBottom: Spacing.md,
    overflow: "hidden",
  },
  confirmRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.cardBorder,
  },
  confirmLabel: {
    fontSize: Typography.label,
    color: Colors.textSecondary,
    fontWeight: "600",
  },
  confirmValue: {
    fontSize: Typography.body,
    color: Colors.textPrimary,
    fontWeight: "700",
    maxWidth: "55%",
    textAlign: "right",
  },
  payNote: {
    fontSize: Typography.label,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginBottom: Spacing.lg,
  },

  btnPrimary: {
    backgroundColor: Colors.buttonPrimary,
    borderRadius: Radius.full,
    paddingVertical: 16,
    alignItems: "center",
  },
  btnDisabled: { opacity: 0.4 },
  btnPrimaryText: {
    fontSize: Typography.body,
    fontWeight: "800",
    color: Colors.buttonPrimaryText,
  },
  btnGhost: {
    borderRadius: Radius.full,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: Colors.cardBorder,
    marginTop: Spacing.sm,
  },
  btnGhostText: {
    fontSize: Typography.body,
    fontWeight: "600",
    color: Colors.textSecondary,
  },

  successEmoji: { fontSize: 80 },
  successTitle: {
    fontSize: Typography.display,
    fontWeight: "800",
    color: Colors.accentSage,
    textAlign: "center",
  },
  successSub: {
    fontSize: Typography.body,
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 24,
  },
});
