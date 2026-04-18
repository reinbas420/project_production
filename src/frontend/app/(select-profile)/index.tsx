import PersonalizedQuestionnaire from "@/components/PersonalizedQuestionnaire";
import { API_BASE_URL } from "@/constants/config";
import { Colors, Radius, Spacing, Typography } from "@/constants/theme";
import useAppStore, { AppProfile, numToAgeGroup } from "@/store/useAppStore";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
    Dimensions,
    FlatList,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const { width } = Dimensions.get("window");
const CARD_GAP = Spacing.md;
const CARD_SIZE = (width - Spacing.xl * 2 - CARD_GAP) / 2;

const AVATAR_COLORS = [
  "#C5DDB8",
  "#F4C2C2",
  "#C5D5EA",
  "#FFDAB9",
  "#D4C5EA",
  "#B8D4C8",
];
const avatarColor = (i: number) => AVATAR_COLORS[i % AVATAR_COLORS.length];

function getEmoji(age: number, isChild: boolean): string {
  if (!isChild) return "👤";
  if (age <= 3) return "👶";
  if (age <= 10) return "🧒";
  return "🧑";
}

function ProfileCard({
  profile,
  index,
  onPress,
}: {
  profile: AppProfile;
  index: number;
  onPress: () => void;
}) {
  const isChild = profile.accountType === "CHILD";
  return (
    <TouchableOpacity
      style={[s.card, { width: CARD_SIZE }]}
      activeOpacity={0.78}
      onPress={onPress}
    >
      <View style={[s.avatar, { backgroundColor: avatarColor(index) }]}>
        <Text style={s.avatarEmoji}>{getEmoji(profile.age, isChild)}</Text>
      </View>
      <Text style={s.profileName} numberOfLines={1}>
        {profile.name}
      </Text>
      <View
        style={[
          s.badge,
          {
            backgroundColor: isChild
              ? Colors.browseSurface
              : Colors.accentSageLight,
          },
        ]}
      >
        <Text
          style={[
            s.badgeText,
            { color: isChild ? Colors.accentPeriwinkle : Colors.accentSage },
          ]}
        >
          {isChild
            ? profile.ageGroup
              ? `Age ${profile.ageGroup}`
              : `Age ${profile.age}`
            : "Account"}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

function AddProfileCard({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity
      style={[s.card, s.addCard, { width: CARD_SIZE }]}
      activeOpacity={0.78}
      onPress={onPress}
    >
      <View style={s.addCircle}>
        <Text style={s.addPlus}>＋</Text>
      </View>
      <Text style={s.addLabel}>Add Profile</Text>
    </TouchableOpacity>
  );
}

export default function SelectProfileScreen() {
  const router = useRouter();
  const {
    profiles,
    clearAuth,
    addProfile,
    updateProfile,
    userId,
    token,
    setActiveProfile,
  } =
    useAppStore();

  const [questionnaireContext, setQuestionnaireContext] = useState<
    { mode: "create" } | { mode: "complete"; profile: AppProfile } | null
  >(null);

  const isProfileIncomplete = (profile: AppProfile) => {
    const hasGenres = (profile.preferredGenres?.length || 0) > 0;
    const hasLanguages = (profile.preferredLanguages?.length || 0) > 0;
    return !hasGenres || !hasLanguages;
  };

  const firstIncompleteProfile = useMemo(
    () => profiles.find((profile) => isProfileIncomplete(profile)),
    [profiles],
  );

  useEffect(() => {
    if (!questionnaireContext && firstIncompleteProfile) {
      setQuestionnaireContext({ mode: "complete", profile: firstIncompleteProfile });
    }
  }, [questionnaireContext, firstIncompleteProfile]);

  const handleSelectProfile = async (profile: AppProfile) => {
    if (isProfileIncomplete(profile)) {
      setQuestionnaireContext({ mode: "complete", profile });
      return;
    }

    await setActiveProfile(profile.profileId);
    if (profile.accountType === "CHILD") {
      router.replace("/(child)");
    } else {
      // Parent profile — go straight to home; address selection is optional and available from settings
      router.replace("/(user)");
    }
  };

  const handleSignOut = async () => {
    await clearAuth();
    router.replace("/(auth)/welcome");
  };

  const handleQuestionnaireComplete = async (
    responses: Record<string, any>,
    profileData: any,
  ) => {
    const age = parseInt(String(responses.age || ""), 10);
    const safeAge = Number.isNaN(age) ? 18 : age;
    const ageGroup = numToAgeGroup(safeAge);
    const accountType = ageGroup === "15+" ? "PARENT" : "CHILD";

    if (questionnaireContext?.mode === "complete") {
      const profileToUpdate = questionnaireContext.profile;

      try {
        const res = await fetch(
          `${API_BASE_URL}/users/${userId}/profiles/${profileToUpdate.profileId}`,
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              name: profileData.name || profileToUpdate.name,
              ageGroup,
              preferredGenres: profileData.preferredGenres || [],
              preferredLanguages: profileData.preferredLanguages || [],
              questionnaireResponses: {
                age: safeAge,
                ...(profileData.metadata || {}),
                ...(responses || {}),
              },
              profilePreferences: profileData.profilePreferences || [],
            }),
          },
        );

        if (!res.ok) throw new Error("Profile update failed");
      } catch (err) {
        console.error("Profile questionnaire update failed:", err);
      }

      await updateProfile(profileToUpdate.profileId, {
        name: profileData.name || profileToUpdate.name,
        age: safeAge,
        ageGroup,
        preferredGenres: profileData.preferredGenres || [],
        preferredLanguages: profileData.preferredLanguages || [],
        questionnaireResponses: {
          age: safeAge,
          ...(profileData.metadata || {}),
          ...(responses || {}),
        },
        profilePreferences: profileData.profilePreferences || [],
      });

      setQuestionnaireContext(null);
      await setActiveProfile(profileToUpdate.profileId);
      if (profileToUpdate.accountType === "CHILD") {
        router.replace("/(child)");
      } else {
        router.replace("/(user)");
      }
      return;
    }

    try {
      // Save to backend
      const res = await fetch(`${API_BASE_URL}/users/${userId}/children`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: profileData.name,
          ageGroup,
          preferredGenres: profileData.preferredGenres || [],
          preferredLanguages: profileData.preferredLanguages || [],
          questionnaireResponses: {
            age: safeAge,
            ...(profileData.metadata || {}),
            ...(responses || {}),
          },
          profilePreferences: profileData.profilePreferences || [],
        }),
      });

      if (!res.ok) throw new Error('Backend save failed');

      const json = await res.json();
      const backendProfile = json?.data?.profile;

      // Update local store
      await addProfile({
        profileId: backendProfile?.profileId ?? String(Date.now() + Math.random()),
        name: profileData.name,
        accountType: backendProfile?.accountType ?? accountType,
        ageGroup,
        age: safeAge,
        preferredGenres: profileData.preferredGenres || [],
        preferredLanguages: profileData.preferredLanguages || [],
        questionnaireResponses: {
          age: safeAge,
          ...(profileData.metadata || {}),
          ...(responses || {}),
        },
        profilePreferences: profileData.profilePreferences || [],
      });

      handleCloseModal();
    } catch (err) {
      console.error('Profile save error:', err);
      // Fallback: save locally
      const age = parseInt(responses.age, 10);
      const ageGroup = numToAgeGroup(age);
      const accountType = ageGroup === '15+' ? 'PARENT' : 'CHILD';
      
      await addProfile({
        profileId: String(Date.now() + Math.random()),
        name: profileData.name,
        accountType,
        ageGroup,
        age: safeAge,
        preferredGenres: profileData.preferredGenres || [],
        preferredLanguages: profileData.preferredLanguages || [],
        questionnaireResponses: {
          age: safeAge,
          ...(profileData.metadata || {}),
          ...(responses || {}),
        },
        profilePreferences: profileData.profilePreferences || [],
      });

      handleCloseModal();
    }
  };
  
  const handleCloseModal = () => {
    setQuestionnaireContext(null);
  };

  type ListItem = AppProfile | { id: "__add__" };
  const data: ListItem[] = [...profiles, { id: "__add__" } as any];

  if (questionnaireContext) {
    const isCompleteMode = questionnaireContext.mode === "complete";
    const currentProfile = isCompleteMode
      ? (questionnaireContext as { mode: "complete"; profile: AppProfile }).profile
      : null;

    const forcedAccountType = currentProfile
      ? currentProfile.age >= 15
        ? "PARENT"
        : "CHILD"
      : undefined;

    return (
      <SafeAreaView style={s.safe}>
        <PersonalizedQuestionnaire
          forcedAccountType={forcedAccountType}
          initialResponses={
            currentProfile
              ? { name: currentProfile.name, age: String(currentProfile.age || "") }
              : undefined
          }
          onComplete={handleQuestionnaireComplete}
          onCancel={handleCloseModal}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <Text style={s.owl}>🦉</Text>
        <Text style={s.title}>Who&apos;s reading{"\n"}today?</Text>
        <Text style={s.subtitle}>Choose a profile to continue</Text>
      </View>

      <FlatList
        data={data}
        keyExtractor={(item) => (item as any).profileId ?? (item as any).id}
        numColumns={2}
        columnWrapperStyle={{ gap: CARD_GAP, justifyContent: "center" }}
        contentContainerStyle={s.grid}
        showsVerticalScrollIndicator={false}
        renderItem={({ item, index }) =>
          (item as any).id === "__add__" ? (
            <AddProfileCard
              onPress={() => {
                setQuestionnaireContext({ mode: "create" });
              }}
            />
          ) : (
            <ProfileCard
              profile={item as AppProfile}
              index={index}
              onPress={() => handleSelectProfile(item as AppProfile)}
            />
          )
        }
      />

      <TouchableOpacity style={s.signOutBtn} onPress={handleSignOut}>
        <Text style={s.signOutText}>← Sign out</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.lg,
    alignItems: "center",
  },
  owl: { fontSize: 48, marginBottom: Spacing.sm },
  title: {
    fontSize: Typography.display,
    fontWeight: "800",
    color: Colors.accentSage,
    textAlign: "center",
    lineHeight: 36,
  },
  subtitle: {
    fontSize: Typography.body,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
  },
  grid: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xl,
    gap: CARD_GAP,
  },
  card: {
    backgroundColor: Colors.card,
    borderRadius: Radius.xl,
    alignItems: "center",
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: Radius.full,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.sm,
  },
  avatarEmoji: { fontSize: 36 },
  profileName: {
    fontSize: Typography.body,
    fontWeight: "800",
    color: Colors.textPrimary,
    textAlign: "center",
    marginBottom: 6,
  },
  badge: {
    borderRadius: Radius.full,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  badgeText: { fontSize: Typography.label - 1, fontWeight: "700" },
  addCard: {
    borderWidth: 1.5,
    borderColor: Colors.accentSage,
    borderStyle: "dashed",
    backgroundColor: Colors.background,
  },
  addCircle: {
    width: 72,
    height: 72,
    borderRadius: Radius.full,
    backgroundColor: Colors.accentSageLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.sm,
  },
  addPlus: { fontSize: 32, color: Colors.accentSage, fontWeight: "300" },
  addLabel: {
    fontSize: Typography.body,
    fontWeight: "700",
    color: Colors.accentSage,
  },
  signOutBtn: {
    alignSelf: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    marginBottom: Spacing.lg,
  },
  signOutText: {
    fontSize: Typography.body,
    color: Colors.textSecondary,
    fontWeight: "600",
  },

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalCenter: { width: "100%", alignItems: "center" },
  modalCard: {
    backgroundColor: Colors.card,
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    width: width - Spacing.xl * 2,
    gap: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  modalTitle: {
    fontSize: Typography.title,
    fontWeight: "800",
    color: Colors.accentSage,
    textAlign: "center",
  },
  modalSubtitle: {
    fontSize: Typography.body,
    color: Colors.textSecondary,
    textAlign: "center",
  },
  label: {
    fontSize: Typography.label,
    fontWeight: "600",
    color: Colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  input: {
    backgroundColor: Colors.background,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
    fontSize: Typography.body,
    color: Colors.textPrimary,
    borderWidth: 1.5,
    borderColor: Colors.cardBorder,
  },
  errorText: {
    fontSize: Typography.label,
    color: Colors.error,
    textAlign: "center",
  },
  btnPrimary: {
    backgroundColor: Colors.buttonPrimary,
    borderRadius: Radius.full,
    paddingVertical: 16,
    alignItems: "center",
  },
  btnPrimaryText: {
    fontSize: Typography.body,
    fontWeight: "700",
    color: Colors.buttonPrimaryText,
  },
  btnCancel: {
    borderRadius: Radius.full,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: Colors.cardBorder,
  },
  btnCancelText: {
    fontSize: Typography.body,
    fontWeight: "600",
    color: Colors.textSecondary,
  },
});
