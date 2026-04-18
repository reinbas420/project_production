import bookService from "@/api/services/bookService";
import axiosInstance from "@/api/axiosInstance";
import issueService from "@/api/services/issueService";
import locationService from "@/api/services/locationService";
import { BookCover } from "@/components/BookCover";
import { API_BASE_URL } from "@/constants/config";
import { GENRES, type Book } from "@/constants/mockData";
import { Colors, Radius, Spacing, Typography } from "@/constants/theme";
import useAppStore from "@/store/useAppStore";
import useChildTrackingStore from "@/store/useChildTrackingStore";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { NavBar, NAV_BOTTOM_PAD } from "@/components/NavBar";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    FlatList,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

function mapBook(b: any): Book {
  return {
    id: b._id || b.id,
    title: b.title || "Unknown Title",
    author: b.author || "Unknown Author",
    pages: b.pageCount || null,
    releaseYear: b.publishedDate
      ? (parseInt(b.publishedDate.match(/\d{4}/)?.[0]) || new Date(b.createdAt || Date.now()).getFullYear())
      : new Date(b.createdAt || Date.now()).getFullYear(),
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
    isbn: b.isbn != null ? String(b.isbn) : undefined,
    availableAtSelectedBranch: b.availableAtSelectedBranch,
    otherBranchNames: Array.isArray(b.otherBranchNames) ? b.otherBranchNames : [],
  };
}

function toAvailableBooks(books: any[]) {
  return books
    .map(mapBook)
    .filter((book) => (book.availableCopies ?? 0) > 0 && !!book.coverImage);
}

type Branch = {
  _id: string;
  name: string;
  distanceKm?: number | null;
};

const { width } = Dimensions.get("window");
const HRCARD_W = 130;
const HRCARD_H = 190;

// ─── Horizontal book card (for recommendation row) ────────────────────────────
function HorizBookCard({ book, onPress }: { book: Book; onPress: () => void }) {
  const [visible, setVisible] = useState(false);
  const [errored, setErrored] = useState(false);
  if (errored || !book.coverImage) return null;
  return (
    <TouchableOpacity
      style={[hc.wrap, { opacity: visible ? 1 : 0, width: visible ? HRCARD_W : 0 }]}
      onPress={onPress}
      activeOpacity={0.82}
    >
      <BookCover
        book={book}
        width={HRCARD_W}
        height={HRCARD_H}
        fontSize={11}
        onImageLoad={() => setVisible(true)}
        onImageError={() => setErrored(true)}
      />
      <Text style={hc.title} numberOfLines={2}>
        {book.title}
      </Text>
      <Text style={hc.author} numberOfLines={1}>
        {book.author}
      </Text>
      <Text style={hc.avail}>
        {book.availableCopies > 0
          ? `✓ ${book.availableCopies} available`
          : "✗ Unavailable"}
      </Text>
    </TouchableOpacity>
  );
}
const hc = StyleSheet.create({
  wrap: { width: HRCARD_W, gap: 5 },
  title: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.textPrimary,
    lineHeight: 17,
  },
  author: { fontSize: 11, color: Colors.textSecondary },
  avail: { fontSize: 11, color: Colors.accentSage, fontWeight: "700" },
});

