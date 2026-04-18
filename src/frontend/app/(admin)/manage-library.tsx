import { API_BASE_URL } from "@/constants/config";
import { Colors, Radius, Spacing, Typography } from "@/constants/theme";
import useAppStore from "@/store/useAppStore";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    KeyboardAvoidingView,
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

interface LibraryBranch {
  _id: string;
  name: string;
  address: string;
  location?: {
    type: string;
    coordinates: number[];
  };
  librarian?: string;
  BranchMailId?: string;
  serviceRadiusKm: number;
  status: string;
  organizationId?: string;
}

// ── Branch Card ─────────────────────────────────────────────────────────────
function BranchCard({
  branch,
  onEdit,
}: {
  branch: LibraryBranch;
  onEdit: () => void;
}) {
  const isActive = branch.status === "ACTIVE";
  return (
    <View style={[s.branchCard, !isActive && { opacity: 0.6 }]}>
      <View style={s.branchHeader}>
        <Text style={s.branchName}>{branch.name}</Text>
        <View
          style={[
            s.statusPill,
            { backgroundColor: isActive ? "#E8F5E9" : "#FDE8E8" },
          ]}
        >
          <Text
            style={[
              s.statusText,
              { color: isActive ? Colors.success : Colors.error },
            ]}
          >
            {isActive ? "● Active" : "● Inactive"}
          </Text>
        </View>
      </View>
      <Text style={s.branchAddress}>{branch.address}</Text>
      <View style={s.branchMeta}>
        {branch.librarian && (
          <View style={s.metaChip}>
            <Text style={s.metaText}>👤 {branch.librarian}</Text>
          </View>
        )}
        {branch.BranchMailId && (
          <View style={s.metaChip}>
            <Text style={s.metaText}>✉️ {branch.BranchMailId}</Text>
          </View>
        )}
        <View style={s.metaChip}>
          <Text style={s.metaText}>📍 {branch.serviceRadiusKm} km</Text>
        </View>
      </View>
      <TouchableOpacity style={s.editBranchBtn} onPress={onEdit}>
        <Text style={s.editBranchText}>✏️ Edit Details →</Text>
      </TouchableOpacity>
    </View>
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────
export default function ManageLibraryScreen() {
  const router = useRouter();
  const { token, email, userId } = useAppStore();

  const [branches, setBranches] = useState<LibraryBranch[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<LibraryBranch | null>(null);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<"branches" | "org">("branches");

  // ── Editable branch form ──
  const [formName, setFormName] = useState("");
  const [formAddress, setFormAddress] = useState("");
  const [formLibrarian, setFormLibrarian] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formRadius, setFormRadius] = useState("");
  const [formStatus, setFormStatus] = useState("ACTIVE");
  const [formLat, setFormLat] = useState("");
  const [formLng, setFormLng] = useState("");

  // ── Org details ──
  const [orgName, setOrgName] = useState("");
  const [orgAdmin, setOrgAdmin] = useState("");
  const [orgEmail, setOrgEmail] = useState("");
  const [orgId, setOrgId] = useState("");
  const [savingOrg, setSavingOrg] = useState(false);

  // ── Admin details (core user info) ──
  const [adminPhone, setAdminPhone] = useState("");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch branches
      const brRes = await fetch(`${API_BASE_URL}/libraries?includeInactive=true`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const brJson = await brRes.json();
      setBranches(brJson.data?.libraries || []);

      // Fetch user details (phone)
      const userRes = await fetch(`${API_BASE_URL}/users/${userId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const userJson = await userRes.json();
      if (userJson.data?.user?.phone) {
        setAdminPhone(userJson.data.user.phone);
      }

      // Fetch org if branches exist
      const libs: any[] = brJson.data?.libraries || [];
      if (libs.length > 0 && libs[0].organizationId) {
        try {
          const orgRes = await fetch(
            `${API_BASE_URL}/organizations/${libs[0].organizationId}`,
            {
              headers: { Authorization: `Bearer ${token}` },
            },
          );
          const orgJson = await orgRes.json();
          const org = orgJson.data?.organization;
          if (org) {
            setOrgName(org.name || "");
            setOrgAdmin(org.admin || "");
            setOrgEmail(org.AdminMailId || "");
            setOrgId(org._id || "");
          }
        } catch {
          /* org endpoint may not exist */
        }
      }
    } catch (err) {
      console.warn("Failed to fetch library data", err);
    } finally {
      setLoading(false);
    }
  };

  const startEdit = (branch: LibraryBranch) => {
    setEditing(branch);
    setFormName(branch.name);
    setFormAddress(branch.address);
    setFormLibrarian(branch.librarian || "");
    setFormEmail(branch.BranchMailId || "");
    setFormRadius(String(branch.serviceRadiusKm));
    setFormStatus(branch.status);
    setFormLat(branch.location?.coordinates?.[1]?.toString() || "");
    setFormLng(branch.location?.coordinates?.[0]?.toString() || "");
  };

  const handleSaveBranch = async () => {
    if (!formName.trim() || !formAddress.trim()) {
      Alert.alert("Missing fields", "Branch Name and Address are required.");
      return;
    }
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        name: formName.trim(),
        address: formAddress.trim(),
        serviceRadiusKm: formRadius ? parseFloat(formRadius) : 8,
        status: formStatus,
      };
      if (formLibrarian.trim()) body.librarian = formLibrarian.trim();
      if (formEmail.trim()) body.BranchMailId = formEmail.trim();
      if (formLat && formLng) {
        body.location = {
          type: "Point",
          coordinates: [parseFloat(formLng), parseFloat(formLat)],
        };
      }

      const res = await fetch(`${API_BASE_URL}/libraries/${editing?._id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "Failed to update branch");

      Alert.alert("✅ Updated", `"${formName}" has been updated.`);
      setEditing(null);
      fetchData();
    } catch (err: any) {
      Alert.alert("Error", err.message ?? "Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAdminDetails = async () => {
    setSaving(true);
    try {
      if (adminPhone.trim()) {
        await fetch(`${API_BASE_URL}/users/${userId}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ phone: adminPhone.trim() }),
        });
      }
      Alert.alert("✅ Saved", "Admin details updated.");
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to save.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={s.safe}>
        <ActivityIndicator
          size="large"
          color={Colors.accentSage}
          style={{ marginTop: 100 }}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={s.scroll}
        >
          {/* Header */}
          <View style={s.header}>
            <TouchableOpacity
              onPress={() => {
                if (editing) {
                  setEditing(null);
                } else {
                  router.back();
                }
              }}
            >
              <Text style={s.backBtn}>← Back</Text>
            </TouchableOpacity>
            <Text style={s.title}>
              {editing ? `Edit: ${editing.name}` : "Manage Library"}
            </Text>
            <View style={{ width: 60 }} />
          </View>

          {/* Tabs */}
          <View style={s.tabRow}>
            {[
              { id: "branches" as const, label: "🏛️ Branches" },
              { id: "org" as const, label: "⚙️ Admin & Org" },
            ].map((t) => (
              <TouchableOpacity
                key={t.id}
                style={[s.tabBtn, tab === t.id && s.tabBtnActive]}
                onPress={() => {
                  setTab(t.id);
                  setEditing(null);
                }}
              >
                <Text style={[s.tabText, tab === t.id && s.tabTextActive]}>
                  {t.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* ── Branches Tab ── */}
          {tab === "branches" && !editing && (
            <View style={s.section}>
              <Text style={s.sectionTitle}>
                All Branches ({branches.length})
              </Text>
              {branches.map((b) => (
                <BranchCard
                  key={b._id}
                  branch={b}
                  onEdit={() => startEdit(b)}
                />
              ))}
              {branches.length === 0 && (
                <Text style={s.emptyText}>No branches found.</Text>
              )}
            </View>
          )}

          {/* ── Edit Branch Form ── */}
          {tab === "branches" && editing && (
            <View style={s.section}>
              <View style={s.editHeader}>
                <Text style={s.sectionTitle}>Edit: {editing.name}</Text>
                <TouchableOpacity onPress={() => setEditing(null)}>
                  <Text style={s.cancelEdit}>✕ Cancel</Text>
                </TouchableOpacity>
              </View>

              {(
                [
                  {
                    key: "name",
                    label: "Branch Name *",
                    value: formName,
                    setter: setFormName,
                    kb: "default",
                  },
                  {
                    key: "address",
                    label: "Address *",
                    value: formAddress,
                    setter: setFormAddress,
                    kb: "default",
                  },
                  {
                    key: "librarian",
                    label: "Librarian Name",
                    value: formLibrarian,
                    setter: setFormLibrarian,
                    kb: "default",
                  },
                  {
                    key: "email",
                    label: "Branch Email",
                    value: formEmail,
                    setter: setFormEmail,
                    kb: "email-address",
                  },
                  {
                    key: "radius",
                    label: "Service Radius (km)",
                    value: formRadius,
                    setter: setFormRadius,
                    kb: "numeric",
                  },
                  {
                    key: "lat",
                    label: "Latitude",
                    value: formLat,
                    setter: setFormLat,
                    kb: "numeric",
                  },
                  {
                    key: "lng",
                    label: "Longitude",
                    value: formLng,
                    setter: setFormLng,
                    kb: "numeric",
                  },
                ] as const
              ).map((f) => (
                <View key={f.key} style={s.fieldGroup}>
                  <Text style={s.fieldLabel}>{f.label}</Text>
                  <TextInput
                    style={s.fieldInput}
                    value={f.value}
                    onChangeText={f.setter}
                    placeholderTextColor={Colors.textMuted}
                    keyboardType={f.kb as any}
                  />
                </View>
              ))}

              {/* Status toggle */}
              <View style={s.fieldGroup}>
                <Text style={s.fieldLabel}>Status</Text>
                <View style={{ flexDirection: "row", gap: Spacing.sm }}>
                  {(["ACTIVE", "INACTIVE"] as const).map((st) => (
                    <TouchableOpacity
                      key={st}
                      style={[
                        s.statusToggle,
                        formStatus === st && s.statusToggleActive,
                      ]}
                      onPress={() => setFormStatus(st)}
                    >
                      <Text
                        style={[
                          s.statusToggleText,
                          formStatus === st && s.statusToggleTextActive,
                        ]}
                      >
                        {st}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <TouchableOpacity
                style={[s.btnPrimary, saving && { opacity: 0.6 }]}
                activeOpacity={0.82}
                onPress={handleSaveBranch}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color={Colors.buttonPrimaryText} />
                ) : (
                  <Text style={s.btnPrimaryText}>💾 Save Branch</Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* ── Admin & Org Tab ── */}
          {tab === "org" && (
            <View style={s.section}>
              {/* Admin core details */}
              <Text style={s.sectionTitle}>👤 Admin Details</Text>

              <View style={s.fieldGroup}>
                <Text style={s.fieldLabel}>Email</Text>
                <View style={[s.fieldInput, s.fieldDisabled]}>
                  <Text style={s.fieldDisabledText}>{email}</Text>
                </View>
                <Text style={s.fieldHint}>Email cannot be changed</Text>
              </View>

              <View style={s.fieldGroup}>
                <Text style={s.fieldLabel}>Phone Number</Text>
                <TextInput
                  style={s.fieldInput}
                  value={adminPhone}
                  onChangeText={setAdminPhone}
                  placeholder="Enter phone number"
                  placeholderTextColor={Colors.textMuted}
                  keyboardType="phone-pad"
                />
              </View>

              <TouchableOpacity
                style={[s.btnSecondary, saving && { opacity: 0.6 }]}
                activeOpacity={0.82}
                onPress={handleSaveAdminDetails}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color={Colors.accentSage} />
                ) : (
                  <Text style={s.btnSecondaryText}>💾 Save Admin Details</Text>
                )}
              </TouchableOpacity>

              {/* Organization details */}
              {orgId ? (
                <>
                  <Text style={[s.sectionTitle, { marginTop: Spacing.xl }]}>
                    🏢 Organization
                  </Text>

                  <View style={s.fieldGroup}>
                    <Text style={s.fieldLabel}>Organization Name</Text>
                    <View style={[s.fieldInput, s.fieldDisabled]}>
                      <Text style={s.fieldDisabledText}>
                        {orgName || "N/A"}
                      </Text>
                    </View>
                  </View>

                  <View style={s.fieldGroup}>
                    <Text style={s.fieldLabel}>Admin Name</Text>
                    <View style={[s.fieldInput, s.fieldDisabled]}>
                      <Text style={s.fieldDisabledText}>
                        {orgAdmin || "N/A"}
                      </Text>
                    </View>
                  </View>

                  <View style={s.fieldGroup}>
                    <Text style={s.fieldLabel}>Admin Email</Text>
                    <View style={[s.fieldInput, s.fieldDisabled]}>
                      <Text style={s.fieldDisabledText}>
                        {orgEmail || "N/A"}
                      </Text>
                    </View>
                  </View>
                </>
              ) : null}
            </View>
          )}

          <View style={{ height: Spacing.xxl }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.adminTint },
  scroll: { paddingBottom: Spacing.xl },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.md,
  },
  backBtn: {
    fontSize: Typography.body,
    fontWeight: "700",
    color: Colors.accentSage,
  },
  title: {
    fontSize: Typography.title,
    fontWeight: "800",
    color: Colors.accentSage,
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
  tabText: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.textSecondary,
  },
  tabTextActive: { color: Colors.textOnDark },

  section: { paddingHorizontal: Spacing.xl },
  sectionTitle: {
    fontSize: Typography.body + 1,
    fontWeight: "800",
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
  },

  branchCard: {
    backgroundColor: Colors.card,
    borderRadius: Radius.xl,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    gap: Spacing.sm,
  },
  branchHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  branchName: {
    fontSize: Typography.body + 1,
    fontWeight: "800",
    color: Colors.textPrimary,
    flex: 1,
  },
  branchAddress: {
    fontSize: Typography.label,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  statusPill: {
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusText: {
    fontSize: Typography.label - 1,
    fontWeight: "800",
  },
  branchMeta: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.xs,
  },
  metaChip: {
    backgroundColor: Colors.background,
    borderRadius: Radius.md,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  metaText: {
    fontSize: Typography.label,
    color: Colors.textPrimary,
    fontWeight: "600",
  },
  editBranchBtn: {
    alignSelf: "flex-end",
    backgroundColor: Colors.accentSageLight,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
  },
  editBranchText: {
    fontSize: Typography.label,
    fontWeight: "800",
    color: Colors.accentSage,
  },

  editHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  cancelEdit: {
    fontSize: Typography.label,
    fontWeight: "700",
    color: Colors.error,
  },

  fieldGroup: { marginBottom: Spacing.lg },
  fieldLabel: {
    fontSize: Typography.label,
    fontWeight: "600",
    color: Colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 6,
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
  fieldDisabled: {
    backgroundColor: Colors.accentSageLight,
    justifyContent: "center",
  },
  fieldDisabledText: {
    fontSize: Typography.body,
    color: Colors.textSecondary,
  },
  fieldHint: {
    fontSize: Typography.caption,
    color: Colors.textMuted,
    marginTop: 4,
  },

  statusToggle: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: Radius.full,
    backgroundColor: Colors.card,
    borderWidth: 1.5,
    borderColor: Colors.cardBorder,
    alignItems: "center",
  },
  statusToggleActive: {
    backgroundColor: Colors.accentSage,
    borderColor: Colors.accentSage,
  },
  statusToggleText: {
    fontSize: Typography.label,
    fontWeight: "700",
    color: Colors.textSecondary,
  },
  statusToggleTextActive: { color: Colors.textOnDark },

  emptyText: {
    fontSize: Typography.body,
    color: Colors.textMuted,
    textAlign: "center",
    paddingVertical: Spacing.xl,
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
  btnSecondary: {
    backgroundColor: Colors.accentSageLight,
    borderRadius: Radius.full,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: Spacing.xs,
    borderWidth: 1.5,
    borderColor: Colors.accentSage,
  },
  btnSecondaryText: {
    fontSize: Typography.body,
    fontWeight: "700",
    color: Colors.accentSage,
  },
});
