import locationService from "@/api/services/locationService";
import GenreSelector from "@/components/GenreSelector";
import LanguageSelector from "@/components/LanguageSelector";
import { NavBar, NAV_BOTTOM_PAD } from "@/components/NavBar";
import { API_BASE_URL } from "@/constants/config";
import {
  buildProfilePreferencesFromResponses,
  getQuestionnaireQuestionMeta,
  ProfilePreferenceItem,
} from "@/constants/questionnaires";
import { Colors, Radius, Spacing, Typography } from "@/constants/theme";
import useAppStore, { AppProfile, ageGroupToNum } from "@/store/useAppStore";
import issueService from "@/api/services/issueService";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
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

const AGE_GROUPS = [
  "0-3",
  "4-6",
  "6-8",
  "8-10",
  "10-12",
  "12-15",
  "15+",
] as const;

// ── Profile Card for child profiles ──────────────────────────────────────────
function ChildProfileCard({
  profile,
  onPress,
}: {
  profile: AppProfile;
  onPress: () => void;
}) {
  const emoji = profile.age <= 3 ? "👶" : profile.age <= 10 ? "🧒" : "🧑";
  return (
    <TouchableOpacity
      style={s.childCard}
      activeOpacity={0.78}
      onPress={onPress}
    >
      <View style={s.childAvatar}>
        <Text style={s.childEmoji}>{emoji}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.childName}>{profile.name}</Text>
        <Text style={s.childAge}>
          {profile.ageGroup
            ? `Age Group: ${profile.ageGroup}`
            : `Age: ${profile.age}`}
        </Text>
      </View>
      <Text style={s.childArrow}>Edit →</Text>
    </TouchableOpacity>
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────
export default function EditProfileScreen() {
  const router = useRouter();
  const { userId, email, token, profiles, activeProfileId, setAuth, role, clearAuth } =
    useAppStore();

  // Determine which profile we're editing: default to active, or query param
  const [editingProfileId, setEditingProfileId] = useState<string | null>(
    activeProfileId,
  );
  const editingProfile = profiles.find((p) => p.profileId === editingProfileId);
  const isParent = editingProfile?.accountType === "PARENT";
  const childProfiles = profiles.filter((p) => p.accountType === "CHILD");

  // ── Form state ──
  const [name, setName] = useState(editingProfile?.name || "");
  const [phone, setPhone] = useState("");
  const [ageGroup, setAgeGroup] = useState(editingProfile?.ageGroup || "15+");
  const [genres, setGenres] = useState<string[]>(
    editingProfile?.preferredGenres || [],
  );
  const [languages, setLanguages] = useState<string[]>(
    editingProfile?.preferredLanguages || [],
  );
  const [questionnaireResponses, setQuestionnaireResponses] = useState<Record<string, any>>(
    editingProfile?.questionnaireResponses || {},
  );
  const [profilePreferences, setProfilePreferences] = useState<ProfilePreferenceItem[]>(
    editingProfile?.profilePreferences || [],
  );
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<
    "details" | "languages" | "genres" | "addresses"
  >("details");

  // ── Delete account state ──
  const isMainProfile = profiles[0]?.profileId === editingProfileId;
  const [deleteStep, setDeleteStep] = useState<'closed' | 'warn' | 'confirm'>('closed');
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);

  const handleDeleteAccount = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/users/${userId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Failed to delete account.');
      await clearAuth();
      router.replace('/(auth)/welcome');
    } catch (e: any) {
      if (Platform.OS === 'web') {
        window.alert(e.message || 'Failed to delete account.');
      } else {
        Alert.alert('Error', e.message || 'Failed to delete account.');
      }
    } finally {
      setDeleting(false);
      setDeleteStep('closed');
      setDeleteConfirmText('');
    }
  };

  // ── Address state ──
  const [addresses, setAddresses] = useState<any[]>([]);
  const [loadingAddresses, setLoadingAddresses] = useState(false);
  const [editingAddress, setEditingAddress] = useState<any | null>(null);
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [addrLabel, setAddrLabel] = useState("");
  const [addrStreet, setAddrStreet] = useState("");
  const [addrCity, setAddrCity] = useState("");
  const [addrState, setAddrState] = useState("");
  const [addrPincode, setAddrPincode] = useState("");

  const questionnaireType = isParent ? "PARENT" : "CHILD";

  const getCompletePreferences = (
    accountType: "PARENT" | "CHILD",
    existingPreferences: ProfilePreferenceItem[],
    responseMap: Record<string, any>,
    profileContext?: Partial<AppProfile>,
  ) => {
    const enrichedResponses = {
      ...(responseMap || {}),
    };

    if (!enrichedResponses.name && profileContext?.name) {
      enrichedResponses.name = profileContext.name;
    }
    if (
      (!Array.isArray(enrichedResponses.preferredLanguages) ||
        enrichedResponses.preferredLanguages.length === 0) &&
      Array.isArray(profileContext?.preferredLanguages) &&
      profileContext!.preferredLanguages!.length > 0
    ) {
      enrichedResponses.preferredLanguages = profileContext.preferredLanguages;
    }
    if (
      (!Array.isArray(enrichedResponses.preferredGenres) ||
        enrichedResponses.preferredGenres.length === 0) &&
      Array.isArray(profileContext?.preferredGenres) &&
      profileContext!.preferredGenres!.length > 0
    ) {
      enrichedResponses.preferredGenres = profileContext.preferredGenres;
    }
    if (
      (enrichedResponses.age == null || enrichedResponses.age === "") &&
      typeof profileContext?.age === "number"
    ) {
      enrichedResponses.age = String(profileContext.age);
    }

    const defaults = buildProfilePreferencesFromResponses(
      enrichedResponses,
      accountType,
    );
    const existingById = new Map(
      (existingPreferences || []).map((item) => [item.questionId, item]),
    );

    return defaults.map((item) => existingById.get(item.questionId) || item);
  };

  const updateProfilePreferenceAnswer = (questionId: string, rawValue: string) => {
    const meta = getQuestionnaireQuestionMeta(questionnaireType);
    const questionInfo = meta[questionId];
    const normalizedValue = questionInfo?.type === "tags"
      ? rawValue
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean)
      : rawValue;

    setQuestionnaireResponses((prev) => ({
      ...prev,
      [questionId]: normalizedValue,
    }));

    setProfilePreferences((prev) => {
      const existing = prev.find((item) => item.questionId === questionId);
      if (existing) {
        return prev.map((item) =>
          item.questionId === questionId
            ? { ...item, answer: normalizedValue }
            : item,
        );
      }

      return [
        ...prev,
        {
          questionId,
          question: questionInfo?.question || questionId,
          answer: normalizedValue,
        },
      ];
    });
  };

  // ── Fetch user core details (phone) ──
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/users/${userId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = await res.json();
        if (json.data?.user?.phone) {
          setPhone(json.data.user.phone);
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    };
    fetchUser();
  }, [token, userId]);

  // ── Fetch delivery addresses ──
  const fetchAddresses = useCallback(async () => {
    if (!userId) return;
    setLoadingAddresses(true);
    try {
      const res: any = await locationService.getDeliveryAddresses(userId);
      setAddresses(res.addresses || res.data?.addresses || []);
    } catch {
      // ignore
    } finally {
      setLoadingAddresses(false);
    }
  }, [userId]);

  useEffect(() => {
    if (step === "addresses") fetchAddresses();
  }, [step, fetchAddresses]);

  const resetAddrForm = () => {
    setAddrLabel("");
    setAddrStreet("");
    setAddrCity("");
    setAddrState("");
    setAddrPincode("");
    setEditingAddress(null);
    setShowAddressForm(false);
  };

  const handleSaveAddress = async () => {
    if (!addrLabel.trim()) {
      Alert.alert(
        "Required",
        "Please enter a description/label for the address.",
      );
      return;
    }
    if (!addrStreet.trim() || !addrCity.trim()) {
      Alert.alert("Required", "Please enter at least street and city.");
      return;
    }
    setSaving(true);
    try {
      if (editingAddress) {
        // Delete old and re-add (API has no PATCH for addresses)
        await locationService.deleteDeliveryAddress(
          userId!,
          editingAddress._id,
        );
      }
      await locationService.updateDeliveryLocation(userId!, {
        label: addrLabel.trim(),
        street: addrStreet.trim(),
        city: addrCity.trim(),
        state: addrState.trim(),
        pincode: addrPincode.trim(),
        latitude: editingAddress?.location?.coordinates?.[1] || 0,
        longitude: editingAddress?.location?.coordinates?.[0] || 0,
      });
      resetAddrForm();
      fetchAddresses();
      Alert.alert(
        "Saved",
        editingAddress ? "Address updated." : "Address added.",
      );
    } catch {
      Alert.alert("Error", "Failed to save address.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAddress = (addr: any) => {
    const addressId = addr?._id || addr?.id;
    if (!addressId) {
      Alert.alert("Error", "Address ID not found.");
      return;
    }

    const performDelete = async () => {
      try {
        await locationService.deleteDeliveryAddress(userId!, String(addressId));
        fetchAddresses();
      } catch {
        Alert.alert("Error", "Failed to delete address.");
      }
    };

    if (Platform.OS === "web") {
      const confirmed = window.confirm(
        `Remove "${addr.label || addr.street || "this address"}"?`,
      );
      if (confirmed) performDelete();
      return;
    }

    Alert.alert("Delete Address", `Remove "${addr.label || addr.street}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: performDelete,
      },
    ]);
  };

  const handleSetDefault = async (addr: any) => {
    try {
      await locationService.setDefaultAddress(userId!, addr._id);
      fetchAddresses();
    } catch {
      Alert.alert("Error", "Failed to set default address.");
    }
  };

  const startEditAddress = (addr: any) => {
    setEditingAddress(addr);
    setAddrLabel(addr.label || "");
    setAddrStreet(addr.street || "");
    setAddrCity(addr.city || "");
    setAddrState(addr.state || "");
    setAddrPincode(addr.pincode || "");
    setShowAddressForm(true);
  };

  // ── Sync form when switching profile to edit ──
  useEffect(() => {
    const p = profiles.find((pr) => pr.profileId === editingProfileId);
    if (p) {
      setName(p.name);
      setAgeGroup(p.ageGroup || "15+");
      setGenres(p.preferredGenres || []);
      setLanguages(p.preferredLanguages || []);
      const responses = {
        ...(p.questionnaireResponses || {}),
        name: p.name || (p.questionnaireResponses as any)?.name || "",
        age:
          (p.questionnaireResponses as any)?.age ??
          (typeof p.age === "number" ? String(p.age) : ""),
        preferredLanguages:
          (p.questionnaireResponses as any)?.preferredLanguages ||
          p.preferredLanguages ||
          [],
        preferredGenres:
          (p.questionnaireResponses as any)?.preferredGenres ||
          p.preferredGenres ||
          [],
      };
      setQuestionnaireResponses(responses);
      setProfilePreferences(
        getCompletePreferences(
          p.accountType,
          p.profilePreferences || [],
          responses,
          p,
        ),
      );
      setStep("details");
    }
  }, [editingProfileId, profiles]);

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert("Missing Name", "Please enter a name.");
      return;
    }
    setSaving(true);
    try {
      const completePreferences = getCompletePreferences(
        questionnaireType,
        profilePreferences,
        questionnaireResponses,
        editingProfile,
      );

      // 1. Update profile (name, ageGroup, genres, languages)
      const profileBody: Record<string, unknown> = {
        name: name.trim(),
        ageGroup,
        preferredGenres: genres,
        preferredLanguages: languages,
        questionnaireResponses,
        profilePreferences: completePreferences,
      };
      await fetch(
        `${API_BASE_URL}/users/${userId}/profiles/${editingProfileId}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(profileBody),
        },
      );

      // 2. If editing parent, also update phone
      if (isParent && phone.trim()) {
        await fetch(`${API_BASE_URL}/users/${userId}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ phone: phone.trim() }),
        });
      }

      // 3. Re-fetch user and update store
      const userRes = await fetch(`${API_BASE_URL}/users/${userId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const userJson = await userRes.json();
      const user = userJson.data?.user;
      if (user) {
        await setAuth({
          userId: user._id,
          email: user.email,
          token: token!,
          role,
          profiles: user.profiles.map((p: any) => ({
            profileId: p.profileId,
            name: p.name,
            accountType: p.accountType,
            ageGroup: p.ageGroup,
            preferredGenres: p.preferredGenres,
            preferredLanguages: p.preferredLanguages,
            questionnaireResponses: p.questionnaireResponses || {},
            profilePreferences: p.profilePreferences || [],
          })),
        });
      }

      Alert.alert("✅ Saved", "Profile updated successfully.");
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to save changes.");
    } finally {
      setSaving(false);
    }
  };

  const editablePreferences = getCompletePreferences(
    questionnaireType,
    profilePreferences,
    questionnaireResponses,
    editingProfile,
  );

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
      {Platform.OS === 'web' && <NavBar role="user" active="profile" />}

      {/* ── Delete Account: Step 1 — Warning ── */}
      <Modal
        transparent
        visible={deleteStep === 'warn'}
        animationType="fade"
        onRequestClose={() => setDeleteStep('closed')}
      >
        <View style={s.deleteModalOverlay}>
          <View style={s.deleteModalCard}>
            <Text style={s.deleteModalTitle}>⚠️ Delete Account</Text>
            <Text style={s.deleteModalBody}>
              This will permanently delete your account, all profiles, borrowing history, and saved addresses.{'\n\n'}This action cannot be undone.
            </Text>
            <View style={{ flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.lg }}>
              <TouchableOpacity
                style={[s.btnPrimary, { flex: 1, backgroundColor: Colors.card, borderWidth: 1.5, borderColor: Colors.cardBorder }]}
                onPress={() => setDeleteStep('closed')}
              >
                <Text style={[s.btnPrimaryText, { color: Colors.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.btnPrimary, { flex: 1, backgroundColor: Colors.error }]}
                onPress={() => { setDeleteStep('confirm'); setDeleteConfirmText(''); }}
              >
                <Text style={s.btnPrimaryText}>Yes, proceed</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Delete Account: Step 2 — Type "confirm" ── */}
      <Modal
        transparent
        visible={deleteStep === 'confirm'}
        animationType="fade"
        onRequestClose={() => setDeleteStep('closed')}
      >
        <View style={s.deleteModalOverlay}>
          <View style={s.deleteModalCard}>
            <Text style={s.deleteModalTitle}>Confirm Deletion</Text>
            <Text style={s.deleteModalBody}>
              Type <Text style={{ fontWeight: '800' }}>confirm</Text> below to permanently delete your account.
            </Text>
            <TextInput
              style={[s.fieldInput, { marginTop: Spacing.md }]}
              value={deleteConfirmText}
              onChangeText={setDeleteConfirmText}
              placeholder="Type confirm here"
              placeholderTextColor={Colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <View style={{ flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.lg }}>
              <TouchableOpacity
                style={[s.btnPrimary, { flex: 1, backgroundColor: Colors.card, borderWidth: 1.5, borderColor: Colors.cardBorder }]}
                onPress={() => setDeleteStep('closed')}
                disabled={deleting}
              >
                <Text style={[s.btnPrimaryText, { color: Colors.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.btnPrimary, { flex: 1, backgroundColor: Colors.error, opacity: deleteConfirmText.toLowerCase() === 'confirm' && !deleting ? 1 : 0.4 }]}
                onPress={handleDeleteAccount}
                disabled={deleteConfirmText.toLowerCase() !== 'confirm' || deleting}
              >
                {deleting
                  ? <ActivityIndicator color={Colors.buttonPrimaryText} />
                  : <Text style={s.btnPrimaryText}>Delete Forever</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
                if (editingProfileId !== activeProfileId) {
                  setEditingProfileId(activeProfileId);
                } else {
                  router.back();
                }
              }}
            >
              <Text style={s.backBtn}>← Back</Text>
            </TouchableOpacity>
            <Text style={s.title}>Edit Profile</Text>
            <View style={{ width: 60 }} />
          </View>

          {/* Profile selector pills (if parent, show all profiles) */}
          {isParent && profiles.length > 1 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.profilePillRow}
            >
              {profiles.map((p) => (
                <TouchableOpacity
                  key={p.profileId}
                  style={[
                    s.profilePill,
                    editingProfileId === p.profileId && s.profilePillActive,
                  ]}
                  onPress={() => setEditingProfileId(p.profileId)}
                >
                  <Text
                    style={[
                      s.profilePillText,
                      editingProfileId === p.profileId &&
                        s.profilePillTextActive,
                    ]}
                  >
                    {p.accountType === "PARENT" ? "👤" : "🧒"} {p.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          {/* Step tabs */}
          <View style={s.stepRow}>
            {(isParent
              ? (["details", "languages", "genres", "addresses"] as const)
              : (["details", "languages", "genres"] as const)
            ).map((t) => (
              <TouchableOpacity
                key={t}
                style={[s.stepTab, step === t && s.stepTabActive]}
                onPress={() => setStep(t)}
              >
                <Text
                  style={[s.stepTabText, step === t && s.stepTabTextActive]}
                >
                  {t === "details"
                    ? "Details"
                    : t === "languages"
                      ? "Languages"
                      : t === "genres"
                        ? "Genres"
                        : "Addresses"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* ── Details step ── */}
          {step === "details" && (
            <View style={s.section}>
              {/* Name */}
              <View style={s.fieldGroup}>
                <Text style={s.fieldLabel}>Name</Text>
                <TextInput
                  style={s.fieldInput}
                  value={name}
                  onChangeText={setName}
                  placeholder="Enter name"
                  placeholderTextColor={Colors.textMuted}
                  autoCapitalize="words"
                />
              </View>

              {/* Email (read-only for parent) */}
              {isParent && (
                <View style={s.fieldGroup}>
                  <Text style={s.fieldLabel}>Email</Text>
                  <View style={[s.fieldInput, s.fieldDisabled]}>
                    <Text style={s.fieldDisabledText}>{email}</Text>
                  </View>
                  <Text style={s.fieldHint}>Email cannot be changed</Text>
                </View>
              )}

              {/* Phone (editable for parent) */}
              {isParent && (
                <View style={s.fieldGroup}>
                  <Text style={s.fieldLabel}>Phone Number</Text>
                  <TextInput
                    style={s.fieldInput}
                    value={phone}
                    onChangeText={setPhone}
                    placeholder="Enter phone number"
                    placeholderTextColor={Colors.textMuted}
                    keyboardType="phone-pad"
                  />
                </View>
              )}

              {/* Age Group */}
              {!isParent && (
                <View style={s.fieldGroup}>
                  <Text style={s.fieldLabel}>Age Group</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ gap: Spacing.xs }}
                  >
                    {AGE_GROUPS.map((ag) => (
                      <TouchableOpacity
                        key={ag}
                        style={[s.agePill, ageGroup === ag && s.agePillActive]}
                        onPress={() => setAgeGroup(ag)}
                      >
                        <Text
                          style={[
                            s.agePillText,
                            ageGroup === ag && s.agePillTextActive,
                          ]}
                        >
                          {ag}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}

              {/* Child profiles navigation (only for parent profile) */}
              {isParent && childProfiles.length > 0 && (
                <View style={s.fieldGroup}>
                  <Text style={s.sectionTitle}>👶 Child Profiles</Text>
                  <Text style={s.sectionSubtitle}>
                    Tap to edit a child&apos;s profile details
                  </Text>
                  {childProfiles.map((child) => (
                    <ChildProfileCard
                      key={child.profileId}
                      profile={child}
                      onPress={() => setEditingProfileId(child.profileId)}
                    />
                  ))}
                </View>
              )}

              <View style={s.fieldGroup}>
                <Text style={s.sectionTitle}>Profile Preferences</Text>
                <Text style={s.sectionSubtitle}>
                  Personalized answers used by Owl recommendations.
                </Text>
                {editablePreferences.map((preference) => {
                  const value = Array.isArray(preference.answer)
                    ? preference.answer.join(", ")
                    : String(preference.answer || "");

                  return (
                    <View key={preference.questionId} style={{ marginBottom: Spacing.sm }}>
                      <Text style={s.fieldLabel}>{preference.question}</Text>
                      <TextInput
                        style={s.fieldInput}
                        value={value}
                        onChangeText={(text) =>
                          updateProfilePreferenceAnswer(preference.questionId, text)
                        }
                        placeholder="Add your answer"
                        placeholderTextColor={Colors.textMuted}
                        multiline={preference.question.length > 36}
                      />
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {/* ── Languages step ── */}
          {step === "languages" && (
            <View style={s.section}>
              <LanguageSelector
                selectedLanguages={languages}
                onLanguagesChange={setLanguages}
              />
            </View>
          )}

          {/* ── Genres step ── */}
          {step === "genres" && (
            <View style={s.section}>
              <GenreSelector
                selectedGenres={genres}
                onGenresChange={setGenres}
                isChild={!isParent && ageGroupToNum(ageGroup) <= 12}
              />
            </View>
          )}

          {/* ── Addresses step (parent only) ── */}
          {step === "addresses" && isParent && (
            <View style={s.section}>
              <Text style={s.sectionTitle}>Delivery Addresses</Text>
              <Text style={s.sectionSubtitle}>
                Manage your saved delivery addresses. The default address is
                used when ordering books.
              </Text>

              {loadingAddresses ? (
                <ActivityIndicator
                  color={Colors.accentSage}
                  style={{ marginVertical: Spacing.xl }}
                />
              ) : addresses.length === 0 ? (
                <Text style={s.emptyText}>No addresses saved yet.</Text>
              ) : (
                addresses.map((addr) => (
                  <View
                    key={addr._id}
                    style={[s.addrCard, addr.isDefault && s.addrCardDefault]}
                  >
                    <View style={{ flex: 1 }}>
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        <Text style={s.addrLabel}>
                          {addr.label || "Address"}
                        </Text>
                        {addr.isDefault && (
                          <View style={s.defaultBadge}>
                            <Text style={s.defaultBadgeText}>Default</Text>
                          </View>
                        )}
                      </View>
                      <Text style={s.addrDetail}>
                        {[addr.street, addr.city, addr.state, addr.pincode]
                          .filter(Boolean)
                          .join(", ")}
                      </Text>
                    </View>
                    <View style={s.addrActions}>
                      {!addr.isDefault && (
                        <TouchableOpacity
                          onPress={() => handleSetDefault(addr)}
                        >
                          <Text style={s.addrActionText}>Set Default</Text>
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity onPress={() => startEditAddress(addr)}>
                        <Text style={s.addrActionText}>Edit</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => handleDeleteAddress(addr)}
                      >
                        <Text
                          style={[s.addrActionText, { color: Colors.error }]}
                        >
                          Delete
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              )}

              {/* Add new address button */}
              <TouchableOpacity
                style={s.addAddrBtn}
                onPress={() => {
                  resetAddrForm();
                  setShowAddressForm(true);
                }}
              >
                <Text style={s.addAddrBtnText}>+ Add New Address</Text>
              </TouchableOpacity>

              {/* Or use map to add */}
              <TouchableOpacity
                style={[
                  s.addAddrBtn,
                  {
                    backgroundColor: Colors.browseSurface,
                    borderColor: Colors.accentPeriwinkle,
                  },
                ]}
                onPress={() => router.push("/(user)/delivery-map")}
              >
                <Text
                  style={[s.addAddrBtnText, { color: Colors.accentPeriwinkle }]}
                >
                  Open Map to Add Address
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Address Form Modal */}
          <Modal
            transparent
            visible={showAddressForm}
            animationType="slide"
            onRequestClose={resetAddrForm}
          >
            <View style={s.addrFormOverlay}>
              <View style={s.addrFormCard}>
                <Text style={s.addrFormTitle}>
                  {editingAddress ? "Edit Address" : "Add New Address"}
                </Text>

                <Text style={s.fieldLabel}>Description / Label *</Text>
                <TextInput
                  style={s.fieldInput}
                  value={addrLabel}
                  onChangeText={setAddrLabel}
                  placeholder="e.g. Home, Office, Hostel"
                  placeholderTextColor={Colors.textMuted}
                />

                <Text style={[s.fieldLabel, { marginTop: Spacing.sm }]}>
                  Street *
                </Text>
                <TextInput
                  style={s.fieldInput}
                  value={addrStreet}
                  onChangeText={setAddrStreet}
                  placeholder="Street address"
                  placeholderTextColor={Colors.textMuted}
                />

                <Text style={[s.fieldLabel, { marginTop: Spacing.sm }]}>
                  City *
                </Text>
                <TextInput
                  style={s.fieldInput}
                  value={addrCity}
                  onChangeText={setAddrCity}
                  placeholder="City"
                  placeholderTextColor={Colors.textMuted}
                />

                <Text style={[s.fieldLabel, { marginTop: Spacing.sm }]}>
                  State
                </Text>
                <TextInput
                  style={s.fieldInput}
                  value={addrState}
                  onChangeText={setAddrState}
                  placeholder="State"
                  placeholderTextColor={Colors.textMuted}
                />

                <Text style={[s.fieldLabel, { marginTop: Spacing.sm }]}>
                  Pincode
                </Text>
                <TextInput
                  style={s.fieldInput}
                  value={addrPincode}
                  onChangeText={setAddrPincode}
                  placeholder="Pincode"
                  placeholderTextColor={Colors.textMuted}
                  keyboardType="number-pad"
                />

                <View
                  style={{
                    flexDirection: "row",
                    gap: Spacing.md,
                    marginTop: Spacing.lg,
                  }}
                >
                  <TouchableOpacity
                    style={[
                      s.btnPrimary,
                      {
                        flex: 1,
                        backgroundColor: Colors.card,
                        borderWidth: 1.5,
                        borderColor: Colors.cardBorder,
                      },
                    ]}
                    onPress={resetAddrForm}
                  >
                    <Text
                      style={[
                        s.btnPrimaryText,
                        { color: Colors.textSecondary },
                      ]}
                    >
                      Cancel
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      s.btnPrimary,
                      { flex: 1 },
                      saving && { opacity: 0.6 },
                    ]}
                    onPress={handleSaveAddress}
                    disabled={saving}
                  >
                    {saving ? (
                      <ActivityIndicator color={Colors.buttonPrimaryText} />
                    ) : (
                      <Text style={s.btnPrimaryText}>
                        {editingAddress ? "Update" : "Add"}
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>

          {/* Save button (not shown on addresses tab) */}
          {step !== "addresses" && (
            <View style={s.section}>
              <TouchableOpacity
                style={[s.btnPrimary, saving && { opacity: 0.6 }]}
                activeOpacity={0.82}
                onPress={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color={Colors.buttonPrimaryText} />
                ) : (
                  <Text style={s.btnPrimaryText}>💾 Save Changes</Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* Delete Account button — only the main profile / account creator */}
          {isMainProfile && step === 'details' && (
            <View style={[s.section, { paddingTop: 0 }]}>
              <TouchableOpacity
                style={s.deleteAccountBtn}
                activeOpacity={0.82}
                onPress={async () => {
                  // Block if there are active issues
                  try {
                    const res = await issueService.getUserIssues(userId!, profiles[0]?.profileId ?? '');
                    const issues: any[] = res?.data?.issues ?? [];
                    const hasActive = issues.some(
                      (i: any) => i.status === 'ISSUED' || i.status === 'OVERDUE',
                    );
                    if (hasActive) {
                      if (Platform.OS === 'web') {
                        window.alert('You have unreturned books. Please return all books before deleting your account.');
                      } else {
                        Alert.alert('Cannot Delete', 'You have unreturned books. Please return all books before deleting your account.');
                      }
                      return;
                    }
                  } catch { /* if check fails, let backend enforce it */ }
                  setDeleteStep('warn');
                }}
              >
                <Text style={s.deleteAccountBtnText}>🗑 Delete Account</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={{ height: Spacing.xxl }} />
        </ScrollView>
      </KeyboardAvoidingView>
      {Platform.OS !== 'web' && <NavBar role="user" active="profile" />}
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

  profilePillRow: {
    paddingHorizontal: Spacing.xl,
    gap: Spacing.xs,
    marginBottom: Spacing.md,
  },
  profilePill: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: Radius.full,
    backgroundColor: Colors.card,
    borderWidth: 1.5,
    borderColor: Colors.cardBorder,
  },
  profilePillActive: {
    backgroundColor: Colors.accentSage,
    borderColor: Colors.accentSage,
  },
  profilePillText: {
    fontSize: Typography.label,
    fontWeight: "700",
    color: Colors.textSecondary,
  },
  profilePillTextActive: { color: Colors.textOnDark },

  stepRow: {
    flexDirection: "row",
    gap: Spacing.xs,
    paddingHorizontal: Spacing.xl,
    marginBottom: Spacing.lg,
  },
  stepTab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: Radius.full,
    backgroundColor: Colors.card,
    borderWidth: 1.5,
    borderColor: Colors.cardBorder,
    alignItems: "center",
  },
  stepTabActive: {
    backgroundColor: Colors.accentSage,
    borderColor: Colors.accentSage,
  },
  stepTabText: {
    fontSize: 11,
    fontWeight: "700",
    color: Colors.textSecondary,
  },
  stepTabTextActive: { color: Colors.textOnDark },

  section: { paddingHorizontal: Spacing.xl },

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

  agePill: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: Radius.full,
    backgroundColor: Colors.card,
    borderWidth: 1.5,
    borderColor: Colors.cardBorder,
  },
  agePillActive: {
    backgroundColor: Colors.accentSage,
    borderColor: Colors.accentSage,
  },
  agePillText: {
    fontSize: Typography.label,
    fontWeight: "700",
    color: Colors.textSecondary,
  },
  agePillTextActive: { color: Colors.textOnDark },

  sectionTitle: {
    fontSize: Typography.body + 1,
    fontWeight: "800",
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: Typography.label,
    color: Colors.textSecondary,
    marginBottom: Spacing.md,
  },

  childCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.card,
    borderRadius: Radius.xl,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    gap: Spacing.md,
  },
  childAvatar: {
    width: 48,
    height: 48,
    borderRadius: Radius.full,
    backgroundColor: Colors.browseSurface,
    alignItems: "center",
    justifyContent: "center",
  },
  childEmoji: { fontSize: 24 },
  childName: {
    fontSize: Typography.body,
    fontWeight: "700",
    color: Colors.textPrimary,
  },
  childAge: {
    fontSize: Typography.label,
    color: Colors.textSecondary,
  },
  childArrow: {
    fontSize: Typography.label,
    fontWeight: "800",
    color: Colors.accentSage,
  },

  emptyText: {
    fontSize: Typography.body,
    color: Colors.textMuted,
    textAlign: "center",
    paddingVertical: Spacing.xl,
  },

  // Address card
  addrCard: {
    backgroundColor: Colors.card,
    borderRadius: Radius.xl,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1.5,
    borderColor: Colors.cardBorder,
  },
  addrCardDefault: {
    borderColor: Colors.accentSage,
  },
  addrLabel: {
    fontSize: Typography.body,
    fontWeight: "700",
    color: Colors.textPrimary,
  },
  addrDetail: {
    fontSize: Typography.label,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  defaultBadge: {
    backgroundColor: Colors.accentSageLight,
    borderRadius: Radius.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  defaultBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: Colors.accentSage,
  },
  addrActions: {
    flexDirection: "row",
    gap: Spacing.md,
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.cardBorder,
  },
  addrActionText: {
    fontSize: Typography.label,
    fontWeight: "700",
    color: Colors.accentSage,
  },
  addAddrBtn: {
    backgroundColor: Colors.accentSageLight,
    borderRadius: Radius.lg,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: Spacing.sm,
    borderWidth: 1.5,
    borderColor: Colors.accentSage,
  },
  addAddrBtnText: {
    fontSize: Typography.body,
    fontWeight: "700",
    color: Colors.accentSage,
  },

  // Address form modal
  addrFormOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.xl,
  },
  addrFormCard: {
    backgroundColor: Colors.card,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    width: "100%",
    maxWidth: 400,
    borderWidth: 1.5,
    borderColor: Colors.cardBorder,
  },
  addrFormTitle: {
    fontSize: Typography.title,
    fontWeight: "800",
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
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

  // Delete account
  deleteAccountBtn: {
    borderWidth: 1.5,
    borderColor: Colors.error,
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  deleteAccountBtnText: {
    fontSize: Typography.body,
    fontWeight: '700',
    color: Colors.error,
  },
  deleteModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  deleteModalCard: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    padding: Spacing.xl,
    width: '100%',
    maxWidth: 420,
  },
  deleteModalTitle: {
    fontSize: Typography.title,
    fontWeight: '800',
    color: Colors.error,
    marginBottom: Spacing.sm,
  },
  deleteModalBody: {
    fontSize: Typography.body,
    color: Colors.textSecondary,
    lineHeight: 22,
  },
});