// ─── Search result row ────────────────────────────────────────────────────────
function SearchRow({ book, onPress }: { book: Book; onPress: () => void }) {
  const isTrans = book.availableAtSelectedBranch === false;
  return (
    <TouchableOpacity style={[sr.row, isTrans && { opacity: 0.45 }]} onPress={onPress} activeOpacity={0.82}>
      <BookCover book={book} width={56} height={76} fontSize={9} />
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={sr.title}>{book.title}</Text>
        <Text style={sr.author}>
          by {book.author} · {book.releaseYear}
        </Text>
        <View style={{ flexDirection: "row", gap: 6 }}>
          {book.genres.slice(0, 2).map((g) => (
            <View key={g} style={sr.chip}>
              <Text style={sr.chipText}>{g}</Text>
            </View>
          ))}
        </View>
      </View>
      <View style={{ alignItems: 'flex-end', justifyContent: 'center' }}>
        <Text style={[sr.avail, isTrans && { color: Colors.error }]}>
          {isTrans ? "Not here" : (book.availableCopies > 0 ? `${book.availableCopies} left` : "Waitlist")}
        </Text>
        {isTrans && book.otherBranchNames && book.otherBranchNames.length > 0 && (
          <Text style={{ fontSize: 9, color: Colors.textSecondary, marginTop: 4, maxWidth: 85, textAlign: 'right' }}>
            At {book.otherBranchNames[0]} {book.otherBranchNames.length > 1 ? `(+${book.otherBranchNames.length - 1} more)` : ''}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
}
const sr = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: Spacing.md,
    alignItems: "center",
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    padding: Spacing.sm,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  title: {
    fontSize: Typography.body,
    fontWeight: "700",
    color: Colors.textPrimary,
  },
  author: { fontSize: Typography.label, color: Colors.textSecondary },
  chip: {
    backgroundColor: Colors.browseSurface,
    borderRadius: Radius.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  chipText: { fontSize: 11, color: Colors.accentPeriwinkle, fontWeight: "600" },
  avail: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.accentSage,
    textAlign: "right",
  },
});

// ─── Section header ───────────────────────────────────────────────────────────
function SectionHeader({
  title,
  onSeeAll,
}: {
  title: string;
  onSeeAll?: () => void;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: Spacing.sm,
      }}
    >
      <Text
        style={{
          fontSize: Typography.body + 1,
          fontWeight: "800",
          color: Colors.textPrimary,
        }}
      >
        {title}
      </Text>
      {onSeeAll && (
        <TouchableOpacity onPress={onSeeAll}>
          <Text
            style={{
              fontSize: Typography.label,
              color: Colors.accentSage,
              fontWeight: "700",
            }}
          >
            See all
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function UserHome() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [menuVisible, setMenuVisible] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  // "For You" = adult books view | "forChild" = child books + tracking view
  const [mode, setMode] = useState<'forYou' | 'forChild'>('forYou');
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);

  const { userId, profiles, activeProfileId, clearAuth, token, removeProfile, selectedBranchId, selectedBranchName, setSelectedBranch } = useAppStore();
  const activeProfile = profiles.find((p) => p.profileId === activeProfileId);
  const preferredGenres = activeProfile?.preferredGenres?.length
    ? activeProfile.preferredGenres
    : ["Fantasy", "Picture Book"];

  // For child profiles, compute the maximum age so the backend can filter out adult content.
  // Compute the maxAge book filter:
  //   CHILD profile       → lower bound of ageGroup (e.g. "10-12" → 10, blocks 12+ books)
  //   PARENT with "15+"   → 15 (adult view, but 16+/18+ books are still filtered out)
  //   All other PARENT    → undefined (full adult catalog, no filter)
  const childMaxAge: number | undefined = (() => {
    const ag = activeProfile?.ageGroup ?? '';
    if (activeProfile?.accountType === 'CHILD') {
      if (!ag) return 10;
      if (ag.endsWith('+')) return parseInt(ag, 10);
      const min = parseInt(ag.split('-')[0], 10);
      return isNaN(min) ? 10 : min;
    }
    if (activeProfile?.accountType === 'PARENT' && ag === '15+') return 17;
    return undefined;
  })();

  // When a parent switches to "For Child" mode, look up the selected (or first) child's
  // age group so the catalog only shows age-appropriate books for that child.
  const viewingChild =
    profiles.find(p => p.profileId === selectedChildId && p.accountType === 'CHILD')
    ?? profiles.find(p => p.accountType === 'CHILD');
  const viewingChildMaxAge: number = (() => {
    const ag = viewingChild?.ageGroup ?? '';
    if (!ag) return 12;
    if (ag.endsWith('+')) return parseInt(ag, 10);
    const min = parseInt(ag.split('-')[0], 10);
    return isNaN(min) ? 12 : min;
  })();

  // ageFilter to pass to every getBooks call:
  //   • Logged-in CHILD profile  → maxAge (hide adult books)
  //   • Parent in "For Child"    → maxAge of the selected child (show children's books)
  //   • Parent in "For You"      → minAge:5 (hide toddler/picture books only; YA 12+ stays visible)
  const ageFilter: { maxAge?: number; minAge?: number } =
    childMaxAge !== undefined
      ? { maxAge: childMaxAge }
      : mode === 'forChild'
        ? { maxAge: viewingChildMaxAge }
        : {};

  const [recommended, setRecommended] = useState<Book[]>([]);
  const [newArrivals, setNewArrivals] = useState<Book[]>([]);
  const [allBooks, setAllBooks] = useState<Book[]>([]);
  const [smartRecommendations, setSmartRecommendations] = useState<Book[]>([]);
  const [searchResults, setSearchResults] = useState<Book[]>([]);
  const [activeIssues, setActiveIssues] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [smartLoading, setSmartLoading] = useState(false);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchesResolved, setBranchesResolved] = useState(false);
  const [userCoords, setUserCoords] = useState<{ latitude: number; longitude: number } | null>(null);

  // Resolve reference location once so branch distances match ordering logic.
  // Order flow uses saved delivery address (default -> first), so we mirror that.
  useEffect(() => {
    let active = true;

    const setCoords = (latitude: number, longitude: number) => {
      if (!active) return;
      setUserCoords({ latitude, longitude });
    };

    const resolveFromSavedDeliveryAddress = async (): Promise<boolean> => {
      if (!userId) return false;
      try {
        const addrRes = await locationService.getDeliveryAddresses(userId);
        const addresses = Array.isArray((addrRes as any)?.data?.addresses)
          ? (addrRes as any).data.addresses
          : Array.isArray((addrRes as any)?.addresses)
            ? (addrRes as any).addresses
          : [];
        const selected = addresses.find((a: any) => a?.isDefault) || addresses[0];
        const coords = selected?.location?.coordinates;
        if (Array.isArray(coords) && coords.length === 2) {
          setCoords(coords[1], coords[0]);
          return true;
        }
      } catch {
        // Fall through to legacy field and then device GPS.
      }

      try {
        const userRes = await axiosInstance.get(`/users/${userId}`);
        const legacyCoords = userRes?.data?.data?.user?.deliveryAddress?.location?.coordinates;
        if (Array.isArray(legacyCoords) && legacyCoords.length === 2) {
          setCoords(legacyCoords[1], legacyCoords[0]);
          return true;
        }
      } catch {
        // Fall back to runtime GPS.
      }

      return false;
    };

    const requestLocation = async () => {
      try {
        const hasSavedAddressLocation = await resolveFromSavedDeliveryAddress();
        if (hasSavedAddressLocation) return;

        const webNavigator: any = typeof globalThis !== "undefined" ? (globalThis as any).navigator : undefined;
        if (Platform.OS === "web" && webNavigator?.geolocation) {
          webNavigator.geolocation.getCurrentPosition(
            (pos: any) => setCoords(pos.coords.latitude, pos.coords.longitude),
            () => setUserCoords(null),
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
          );
          return;
        }

        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          setUserCoords(null);
          return;
        }

        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        setCoords(pos.coords.latitude, pos.coords.longitude);
      } catch {
        if (active) setUserCoords(null);
      }
    };

    requestLocation();
    return () => {
      active = false;
    };
  }, [userId]);

  // Fetch branches sorted by distance when location is available.
  useEffect(() => {
    let active = true;

    const fetchBranches = async () => {
      try {
        const params = userCoords
          ? { lat: userCoords.latitude, lng: userCoords.longitude }
          : undefined;
        const res = await axiosInstance.get('/libraries', { params });
        if (!active || !res.data?.data?.libraries) return;

        const nextBranches = (res.data.data.libraries as Branch[]).slice();
        setBranches(nextBranches);

        if (nextBranches.length === 0) return;

        const selectedExists = !!selectedBranchId && nextBranches.some((b) => b._id === selectedBranchId);
        if (!selectedExists) {
          setSelectedBranch(nextBranches[0]._id, nextBranches[0].name);
        }
      } catch (error) {
        console.warn("Failed to fetch branches:", error);
      } finally {
        if (active) setBranchesResolved(true);
      }
    };

    fetchBranches();
    return () => { active = false; };
  }, [userCoords?.latitude, userCoords?.longitude]);

  // Fetch initial sections
  useEffect(() => {
    let active = true;

    if (!branchesResolved || (branches.length > 0 && !selectedBranchId)) {
      setLoading(true);
      return () => {
        active = false;
      };
    }

    const fetchSections = async () => {
      setLoading(true);
      try {
        const [recRes, newRes] = await Promise.all([
          bookService.getBooks({
            genre: preferredGenres,
            limit: 10,
            branchId: selectedBranchId || undefined,
            ...ageFilter,
          }),
          bookService.getBooks({
            limit: 10,
            branchId: selectedBranchId || undefined,
            ...ageFilter,
          }),
        ]);

        if (active) setRecommended(toAvailableBooks(recRes?.data?.books || []));
        if (active) setNewArrivals(toAvailableBooks(newRes?.data?.books || []));

        if (active) setLoading(false);

        if (activeProfile?.profileId && userId) {
          const issuesRes = await issueService.getUserIssues(
            userId,
            activeProfile.profileId,
          );
          if (active && issuesRes.data?.issues) {
            setActiveIssues(
              issuesRes.data.issues.filter((i: any) => i.status === "ISSUED"),
            );
          }
        }
      } catch (error) {
        console.warn("Failed to fetch sections:", error);
      } finally {
        if (active) setLoading(false);
        if (active) setSmartLoading(false);
      }
    };
    fetchSections();
    return () => {
      active = false;
    };
  }, [preferredGenres, childMaxAge, mode, selectedChildId, selectedBranchId, branchesResolved, branches.length]);

  // Fetch smart picks separately so they never block the main branch books.
  useEffect(() => {
    let active = true;

    if (!branchesResolved || !selectedBranchId || !userId || !activeProfileId) {
      setSmartRecommendations([]);
      setSmartLoading(false);
      return () => {
        active = false;
      };
    }

    const fetchSmartRecommendations = async () => {
      try {
        setSmartLoading(true);
        const smartRes = await axiosInstance.get(
          `/books/smart-recommendations?branchId=${selectedBranchId}&userId=${userId}&profileId=${activeProfileId}`,
        );
        if (active && smartRes?.data?.data?.books) {
          setSmartRecommendations(toAvailableBooks(smartRes.data.data.books || []));
        }
      } catch (error) {
        console.warn("Smart picks err", error);
        if (active) setSmartRecommendations([]);
      } finally {
        if (active) setSmartLoading(false);
      }
    };

    fetchSmartRecommendations();
    return () => {
      active = false;
    };
  }, [branchesResolved, selectedBranchId, userId, activeProfileId]);

  // Fetch all books for genre carousels
  useEffect(() => {
    let active = true;

    if (!branchesResolved || (branches.length > 0 && !selectedBranchId)) {
      setAllBooks([]);
      return () => {
        active = false;
      };
    }

    const fetchAllBooks = async () => {
      try {
        const res = await bookService.getBooks({
          limit: 100,
          branchId: selectedBranchId || undefined,
          ...ageFilter,
        });
        if (active) setAllBooks(toAvailableBooks(res?.data?.books || []));
      } catch (error) {
        console.warn("Failed to fetch books for genre browse:", error);
      }
    };
    fetchAllBooks();
    return () => {
      active = false;
    };
  }, [childMaxAge, mode, selectedChildId, selectedBranchId, branchesResolved, branches.length]);

  // Fetch search results
  useEffect(() => {
    let active = true;
    if (!branchesResolved || (branches.length > 0 && !selectedBranchId)) {
      setSearchResults([]);
      return () => {
        active = false;
      };
    }

    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await bookService.getBooks({
          search: query,
          limit: 20,
          branchId: selectedBranchId || undefined,
          ...ageFilter,
        });
        if (active) setSearchResults(toAvailableBooks(res?.data?.books || []));
      } catch (error) {
        console.warn("Failed to fetch search results:", error);
      }
    }, 500);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query, childMaxAge, mode, selectedChildId, selectedBranchId, branchesResolved, branches.length]);

  const searching = query.trim().length > 0;

  const handleSignOut = async () => {
    setMenuVisible(false);
    await clearAuth();
    router.replace("/(auth)/welcome");
  };

  const childProfiles = profiles.filter((p) => p.accountType === "CHILD");
  // The main account profile is always profiles[0] — the one created at registration.
  // All secondary profiles (child or 15+ adult) are added later via the /children endpoint.
  const mainProfileId = profiles[0]?.profileId;
  const deletableProfiles = profiles.filter((p) => p.profileId !== mainProfileId);

  const { getQuizzesPassed } = useChildTrackingStore();
  const [childBooksRead, setChildBooksRead] = useState(0);
  const [childGenre, setChildGenre] = useState('All');

  // Fetch real borrow count for the selected child profile
  useEffect(() => {
    const childId = selectedChildId ?? childProfiles[0]?.profileId;
    if (!childId || !userId || mode !== 'forChild') return;
    let active = true;
    issueService.getUserIssues(userId, childId).then((res: any) => {
      if (active) setChildBooksRead((res?.data?.issues || []).length);
    }).catch(() => {});
    return () => { active = false; };
  }, [selectedChildId, mode, userId]);

  const handleDeleteProfile = () => {
    setMenuVisible(false);
    if (deletableProfiles.length === 0) {
      if (Platform.OS === "web") {
        window.alert(
          "No Profiles to Delete\n\nThe main account profile cannot be deleted from here.",
        );
      } else {
        Alert.alert(
          "No Profiles to Delete",
          "The main account profile cannot be deleted from here.",
        );
      }
      return;
    }
    setDeleteModalVisible(true);
  };

  const confirmDeleteProfile = async (p: any) => {
    if (Platform.OS === "web") {
      const confirmed = window.confirm(
        `Are you sure you want to delete the profile "${p.name}"? This cannot be undone.`,
      );
      if (!confirmed) return;
      try {
        await fetch(
          `${API_BASE_URL}/users/${userId}/profiles/${p.profileId}`,
          {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}` },
          },
        );
        await removeProfile(p.profileId);
        setDeleteModalVisible(false);
        window.alert(`Profile "${p.name}" has been removed.`);
        router.replace("/(select-profile)");
      } catch {
        window.alert("Failed to delete profile.");
      }
    } else {
      Alert.alert(
        "Confirm Delete",
        `Are you sure you want to delete the profile "${p.name}"? This cannot be undone.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: async () => {
              try {
                await fetch(
                  `${API_BASE_URL}/users/${userId}/profiles/${p.profileId}`,
                  {
                    method: "DELETE",
                    headers: { Authorization: `Bearer ${token}` },
                  },
                );
                await removeProfile(p.profileId);
                setDeleteModalVisible(false);
                Alert.alert("Deleted", `Profile "${p.name}" has been removed.`);
                router.replace("/(select-profile)");
              } catch {
                Alert.alert("Error", "Failed to delete profile.");
              }
            },
          },
        ],
      );
    }
  };

  return (
    <SafeAreaView style={s.safe}>
      {/* ── Hamburger Menu Modal ── */}
      <Modal
        transparent
        visible={menuVisible}
        animationType="fade"
        onRequestClose={() => setMenuVisible(false)}
      >
        <TouchableOpacity
          style={s.modalOverlay}
          activeOpacity={1}
          onPress={() => setMenuVisible(false)}
        >
          <View style={s.menuCard}>
            <Text style={s.menuTitle}>Menu</Text>
            <TouchableOpacity
              style={s.menuItem}
              onPress={() => {
                setMenuVisible(false);
                router.push("/(user)/edit-profile");
              }}
            >
              <Text style={s.menuItemText}>Edit Profile</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.menuItem} onPress={handleDeleteProfile}>
              <Text style={[s.menuItemText, { color: Colors.error }]}>
                Delete Profile
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.menuItem} onPress={handleSignOut}>
              <Text style={[s.menuItemText, { color: Colors.error }]}>
                Sign Out
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={s.menuCancel}
              onPress={() => setMenuVisible(false)}
            >
              <Text style={s.menuCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── Delete Profile Modal ── */}
      <Modal
        transparent
        visible={deleteModalVisible}
        animationType="slide"
        onRequestClose={() => setDeleteModalVisible(false)}
      >
        <View style={s.deleteOverlay}>
          <View style={s.deleteCard}>
            <Text style={s.deleteTitle}>Select Profile to Delete</Text>
            <Text style={s.deleteSubtitle}>
              Tap a profile to remove it permanently. The main account cannot be deleted.
            </Text>
            <FlatList
              data={deletableProfiles}
              keyExtractor={(item) => item.profileId}
              numColumns={2}
              columnWrapperStyle={{ gap: Spacing.md, marginBottom: Spacing.md }}
              contentContainerStyle={{ paddingVertical: Spacing.md }}
              renderItem={({ item, index }) => {
                const AVATAR_COLORS = [
                  "#C5DDB8",
                  "#F4C2C2",
                  "#C5D5EA",
                  "#FFDAB9",
                  "#D4C5EA",
                  "#B8D4C8",
                ];
                const bgColor = AVATAR_COLORS[index % AVATAR_COLORS.length];
                const age = item.age || 0;
                const emoji = item.accountType === 'PARENT' ? "👤" : age <= 3 ? "👶" : age <= 10 ? "🧒" : "🧑";
                return (
                  <TouchableOpacity
                    style={s.deleteProfileCard}
                    activeOpacity={0.78}
                    onPress={() => confirmDeleteProfile(item)}
                  >
                    <View
                      style={[s.deleteAvatar, { backgroundColor: bgColor }]}
                    >
                      <Text style={s.deleteAvatarEmoji}>{emoji}</Text>
                    </View>
                    <Text style={s.deleteProfileName} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <View style={s.deleteAgeBadge}>
                      <Text style={s.deleteAgeBadgeText}>
                        {item.ageGroup ? `Age ${item.ageGroup}` : `Age ${age}`}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              }}
            />
            <TouchableOpacity
              style={s.deleteCancelBtn}
              onPress={() => setDeleteModalVisible(false)}
            >
              <Text style={s.deleteCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {Platform.OS === 'web' && <NavBar role="user" active="home" />}

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.scroll}
      >
        {/* ── Header ── */}
        <View style={s.header}>
          <TouchableOpacity
            style={s.profileBtn}
            onPress={() => setMenuVisible(true)}
          >
            <Text style={s.profileEmoji}>☰</Text>
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={s.greeting}>
              Hello, {activeProfile?.name || "Priya"}
            </Text>
            {branches.length > 0 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ marginTop: 4 }}
                contentContainerStyle={{ paddingRight: 6 }}
              >
                {branches.filter(b => (b.distanceKm ?? 0) < 8).map(b => (
                  <TouchableOpacity 
                    key={b._id} 
                    onPress={() => setSelectedBranch(b._id, b.name)}
                    style={[
                      s.branchPill,
                      selectedBranchId === b._id ? s.branchPillActive : undefined,
                    ]}
                  >
                    <Text style={[s.branchPillName, selectedBranchId === b._id ? s.branchPillNameActive : undefined]}>
                      📍 {b.name}
                    </Text>
                    {typeof b.distanceKm === 'number' && (
                      <Text style={[s.branchPillDistance, selectedBranchId === b._id ? s.branchPillDistanceActive : undefined]}>
                        {b.distanceKm.toFixed(1)} km
                      </Text>
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            ) : (
              <Text style={s.subGreeting}>What are you looking for today?</Text>
            )}
          </View>
          <TouchableOpacity
            style={s.profileBtn}
            onPress={() => router.replace("/(select-profile)")}
          >
            <Text style={s.profileEmoji}>👤</Text>
          </TouchableOpacity>
        </View>

        {/* ── Mode toggle: For You / For Your Child ── */}
        <View style={s.modeToggleRow}>
          <TouchableOpacity
            style={[s.modeBtn, mode === 'forYou' && s.modeBtnActive]}
            onPress={() => setMode('forYou')}
          >
            <Text style={[s.modeBtnText, mode === 'forYou' && s.modeBtnTextActive]}>
              For You
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.modeBtn, mode === 'forChild' && s.modeBtnActive]}
            onPress={() => setMode('forChild')}
          >
            <Text style={[s.modeBtnText, mode === 'forChild' && s.modeBtnTextActive]}>
              🧒 For Your Child
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── Search bar (only in For You mode) ── */}
        {mode === 'forYou' && (
        <View style={s.searchWrap}>
          <MaterialIcons name="search" size={18} color={Colors.textMuted} style={s.searchIcon} />
          <TextInput
            style={s.searchInput}
            placeholder="Search by title, author, or keywords…"
            placeholderTextColor={Colors.textMuted}
            value={query}
            onChangeText={setQuery}
            autoCorrect={false}
            returnKeyType="search"
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery("")}>
              <Text style={s.clearBtn}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
        )}

        {mode === 'forYou' && (
          <View style={s.catalogQuickRow}>
            <TouchableOpacity style={s.catalogQuickBtn} onPress={() => router.push('/(user)/authors')}>
              <Text style={s.catalogQuickTitle}>Author Explorer</Text>
              <Text style={s.catalogQuickSub}>Open profiles & works</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.catalogQuickBtn} onPress={() => router.push('/(user)/publishers')}>
              <Text style={s.catalogQuickTitle}>Publisher Explorer</Text>
              <Text style={s.catalogQuickSub}>Open catalog lookup</Text>
            </TouchableOpacity>
          </View>
        )}

        {mode === 'forChild' ? (
          /* ── FOR YOUR CHILD view ── */
          <View>
            {childProfiles.length === 0 ? (
              <View style={[s.section, { paddingTop: Spacing.xl }]}>
                <Text style={{ fontSize: Typography.body, color: Colors.textMuted, textAlign: 'center' }}>
                  No child profiles yet.{'\n'}Add a child profile to manage their reading.
                </Text>
                <TouchableOpacity
                  style={[s.btnPrimary2, { marginTop: Spacing.lg }]}
                  onPress={() => router.replace('/(select-profile)')}
                >
                  <Text style={s.btnPrimary2Text}>+ Add Child Profile</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View>
                {/* Child selector pills */}
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: Spacing.sm, paddingHorizontal: Spacing.xl, paddingBottom: Spacing.md }}
                >
                  {childProfiles.map((child, idx) => {
                    const isSelected = selectedChildId === child.profileId || (selectedChildId === null && idx === 0);
                    return (
                      <TouchableOpacity
                        key={child.profileId}
                        style={[s.childChip, isSelected && s.childChipActive]}
                        onPress={() => setSelectedChildId(child.profileId)}
                      >
                        <Text style={[s.childChipText, isSelected && s.childChipTextActive]}>
                          🧒 {child.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                {/* Track child reading */}
                <View style={[s.section, { paddingTop: 0 }]}>
                  <SectionHeader title="Track My Child's Reading" />
                  <TouchableOpacity
                    style={s.trackBanner}
                    onPress={() => {
                      const child = childProfiles.find(c => c.profileId === selectedChildId) ?? childProfiles[0];
                      if (child) router.push(`/(user)/child-progress/${child.profileId}`);
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={s.trackBannerTitle}>Reading progress</Text>
                      <Text style={s.trackBannerSub}>
                        {childBooksRead} book{childBooksRead !== 1 ? 's' : ''} borrowed
                        {'  ·  '}
                        {getQuizzesPassed(selectedChildId ?? childProfiles[0]?.profileId ?? '')} quiz{getQuizzesPassed(selectedChildId ?? childProfiles[0]?.profileId ?? '') !== 1 ? 'zes' : ''} passed
                      </Text>
                    </View>
                    <Text style={s.trackBannerArrow}>→</Text>
                  </TouchableOpacity>
                </View>

                {/* Child's books catalog */}
                <View style={s.section}>
                  <SectionHeader title="Books for Your Child" />

                  {/* Genre pills */}
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ gap: Spacing.xs, paddingBottom: Spacing.md }}
                  >
                    {GENRES.map(g => (
                      <TouchableOpacity
                        key={g}
                        style={[
                          s.genrePill,
                          childGenre === g && s.genrePillActive,
                        ]}
                        onPress={() => setChildGenre(g)}
                      >
                        <Text style={[s.genrePillText, childGenre === g && s.genrePillTextActive]}>{g}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>

                  {loading ? (
                    <ActivityIndicator size="small" color={Colors.accentSage} style={{ marginTop: Spacing.md }} />
                  ) : (() => {
                    const childBooks = childGenre === 'All'
                      ? allBooks
                      : allBooks.filter(b => b.genres.includes(childGenre));
                    return childBooks.length === 0 ? (
                      <Text style={s.empty}>No books found for this age group.</Text>
                    ) : (
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={{ gap: Spacing.md, paddingBottom: Spacing.sm }}
                      >
                        {childBooks.slice(0, 10).map(b => (
                          <HorizBookCard
                            key={b.id}
                            book={b}
                            onPress={() => router.push(`/(user)/book/${b.id}`)}
                          />
                        ))}
                      </ScrollView>
                    );
                  })()}
                </View>

                {/* Navigate to full child interface */}
                <View style={s.section}>
                  <SectionHeader title="Child's Reading Space" />
                  <TouchableOpacity
                    style={s.trackBanner}
                    onPress={() => {
                      const child = childProfiles.find(c => c.profileId === selectedChildId) ?? childProfiles[0];
                      router.replace(child
                        ? { pathname: '/(child)', params: { viewingChildId: child.profileId } }
                        : '/(child)'
                      );
                    }}
                  >
                    <Text style={s.trackBannerEmoji}>🧒</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={s.trackBannerTitle}>Switch to child view</Text>
                      <Text style={s.trackBannerSub}>Browse &amp; read books for your child</Text>
                    </View>
                    <Text style={s.trackBannerArrow}>→</Text>
                  </TouchableOpacity>
                  {/* Delete child profile */}
                  <TouchableOpacity
                    style={[s.trackBanner, { marginTop: Spacing.sm, borderColor: Colors.error }]}
                    onPress={handleDeleteProfile}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[s.trackBannerTitle, { color: Colors.error }]}>Manage child profiles</Text>
                      <Text style={s.trackBannerSub}>Edit or remove a child profile</Text>
                    </View>
                    <Text style={s.trackBannerArrow}>→</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
            <View style={{ height: Spacing.xxl }} />
          </View>
        ) : (
          /* ── FOR YOU (adult) view ── */
        loading && !searching ? (
          <ActivityIndicator
            size="large"
            color={Colors.accentSage}
            style={{ marginTop: 40 }}
          />
        ) : searching ? (
          <View style={s.section}>
            <SectionHeader title={`Results (${searchResults.length})`} />
            {searchResults.length === 0 ? (
              <Text style={s.empty}>
                No books found for &quot;{query}&quot;.
              </Text>
            ) : (
              searchResults.map((b) => (
                <SearchRow
                  key={b.id}
                  book={b}
                  onPress={() => router.push(`/(user)/book/${b.id}`)}
                />
              ))
            )}
          </View>
        ) : (
          <>
            {/* ── Active order pill ── */}
            {activeIssues.length > 0 && activeIssues[0].type === "PHYSICAL" && (
              <TouchableOpacity
                style={s.orderBanner}
                onPress={() =>
                  router.push(`/(user)/track/${activeIssues[0]._id}`)
                }
              >
                <Text style={s.orderBannerIcon}>📦</Text>
                <View style={{ flex: 1 }}>
                  <Text style={s.orderBannerTitle}>Order in progress</Text>
                  <Text style={s.orderBannerSub}>
                    {activeIssues[0].copyId?.bookId?.title ||
                      activeIssues[0].bookId?.title ||
                      "Book"}{" "}
                    · Tracking
                  </Text>
                </View>
                <Text style={s.orderBannerArrow}>→</Text>
              </TouchableOpacity>
            )}

            {/* ── Owl's LangChain Smart Picks ── */}
            {(smartRecommendations.length > 0 || smartLoading) && (
              <View style={s.section}>
                <SectionHeader title="🦉 Owl's Smart Picks" />
                    {smartRecommendations.length === 0 && smartLoading ? (
                      <ActivityIndicator size="small" color={Colors.accentSage} />
                    ) : (
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={{ gap: Spacing.md }}
                      >
                        {smartRecommendations.slice(0, 10).map((b) => (
                          <HorizBookCard
                            key={b.id}
                            book={b}
                            onPress={() => router.push(`/(user)/book/${b.id}`)}
                          />
                        ))}
                      </ScrollView>
                    )}
              </View>
            )}

            {/* ── Based on Your Preferences ── */}
            {recommended.length > 0 && (
              <View style={s.section}>
                <SectionHeader title="⭐ Based on Your Preferences" />
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: Spacing.md }}
                >
                  {recommended.slice(0, 10).map((b) => (
                    <HorizBookCard
                      key={b.id}
                      book={b}
                      onPress={() => router.push(`/(user)/book/${b.id}`)}
                    />
                  ))}
                </ScrollView>
              </View>
            )}

            {/* ── New Arrivals ── */}
            {newArrivals.length > 0 && (
              <View style={s.section}>
                <SectionHeader title="🆕 New Arrivals" />
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: Spacing.md }}
                >
                  {newArrivals.slice(0, 10).map((b) => (
                    <HorizBookCard
                      key={b.id}
                      book={b}
                      onPress={() => router.push(`/(user)/book/${b.id}`)}
                    />
                  ))}
                </ScrollView>
              </View>
            )}

            {/* ── Genre carousels (Netflix-style) ── */}
            {GENRES.filter(g => g !== "All").map((genre) => {
              const books = allBooks.filter(b => b.genres.includes(genre));
              if (books.length === 0) return null;
              return (
                <View key={genre} style={s.section}>
                  <SectionHeader title={`📚 ${genre}`} />
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ gap: Spacing.md }}
                  >
                    {books.slice(0, 10).map((b) => (
                      <HorizBookCard
                        key={b.id}
                        book={b}
                        onPress={() => router.push(`/(user)/book/${b.id}`)}
                      />
                    ))}
                  </ScrollView>
                </View>
              );
            })}

            {/* ── My Orders ── */}
            <TouchableOpacity
              style={s.myBooksBanner}
              onPress={() => router.push("/(user)/my-books")}
            >
              <Text style={s.myBooksText}>
                My orders & borrowing history →
              </Text>
            </TouchableOpacity>


          </>
        )
        )}

        <View style={{ height: Spacing.xxl }} />
      </ScrollView>

      {Platform.OS !== 'web' && <NavBar role="user" active="home" />}

      {/* ── Chatbot FAB ── */}
      <TouchableOpacity 
        style={{
          position: 'absolute', bottom: Platform.OS !== 'web' ? 100 : 28, right: 24,
          backgroundColor: Colors.accentSage,
          borderRadius: Radius.full,
          paddingVertical: 12, paddingHorizontal: 18,
          flexDirection: 'row', alignItems: 'center', gap: 6,
          boxShadow: '0px 4px 12px rgba(74, 124, 89, 0.4)', elevation: 8
        }} 
        activeOpacity={0.85}
        onPress={() => router.push('/(user)/owl')}
      >
        <Text style={{ fontSize: 22 }}>🦉</Text>
        <Text style={{ fontSize: Typography.label + 1, fontWeight: '800', color: Colors.textOnDark }}>Ask Owl</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  scroll: { paddingBottom: NAV_BOTTOM_PAD + Spacing.xl },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.md,
  },
  greeting: {
    fontSize: Typography.title + 2,
    fontWeight: "800",
    color: Colors.accentSage,
  },
  subGreeting: {
    fontSize: Typography.body,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  profileBtn: {
    width: 48,
    height: 48,
    borderRadius: Radius.full,
    backgroundColor: Colors.card,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: Colors.cardBorder,
  },
  profileEmoji: { fontSize: 22 },

  branchPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.full,
    marginRight: 6,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    minWidth: 88,
  },
  branchPillActive: {
    backgroundColor: Colors.accentSage,
    borderColor: Colors.accentSage,
  },
  branchPillName: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  branchPillNameActive: {
    color: Colors.textOnDark,
  },
  branchPillDistance: {
    fontSize: 10,
    marginTop: 1,
    color: Colors.textMuted,
    opacity: 0.6,
  },
  branchPillDistanceActive: {
    color: Colors.textOnDark,
    opacity: 0.75,
  },

  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.card,
    borderRadius: Radius.full,
    marginHorizontal: Spacing.xl,
    marginBottom: Spacing.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    borderWidth: 1.5,
    borderColor: Colors.cardBorder,
    gap: Spacing.sm,
  },
  searchIcon: { marginRight: 2 },
  searchInput: {
    flex: 1,
    fontSize: Typography.body,
    color: Colors.textPrimary,
  },
  clearBtn: {
    fontSize: 14,
    color: Colors.textMuted,
    fontWeight: "700",
    paddingHorizontal: 4,
  },

  catalogQuickRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.xl,
    marginBottom: Spacing.lg,
  },
  catalogQuickBtn: {
    flex: 1,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    gap: 3,
  },
  catalogQuickTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.body,
    fontWeight: '700',
  },
  catalogQuickSub: {
    color: Colors.textSecondary,
    fontSize: Typography.label,
  },

  section: { paddingHorizontal: Spacing.xl, marginBottom: Spacing.xl },
  empty: {
    fontSize: Typography.body,
    color: Colors.textMuted,
    textAlign: "center",
    paddingVertical: Spacing.xl,
  },

  orderBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.accentSage,
    borderRadius: Radius.lg,
    marginHorizontal: Spacing.xl,
    marginBottom: Spacing.xl,
    padding: Spacing.md,
    gap: Spacing.md,
  },
  orderBannerIcon: { fontSize: 24 },
  orderBannerTitle: {
    fontSize: Typography.body,
    fontWeight: "800",
    color: Colors.textOnDark,
  },
  orderBannerSub: {
    fontSize: Typography.label,
    color: "#C5DDB8",
    marginTop: 2,
  },
  orderBannerArrow: {
    fontSize: 20,
    color: Colors.textOnDark,
    fontWeight: "700",
  },

  genrePill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: Radius.full,
    backgroundColor: Colors.card,
    borderWidth: 1.5,
    borderColor: Colors.cardBorder,
  },
  genrePillActive: {
    backgroundColor: Colors.accentSage,
    borderColor: Colors.accentSage,
  },
  genrePillText: {
    fontSize: Typography.label,
    fontWeight: "600",
    color: Colors.textSecondary,
  },
  genrePillTextActive: { color: Colors.textOnDark },

  myBooksBanner: {
    marginHorizontal: Spacing.xl,
    backgroundColor: Colors.readSurface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  myBooksText: {
    fontSize: Typography.body,
    fontWeight: "700",
    color: Colors.textPrimary,
  },

  // Mode toggle
  modeToggleRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.xl,
    marginBottom: Spacing.md,
  },
  modeBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: Radius.full,
    backgroundColor: Colors.card,
    borderWidth: 1.5,
    borderColor: Colors.cardBorder,
    alignItems: 'center',
  },
  modeBtnActive: {
    backgroundColor: Colors.accentSage,
    borderColor: Colors.accentSage,
  },
  modeBtnText: {
    fontSize: Typography.label,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  modeBtnTextActive: { color: Colors.textOnDark },

  // Child view
  childChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: Radius.full,
    backgroundColor: Colors.card,
    borderWidth: 1.5,
    borderColor: Colors.cardBorder,
  },
  childChipActive: {
    backgroundColor: Colors.childTint,
    borderColor: Colors.accentPeriwinkle,
  },
  childChipText: {
    fontSize: Typography.label,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  childChipTextActive: { color: Colors.accentPeriwinkle },

  trackBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 1.5,
    borderColor: Colors.cardBorder,
    gap: Spacing.md,
    marginBottom: Spacing.sm,
  },
  trackBannerEmoji: { fontSize: 24 },
  trackBannerTitle: {
    fontSize: Typography.body,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  trackBannerSub: {
    fontSize: Typography.label,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  trackBannerArrow: {
    fontSize: 20,
    color: Colors.textMuted,
    fontWeight: '700',
  },

  btnPrimary2: {
    backgroundColor: Colors.buttonPrimary,
    borderRadius: Radius.full,
    paddingVertical: 14,
    alignItems: 'center',
    marginHorizontal: Spacing.xl,
  },
  btnPrimary2Text: {
    fontSize: Typography.body,
    fontWeight: '800',
    color: Colors.buttonPrimaryText,
  },


  // Hamburger menu modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "flex-start",
    alignItems: "flex-start",
    paddingTop: 80,
    paddingLeft: Spacing.xl,
  },

  // Delete profile modal
  deleteOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.xl,
  },
  deleteCard: {
    backgroundColor: Colors.card,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    width: "100%",
    maxWidth: 360,
    borderWidth: 1.5,
    borderColor: Colors.cardBorder,
  },
  deleteTitle: {
    fontSize: Typography.title,
    fontWeight: "800",
    color: Colors.textPrimary,
    textAlign: "center",
  },
  deleteSubtitle: {
    fontSize: Typography.label,
    color: Colors.textSecondary,
    textAlign: "center",
    marginTop: 4,
  },
  deleteProfileCard: {
    flex: 1,
    backgroundColor: Colors.background,
    borderRadius: Radius.xl,
    padding: Spacing.md,
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: Colors.error,
    gap: 4,
  },
  deleteAvatar: {
    width: 56,
    height: 56,
    borderRadius: Radius.full,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  deleteAvatarEmoji: { fontSize: 28 },
  deleteProfileName: {
    fontSize: Typography.body,
    fontWeight: "700",
    color: Colors.textPrimary,
    textAlign: "center",
  },
  deleteAgeBadge: {
    backgroundColor: Colors.browseSurface,
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 2,
  },
  deleteAgeBadgeText: {
    fontSize: 11,
    fontWeight: "600",
    color: Colors.accentPeriwinkle,
  },
  deleteCancelBtn: {
    paddingVertical: 12,
    borderRadius: Radius.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.cardBorder,
    marginTop: 4,
  },
  deleteCancelText: {
    fontSize: Typography.body,
    fontWeight: "600",
    color: Colors.textSecondary,
    textAlign: "center",
  },
  menuCard: {
    backgroundColor: Colors.card,
    borderRadius: Radius.xl,
    padding: Spacing.md,
    minWidth: 220,
    borderWidth: 1.5,
    borderColor: Colors.cardBorder,
    gap: Spacing.xs,
  },
  menuTitle: {
    fontSize: Typography.label,
    fontWeight: "700",
    color: Colors.textMuted,
    paddingHorizontal: Spacing.sm,
    paddingBottom: 4,
  },
  menuItem: {
    paddingVertical: 12,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.lg,
  },
  menuItemText: {
    fontSize: Typography.body,
    fontWeight: "700",
    color: Colors.textPrimary,
  },
  menuCancel: {
    paddingVertical: 12,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.cardBorder,
  },
  menuCancelText: {
    fontSize: Typography.body,
    fontWeight: "600",
    color: Colors.textSecondary,
    textAlign: "center",
  },
});
