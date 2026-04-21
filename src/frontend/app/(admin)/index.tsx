import { API_BASE_URL } from "@/constants/config";
import { Colors, Radius, Spacing, Typography } from "@/constants/theme";
import useAppStore from "@/store/useAppStore";
import { filterBooksWithCovers } from "@/utils/bookFilters";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    KeyboardAvoidingView,
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

const { width } = Dimensions.get("window");

const STAT_TINTS = [
  Colors.accentSageLight,
  Colors.browseSurface,
  Colors.buttonPrimary,
  "#E8F5E9",
];

function BarChart({ data }: { data: { month: string; val: number }[] }) {
  const maxBar = Math.max(...data.map((m) => m.val), 1); // fallback to 1 to avoid div by 0

  return (
    <View style={bc.wrap}>
      {data.map(({ month, val }) => (
        <View key={month} style={bc.col}>
          <Text style={bc.valLabel}>{val}</Text>
          <View style={bc.barBg}>
            <View style={[bc.bar, { height: `${(val / maxBar) * 100}%` }]} />
          </View>
          <Text style={bc.monthLabel}>{month}</Text>
        </View>
      ))}
    </View>
  );
}
const bc = StyleSheet.create({
  wrap: { flexDirection: "row", alignItems: "flex-end", gap: 8, height: 120 },
  col: { flex: 1, alignItems: "center", gap: 4 },
  valLabel: { fontSize: 10, fontWeight: "700", color: Colors.textMuted },
  barBg: {
    width: "100%",
    flex: 1,
    backgroundColor: Colors.cardBorder,
    borderRadius: 4,
    justifyContent: "flex-end",
    overflow: "hidden",
  },
  bar: { backgroundColor: Colors.accentSage, borderRadius: 4 },
  monthLabel: { fontSize: 10, color: Colors.textSecondary, fontWeight: "600" },
});

type Tab = "overview" | "branches" | "add" | "books";

export default function AdminDashboard() {
  const router = useRouter();
  const { clearAuth, token } = useAppStore();
  const [tab, setTab] = useState<Tab>("overview");
  const [menuVisible, setMenuVisible] = useState(false);
  const [branchForm, setBranchForm] = useState({
    name: "",
    address: "",
    lat: "",
    lng: "",
    radius: "",
  });
  const [saving, setSaving] = useState(false);
  const [rawBranches, setRawBranches] = useState<any[]>([]);
  const [rawIssues, setRawIssues] = useState<any[]>([]);
  const [chartData, setChartData] = useState<{ month: string; val: number }[]>(
    [],
  );
  const [topBranch, setTopBranch] = useState<any>(null);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [allAdminBooks, setAllAdminBooks] = useState<any[]>([]);
  const [bookSearchQuery, setBookSearchQuery] = useState("");
  const [deletingBookId, setDeletingBookId] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
    if (tab === "books") fetchAdminBooks();
  }, [tab]);

  const fetchAdminBooks = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/books?limit=200`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      setAllAdminBooks(filterBooksWithCovers(json.data?.books || []));
    } catch (err) {
      console.warn("Failed to fetch books for admin", err);
    }
  };

  const handleDeleteBook = (bookId: string, bookTitle: string) => {
    const doDelete = async () => {
      setDeletingBookId(bookId);
      try {
        const res = await fetch(`${API_BASE_URL}/books/${bookId}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          const json = await res.json().catch(() => ({}));
          throw new Error(json.message ?? "Failed to delete book");
        }
        setAllAdminBooks((prev) => prev.filter((b) => b._id !== bookId));
        if (Platform.OS === "web") {
          window.alert(`"${bookTitle}" has been deleted.`);
        } else {
          Alert.alert("Deleted", `"${bookTitle}" has been deleted.`);
        }
      } catch (err: any) {
        if (Platform.OS === "web") {
          window.alert(err.message ?? "Failed to delete book.");
        } else {
          Alert.alert("Error", err.message ?? "Failed to delete book.");
        }
      } finally {
        setDeletingBookId(null);
      }
    };

    if (Platform.OS === "web") {
      if (window.confirm(`Delete "${bookTitle}"? This cannot be undone.`)) doDelete();
    } else {
      Alert.alert(
        "Delete Book",
        `Delete "${bookTitle}"? This cannot be undone and removes all copies.`,
        [
          { text: "Cancel", style: "cancel" },
          { text: "Delete", style: "destructive", onPress: doDelete },
        ]
      );
    }
  };

  const fetchData = async () => {
    try {
      const branchRes = await fetch(`${API_BASE_URL}/libraries`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const branchJson = await branchRes.json();
      setRawBranches(branchJson.data?.libraries || []);

      const issueRes = await fetch(`${API_BASE_URL}/issues`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const issueJson = await issueRes.json();
      const issues = issueJson.data?.issues || [];
      setRawIssues(issues);

      processStats(issues, branchJson.data?.libraries || []);
    } catch (err) {
      console.warn("Failed to fetch admin data", err);
    }
  };

  const processStats = (issues: any[], libraries: any[]) => {
    const now = new Date();
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(now.getMonth() - 5);
    sixMonthsAgo.setDate(1);

    const monthNames = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];

    // 1. Chart Data (Last 6 Months)
    const monthlyCounts: Record<string, number> = {};
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      monthlyCounts[`${monthNames[d.getMonth()]}`] = 0;
    }

    issues.forEach((issue) => {
      const d = new Date(issue.issueDate);
      if (d >= sixMonthsAgo) {
        const m = monthNames[d.getMonth()];
        if (monthlyCounts[m] !== undefined) {
          monthlyCounts[m]++;
        }
      }
    });

    setChartData(
      Object.keys(monthlyCounts).map((k) => ({
        month: k,
        val: monthlyCounts[k],
      })),
    );

    // 2. Top Branch This Month
    const currentMonthIssues = issues.filter((i) => {
      const d = new Date(i.issueDate);
      return (
        d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
      );
    });

    const branchStats: Record<string, { issued: number; revenue: number }> = {};
    currentMonthIssues.forEach((i) => {
      const bId = i.copyId?.branchId?._id;
      if (bId) {
        if (!branchStats[bId]) branchStats[bId] = { issued: 0, revenue: 0 };
        branchStats[bId].issued++;
        if (i.type === "PHYSICAL") branchStats[bId].revenue += 20;
      }
    });

    let bestBranchId: string | null = null;
    let maxIssues = -1;
    let bestRev = 0;
    Object.keys(branchStats).forEach((bId) => {
      if (branchStats[bId].issued > maxIssues) {
        maxIssues = branchStats[bId].issued;
        bestRev = branchStats[bId].revenue;
        bestBranchId = bId;
      }
    });

    const bestBranch = libraries.find((l: any) => l._id === bestBranchId);
    if (bestBranch) {
      setTopBranch({
        name: bestBranch.name,
        issued: maxIssues,
        revenue: bestRev,
        books: 0, // Mocked for now or can compute inventory later
      });
    }

    // 3. Recent Activity (Latest 4 issues)
    const recent = issues.slice(0, 4).map((i) => {
      const bName = i.copyId?.branchId?.name || "Library";
      let msg = "";
      let icon = "";
      if (i.status === "ISSUED") {
        icon = "📤";
        msg = `${bName}: Book issued`;
      } else if (i.status === "RETURNED") {
        icon = "📥";
        msg = `${bName}: Book returned`;
      } else if (i.status === "OVERDUE") {
        icon = "⚠️";
        msg = `${bName}: Overdue book`;
      }

      return {
        icon,
        msg,
        time: new Date(i.issueDate).toLocaleDateString(),
      };
    });
    setRecentActivity(recent);
  };

  const BRANCHES = rawBranches.map((b) => {
    const branchIssues = rawIssues.filter(
      (i) => i.copyId?.branchId?._id === b._id,
    );
    const rev = branchIssues.filter((i) => i.type === "PHYSICAL").length * 20;

    return {
      id: b._id,
      name: b.name,
      books: 0,
      issued: branchIssues.length,
      members: Array.from(new Set(branchIssues.map((i) => i.userId?._id)))
        .length,
      revenue: rev,
      active: b.status === "ACTIVE",
    };
  });

  const uniqueMembers = Array.from(
    new Set(rawIssues.map((i) => i.userId?._id)),
  ).length;
  const currentMonthIssues = rawIssues.filter((i) => {
    const d = new Date(i.issueDate);
    const now = new Date();
    return (
      d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    );
  });
  const monthRev =
    currentMonthIssues.filter((i) => i.type === "PHYSICAL").length * 20;

  const STAT_CARDS = [
    {
      label: "Total Branches",
      value: String(BRANCHES.length),
      icon: "🏛️",
      tint: STAT_TINTS[0],
    },
    {
      label: "Active Members",
      value: String(uniqueMembers),
      icon: "👥",
      tint: STAT_TINTS[1],
    },
    {
      label: "Books Issued",
      value: String(rawIssues.length),
      icon: "📤",
      tint: STAT_TINTS[2],
    },
    {
      label: "This Month's Rev",
      value: `₹${monthRev}`,
      icon: "💰",
      tint: STAT_TINTS[3],
    },
  ];

  const setBF = (key: string, val: string) =>
    setBranchForm((f) => ({ ...f, [key]: val }));

  const handleAddBranch = async () => {
    if (!branchForm.name.trim() || !branchForm.address.trim()) {
      Alert.alert("Missing fields", "Branch Name and Address are required.");
      return;
    }
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        name: branchForm.name.trim(),
        address: branchForm.address.trim(),
        serviceRadiusKm: branchForm.radius ? parseFloat(branchForm.radius) : 8,
      };
      if (branchForm.lat && branchForm.lng) {
        body.location = {
          type: "Point",
          coordinates: [parseFloat(branchForm.lng), parseFloat(branchForm.lat)],
        };
      }
      const res = await fetch(`${API_BASE_URL}/libraries`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "Failed to add branch");
      Alert.alert(
        "✅ Branch registered!",
        `"${branchForm.name}" has been added.`,
      );
      setBranchForm({ name: "", address: "", lat: "", lng: "", radius: "" });
      fetchData();
    } catch (err: any) {
      Alert.alert("Error", err.message ?? "Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = async () => {
    setMenuVisible(false);
    await clearAuth();
    router.replace("/(auth)/welcome");
  };

  const tabs: { id: Tab; label: string; emoji: string }[] = [
    { id: "overview", label: "Overview", emoji: "📊" },
    { id: "branches", label: "Branches", emoji: "🏛️" },
    { id: "books", label: "Books", emoji: "📚" },
    { id: "add", label: "Add Branch", emoji: "➕" },
  ];

  return (
    <SafeAreaView style={s.safe}>
      {/* Sign-out menu modal */}
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
                router.push("/(admin)/manage-library");
              }}
            >
              <Text style={s.menuItemText}>Manage Library</Text>
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

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.scroll}
      >
        {/* Header */}
        <View style={s.header}>
          <View>
            <Text style={s.title}>Admin Dashboard</Text>
            <Text style={s.subtitle}>City Libraries · March 2026</Text>
          </View>
          <TouchableOpacity
            style={s.profileBtn}
            onPress={() => setMenuVisible(true)}
          >
            <Text>🏛️</Text>
          </TouchableOpacity>
        </View>

        {/* Stat cards */}
        <View style={s.statsGrid}>
          {STAT_CARDS.map((stat) => (
            <View
              key={stat.label}
              style={[s.statCard, { backgroundColor: stat.tint }]}
            >
              <Text style={s.statIcon}>{stat.icon}</Text>
              <Text style={s.statValue}>{stat.value}</Text>
              <Text style={s.statLabel}>{stat.label}</Text>
            </View>
          ))}
        </View>

        {/* Tabs */}
        <View style={s.tabRow}>
          {tabs.map((t) => (
            <TouchableOpacity
              key={t.id}
              style={[s.tabBtn, tab === t.id && s.tabBtnActive]}
              onPress={() => setTab(t.id)}
            >
              <Text style={[s.tabText, tab === t.id && s.tabTextActive]}>
                {t.emoji} {t.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {tab === "overview" && (
          <View style={s.section}>
            {/* Issues per month chart */}
            <Text style={s.sectionTitle}>Books Issued — Last 6 Months</Text>
            <View style={s.chartCard}>
              <BarChart data={chartData} />
            </View>

            {/* Top performing branch */}
            {topBranch && (
              <>
                <Text style={[s.sectionTitle, { marginTop: Spacing.lg }]}>
                  Top Branch This Month
                </Text>
                <View style={s.topBranchCard}>
                  <Text style={s.topBranchName}>{topBranch.name}</Text>
                  <View style={s.topBranchStats}>
                    <View style={s.topStat}>
                      <Text style={s.topStatVal}>{topBranch.books}</Text>
                      <Text style={s.topStatLabel}>Books</Text>
                    </View>
                    <View style={s.topStat}>
                      <Text style={s.topStatVal}>{topBranch.issued}</Text>
                      <Text style={s.topStatLabel}>Issued</Text>
                    </View>
                    <View style={s.topStat}>
                      <Text style={s.topStatVal}>₹{topBranch.revenue}</Text>
                      <Text style={s.topStatLabel}>Revenue</Text>
                    </View>
                  </View>
                </View>
              </>
            )}

            {/* Recent activity */}
            {recentActivity.length > 0 && (
              <>
                <Text style={[s.sectionTitle, { marginTop: Spacing.lg }]}>
                  Recent Activity
                </Text>
                {recentActivity.map((a, i) => (
                  <View key={i} style={s.activityRow}>
                    <Text style={s.activityIcon}>{a.icon}</Text>
                    <Text style={s.activityMsg}>{a.msg}</Text>
                    <Text style={s.activityTime}>{a.time}</Text>
                  </View>
                ))}
              </>
            )}
          </View>
        )}

        {tab === "branches" && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>All Branches ({BRANCHES.length})</Text>
            {BRANCHES.map((b) => (
              <View
                key={b.id}
                style={[s.branchCard, !b.active && s.branchCardInactive]}
              >
                <View style={s.branchHeader}>
                  <Text style={s.branchName}>{b.name}</Text>
                  <View
                    style={[
                      s.activePill,
                      { backgroundColor: b.active ? "#E8F5E9" : "#FDE8E8" },
                    ]}
                  >
                    <Text
                      style={[
                        s.activePillText,
                        { color: b.active ? Colors.success : Colors.error },
                      ]}
                    >
                      {b.active ? "● Active" : "● Inactive"}
                    </Text>
                  </View>
                </View>
                <View style={s.branchStats}>
                  {[
                    ["📚", `${b.books} books`],
                    ["📤", `${b.issued} issued`],
                    ["👥", `${b.members} members`],
                    ["💰", `₹${b.revenue}`],
                  ].map(([icon, val]) => (
                    <View key={val} style={s.branchStat}>
                      <Text style={s.branchStatIcon}>{icon}</Text>
                      <Text style={s.branchStatVal}>{val}</Text>
                    </View>
                  ))}
                </View>
                <TouchableOpacity style={s.manageBranchBtn}>
                  <Text style={s.manageBranchText}>Manage →</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {tab === "books" && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Manage Books ({allAdminBooks.length})</Text>
            <TextInput
              style={[s.fieldInput, { marginBottom: Spacing.md }]}
              placeholder="Search books…"
              placeholderTextColor={Colors.textMuted}
              value={bookSearchQuery}
              onChangeText={setBookSearchQuery}
              autoCorrect={false}
            />
            {allAdminBooks
              .filter(b =>
                !bookSearchQuery.trim() ||
                b.title?.toLowerCase().includes(bookSearchQuery.toLowerCase()) ||
                b.author?.toLowerCase().includes(bookSearchQuery.toLowerCase())
              )
              .map((b) => (
                <View key={b._id} style={s.bookRow}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={s.bookRowTitle} numberOfLines={1}>{b.title}</Text>
                    <Text style={s.bookRowAuthor}>{b.author}</Text>
                    <Text style={s.bookRowGenre}>{(b.genre || []).join(" · ")}</Text>
                  </View>
                  <TouchableOpacity
                    style={[s.deleteBtn, deletingBookId === b._id && { opacity: 0.5 }]}
                    onPress={() => handleDeleteBook(b._id, b.title)}
                    disabled={deletingBookId === b._id}
                  >
                    {deletingBookId === b._id
                      ? <ActivityIndicator size="small" color="#fff" />
                      : <Text style={s.deleteBtnText}>🗑️ Delete</Text>
                    }
                  </TouchableOpacity>
                </View>
              ))
            }
            {allAdminBooks.length === 0 && (
              <Text style={s.sectionTitle}>No books found.</Text>
            )}
          </View>
        )}

        {tab === "add" && (
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
          >
            <View style={s.section}>
              <Text style={s.sectionTitle}>Register a New Branch</Text>
              <Text style={s.addDesc}>
                Adding a new library branch registers it in the system.
              </Text>
              {(
                [
                  {
                    key: "name",
                    label: "Branch Name *",
                    ph: "e.g. Jayanagar Branch",
                    kbType: "default",
                  },
                  {
                    key: "address",
                    label: "Address *",
                    ph: "Full street address",
                    kbType: "default",
                  },
                  {
                    key: "lat",
                    label: "Latitude",
                    ph: "12.9716",
                    kbType: "numeric",
                  },
                  {
                    key: "lng",
                    label: "Longitude",
                    ph: "77.5946",
                    kbType: "numeric",
                  },
                  {
                    key: "radius",
                    label: "Service Radius (km)",
                    ph: "8",
                    kbType: "numeric",
                  },
                ] as const
              ).map((f) => (
                <View key={f.key} style={{ gap: 5, marginBottom: Spacing.md }}>
                  <Text style={s.fieldLabel}>{f.label}</Text>
                  <TextInput
                    style={s.fieldInput}
                    placeholder={f.ph}
                    placeholderTextColor={Colors.textMuted}
                    value={branchForm[f.key]}
                    onChangeText={(v) => setBF(f.key, v)}
                    keyboardType={f.kbType as any}
                    returnKeyType="next"
                  />
                </View>
              ))}
              <TouchableOpacity
                style={[s.btnPrimary, saving && { opacity: 0.6 }]}
                activeOpacity={0.82}
                onPress={handleAddBranch}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color={Colors.buttonPrimaryText} />
                ) : (
                  <Text style={s.btnPrimaryText}>Register Branch</Text>
                )}
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        )}

        <View style={{ height: Spacing.xxl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.adminTint },
  scroll: { paddingBottom: Spacing.xl },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.md,
  },
  title: {
    fontSize: Typography.display,
    fontWeight: "800",
    color: Colors.accentSage,
  },
  subtitle: {
    fontSize: Typography.label,
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
    fontSize: 22,
  },

  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.xl,
    marginBottom: Spacing.lg,
  },
  statCard: {
    width: (width - Spacing.xl * 2 - Spacing.sm) / 2,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  statIcon: { fontSize: 28 },
  statValue: {
    fontSize: Typography.title + 4,
    fontWeight: "900",
    color: Colors.textPrimary,
  },
  statLabel: {
    fontSize: Typography.label - 1,
    color: Colors.textSecondary,
    fontWeight: "600",
    textAlign: "center",
  },

  tabRow: {
    flexDirection: "row",
    gap: Spacing.xs,
    paddingHorizontal: Spacing.xl,
    marginBottom: Spacing.lg,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: Radius.full,
    backgroundColor: Colors.card,
    borderWidth: 1.5,
    borderColor: Colors.cardBorder,
    alignItems: "center",
  },
  tabBtnActive: {
    backgroundColor: Colors.accentSage,
    borderColor: Colors.accentSage,
  },
  tabText: { fontSize: 11, fontWeight: "700", color: Colors.textSecondary },
  tabTextActive: { color: Colors.textOnDark },

  section: { paddingHorizontal: Spacing.xl },
  sectionTitle: {
    fontSize: Typography.body + 1,
    fontWeight: "800",
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
  },

  chartCard: {
    backgroundColor: Colors.card,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    marginBottom: Spacing.sm,
  },

  topBranchCard: {
    backgroundColor: Colors.accentSage,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  topBranchName: {
    fontSize: Typography.title,
    fontWeight: "800",
    color: Colors.textOnDark,
  },
  topBranchStats: { flexDirection: "row", gap: Spacing.lg },
  topStat: { alignItems: "center", gap: 2 },
  topStatVal: {
    fontSize: Typography.title,
    fontWeight: "900",
    color: Colors.textOnDark,
  },
  topStatLabel: {
    fontSize: Typography.label - 1,
    color: "#C5DDB8",
    fontWeight: "600",
  },

  activityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.cardBorder,
  },
  activityIcon: { fontSize: 18 },
  activityMsg: {
    flex: 1,
    fontSize: Typography.label,
    color: Colors.textPrimary,
    fontWeight: "600",
    lineHeight: 18,
  },
  activityTime: { fontSize: Typography.label - 1, color: Colors.textMuted },

  branchCard: {
    backgroundColor: Colors.card,
    borderRadius: Radius.xl,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    gap: Spacing.sm,
  },
  branchCardInactive: { opacity: 0.6 },
  branchHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  branchName: {
    fontSize: Typography.body + 1,
    fontWeight: "800",
    color: Colors.textPrimary,
  },
  activePill: {
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  activePillText: { fontSize: Typography.label - 1, fontWeight: "800" },
  branchStats: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm },
  branchStat: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Colors.background,
    borderRadius: Radius.md,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  branchStatIcon: { fontSize: 14 },
  branchStatVal: {
    fontSize: Typography.label,
    color: Colors.textPrimary,
    fontWeight: "700",
  },
  manageBranchBtn: {
    alignSelf: "flex-end",
    backgroundColor: Colors.accentSageLight,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
  },
  manageBranchText: {
    fontSize: Typography.label,
    fontWeight: "800",
    color: Colors.accentSage,
  },

  bookRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    gap: Spacing.sm,
  },
  bookRowTitle: {
    fontSize: Typography.body,
    fontWeight: "700",
    color: Colors.textPrimary,
  },
  bookRowAuthor: { fontSize: Typography.label, color: Colors.textSecondary },
  bookRowGenre: { fontSize: Typography.label - 1, color: Colors.textMuted },
  deleteBtn: {
    backgroundColor: Colors.error,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 8,
    minWidth: 80,
    alignItems: "center",
  },
  deleteBtnText: { fontSize: Typography.label, fontWeight: "800", color: "#fff" },

  addDesc: {
    fontSize: Typography.body,
    color: Colors.textSecondary,
    lineHeight: 22,
    marginBottom: Spacing.lg,
  },
  fieldLabel: {
    fontSize: Typography.label,
    fontWeight: "600",
    color: Colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  fieldInput: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
    borderWidth: 1.5,
    borderColor: Colors.cardBorder,
    fontSize: Typography.body,
    color: Colors.textPrimary,
  },
  btnPrimary: {
    backgroundColor: Colors.buttonPrimary,
    borderRadius: Radius.full,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: Spacing.sm,
  },
  btnPrimaryText: {
    fontSize: Typography.body,
    fontWeight: "800",
    color: Colors.buttonPrimaryText,
  },

  // Sign-out modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "flex-start",
    alignItems: "flex-end",
    paddingTop: 80,
    paddingRight: Spacing.xl,
  },
  menuCard: {
    backgroundColor: Colors.card,
    borderRadius: Radius.xl,
    padding: Spacing.md,
    minWidth: 200,
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
    color: Colors.error,
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
