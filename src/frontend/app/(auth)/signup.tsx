import PersonalizedQuestionnaire from "@/components/PersonalizedQuestionnaire";
import StepEmailVerification from "@/components/StepEmailVerification";
import { API_BASE_URL } from "@/constants/config";
import { Colors, Radius, Spacing, Typography } from "@/constants/theme";
import useAppStore, { numToAgeGroup } from "@/store/useAppStore";
import { sendVerificationEmail } from "@/utils/emailVerification";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
    ActivityIndicator,
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

interface ProfileForm {
  name: string;
  age: string;
  genres: string[];
  languages: string[];
  questionnaireResponses?: Record<string, any>;
  profilePreferences?: {
    questionId: string;
    question: string;
    answer: string | string[];
  }[];
}

function StepIndicator({ total, current }: { total: number; current: number }) {
  return (
    <View style={{ flexDirection: "row", gap: 8, marginBottom: Spacing.xl }}>
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          style={[
            st.dot,
            i < current
              ? st.dotDone
              : i === current
                ? st.dotActive
                : st.dotInactive,
          ]}
        />
      ))}
    </View>
  );
}

function StepDetails({
  form,
  onChange,
  onNext,
  onBack,
  error,
  sending,
}: {
  form: {
    name: string;
    email: string;
    phone: string;
    password: string;
    confirm: string;
  };
  onChange: (key: string, val: string) => void;
  onNext: () => void;
  onBack: () => void;
  error: string;
  sending: boolean;
}) {
  const [showPw, setShowPw] = useState(false);
  const fields = [
    {
      key: "name",
      label: "Full Name",
      placeholder: "Your name",
      keyboard: "default",
    },
    {
      key: "email",
      label: "Email address",
      placeholder: "you@example.com",
      keyboard: "email-address",
    },
    {
      key: "phone",
      label: "Phone number",
      placeholder: "9999999999",
      keyboard: "phone-pad",
      maxLength: 10,
    },
    {
      key: "password",
      label: "Password",
      placeholder: "Min. 6 characters",
      keyboard: "default",
      secure: true,
    },
    {
      key: "confirm",
      label: "Confirm Password",
      placeholder: "Repeat password",
      keyboard: "default",
      secure: true,
    },
  ];
  return (
    <View style={{ gap: Spacing.md }}>
      <Text style={st.stepTitle}>Create account</Text>
      <Text style={st.stepSubtitle}>
        Fill in your details to get started as a Reader.
      </Text>
      {fields.map((f) => (
        <View key={f.key} style={{ gap: Spacing.xs }}>
          <Text style={st.label}>{f.label}</Text>
          <TextInput
            style={st.input}
            placeholder={f.placeholder}
            placeholderTextColor={Colors.textMuted}
            secureTextEntry={!!(f.secure && !showPw)}
            keyboardType={f.keyboard as any}
            autoCapitalize={f.key === "name" ? "words" : "none"}
            autoCorrect={false}
            maxLength={f.maxLength}
            value={(form as any)[f.key]}
            onChangeText={(v) => onChange(f.key, v)}
          />
        </View>
      ))}
      <TouchableOpacity
        onPress={() => setShowPw((v) => !v)}
        style={{ alignSelf: "flex-end" }}
      >
        <Text style={st.togglePw}>
          {showPw ? "Hide password" : "Show password"}
        </Text>
      </TouchableOpacity>
      {error ? <Text style={st.errorText}>{error}</Text> : null}
      <TouchableOpacity
        style={[st.btnPrimary, sending && { opacity: 0.7 }]}
        activeOpacity={0.82}
        onPress={onNext}
        disabled={sending}
      >
        {sending ? (
          <ActivityIndicator color={Colors.buttonPrimaryText} />
        ) : (
          <Text style={st.btnPrimaryText}>Continue →</Text>
        )}
      </TouchableOpacity>
      <TouchableOpacity style={st.btnBack} onPress={onBack}>
        <Text style={st.btnBackText}>← Go back</Text>
      </TouchableOpacity>
    </View>
  );
}

function StepAddProfile({
  profiles,
  onStartAddProfile,
  onNext,
  onBack,
  loading,
}: {
  profiles: ProfileForm[];
  onStartAddProfile: () => void;
  onNext: () => void;
  onBack: () => void;
  loading?: boolean;
}) {
  return (
    <View style={{ gap: Spacing.md }}>
      <Text style={st.stepTitle}>Add a profile</Text>
      <Text style={st.stepSubtitle}>
        Want to set up a profile for your child or another family member? You can
        add multiple profiles under one account.
        This helps us recommend books tailored to each person&apos;s taste and reading.
      </Text>
      {profiles.map((p, i) => (
        <View key={i} style={st.profileChip}>
          <Text style={st.profileChipEmoji}>
            {parseInt(p.age) <= 10 ? "🧒" : "👤"}
          </Text>
          <View style={{ flex: 1 }}>
            <Text style={st.profileChipText}>
              {p.name}{" "}
              <Text style={{ color: Colors.textMuted }}>· Age {p.age}</Text>
            </Text>
            {p.genres.length > 0 && (
              <Text style={st.profileChipGenres}>
                {p.genres.join(", ")} • {p.languages.join(", ")}
              </Text>
            )}
          </View>
        </View>
      ))}
        <TouchableOpacity style={st.addAnotherBtn} onPress={onStartAddProfile}>
          <Text style={st.addAnotherText}>＋ Add a profile</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[st.btnPrimary, loading && { opacity: 0.7 }]}
          activeOpacity={0.82}
          onPress={onNext}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={Colors.buttonPrimaryText} />
          ) : (
            <Text style={st.btnPrimaryText}>
              {profiles.length > 0 ? "Continue →" : "Skip for now →"}
            </Text>
          )}
        </TouchableOpacity>
    </View>
  );
}

export default function SignupScreen() {
  const router = useRouter();
  const { setAuth, addProfile } = useAppStore();
  // Four-step flow (Netflix style — own profile first, then others):
  //   0 = Account Details
  //   1 = Email Verification
  //   2 = Your Preferences (languages + genres)
  //   3 = Add Other Profiles (children / family members)
  const [step, setStep] = useState(0);
  const [details, setDetails] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    confirm: "",
  });
  const [profiles, setProfiles] = useState<ProfileForm[]>([]);
  const [parentGenres, setParentGenres] = useState<string[]>([]);
  const [parentLanguages, setParentLanguages] = useState<string[]>([]);
  const [parentQuestionnaireResponses, setParentQuestionnaireResponses] = useState<Record<string, any>>({});
  const [parentProfilePreferences, setParentProfilePreferences] = useState<ProfileForm["profilePreferences"]>([]);
  const [showAddProfileQuestionnaire, setShowAddProfileQuestionnaire] = useState(false);
  const [detailsError, setDetailsError] = useState("");
  const [loading, setLoading] = useState(false);
  const [globalError, setGlobalError] = useState("");
  const [sendingLink, setSendingLink] = useState(false);

  // ... (rest of the file remains exactly the same logic, except handleFinish signature)
  const handleDetailsNext = async () => {
    const { name, email, phone, password, confirm } = details;
    if (!name || !email || !phone || !password || !confirm) {
      setDetailsError("All fields are required.");
      return;
    }
    if (!/^\d{10}$/.test(phone)) {
      setDetailsError("Phone number must be exactly 10 digits.");
      return;
    }
    if (password.length < 6) {
      setDetailsError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      setDetailsError("Passwords do not match.");
      return;
    }
    setDetailsError("");

    // Send email verification link
    setSendingLink(true);
    try {
      const emailToCheck = email.trim().toLowerCase();
      // First, check if email is already registered
      const checkRes = await fetch(`${API_BASE_URL}/auth/check-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailToCheck }),
      });
      const checkJson = await checkRes.json();

      if (!checkRes.ok) {
        setDetailsError(
          checkJson.message || "Could not verify email. Please try again.",
        );
        setSendingLink(false);
        return;
      }

      if (checkJson.data?.available === false) {
        setDetailsError(
          checkJson.data?.message || "Email is already registered.",
        );
        setSendingLink(false);
        return;
      }

      await sendVerificationEmail(emailToCheck);
      setStep(1);
    } catch (e: any) {
      setDetailsError(e.message || "Could not send verification email.");
    } finally {
      setSendingLink(false);
    }
  };

  const handleEmailVerified = () => {
    setStep(2);
  };

  const handleParentQuestionnaireComplete = async (
    responses: Record<string, any>,
    profileData: any,
  ) => {
    setParentGenres(profileData.preferredGenres || []);
    setParentLanguages(profileData.preferredLanguages || []);
    setParentQuestionnaireResponses({
      ...(responses || {}),
      ...(profileData.metadata || {}),
    });
    setParentProfilePreferences(profileData.profilePreferences || []);
    setStep(3);
  };

  const handleAdditionalProfileQuestionnaireComplete = async (
    responses: Record<string, any>,
    profileData: any,
  ) => {
    const parsedAge = parseInt(String(responses.age || ""), 10);
    const safeAge = Number.isNaN(parsedAge) ? 10 : parsedAge;

    setProfiles((prev) => [
      ...prev,
      {
        name: profileData.name || "",
        age: String(safeAge),
        genres: profileData.preferredGenres || [],
        languages: profileData.preferredLanguages || [],
        questionnaireResponses: {
          ...(responses || {}),
          ...(profileData.metadata || {}),
        },
        profilePreferences: profileData.profilePreferences || [],
      },
    ]);
    setShowAddProfileQuestionnaire(false);
  };

  const handleFinish = async (
    parentGenres: string[],
    parentLanguages: string[],
  ) => {
    setLoading(true);
    setGlobalError("");
    try {
      const res = await fetch(`${API_BASE_URL}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: details.email.trim().toLowerCase(),
          password: details.password,
          phone: details.phone.replace(/\s/g, ""),
          name: details.name.trim(),
          role: "USER",
          preferredGenres: parentGenres,
          preferredLanguages: parentLanguages,
          questionnaireResponses: parentQuestionnaireResponses,
          profilePreferences: parentProfilePreferences,
          emailVerified: true,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Registration failed");
      const { token, user } = json.data;

      await setAuth({
        userId: user.id,
        email: user.email,
        token,
        role: "USER",
        profiles: user.profiles ?? [],
      });

      const parentProfileId = user?.profiles?.[0]?.profileId;
      if (parentProfileId) {
        try {
          await fetch(
            `${API_BASE_URL}/users/${user.id}/profiles/${parentProfileId}`,
            {
              method: "PUT",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({
                name: details.name.trim(),
                ageGroup: "15+",
                preferredGenres: parentGenres,
                preferredLanguages: parentLanguages,
                questionnaireResponses: parentQuestionnaireResponses,
                profilePreferences: parentProfilePreferences || [],
              }),
            },
          );

          const refreshedUserRes = await fetch(`${API_BASE_URL}/users/${user.id}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const refreshedUserJson = await refreshedUserRes.json();
          const refreshedUser = refreshedUserJson?.data?.user;
          if (refreshedUser) {
            await setAuth({
              userId: refreshedUser._id,
              email: refreshedUser.email,
              token,
              role: "USER",
              profiles: refreshedUser.profiles ?? [],
            });
          }
        } catch {
          // Non-blocking: child profile creation and onboarding should continue
        }
      }

      for (const cp of profiles) {
        const ageNum = parseInt(cp.age, 10);
        const ageGroup = numToAgeGroup(ageNum);
        // "15+" profiles get the adult view with a content filter for 16+/18+ books.
        const accountType = ageGroup === '15+' ? 'PARENT' : 'CHILD';
        try {
          const childRes = await fetch(
            `${API_BASE_URL}/users/${user.id}/children`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({
                name: cp.name,
                ageGroup,
                preferredGenres: cp.genres,
                preferredLanguages: cp.languages,
                questionnaireResponses: cp.questionnaireResponses || {},
                profilePreferences: cp.profilePreferences || [],
              }),
            },
          );
          const childJson = await childRes.json();
          const backendProfile = childJson?.data?.profile;
          await addProfile({
            profileId:
              backendProfile?.profileId ?? String(Date.now() + Math.random()),
            name: cp.name,
            accountType: backendProfile?.accountType ?? accountType,
            ageGroup,
            age: ageNum,
            preferredGenres: cp.genres,
            preferredLanguages: cp.languages,
            questionnaireResponses: cp.questionnaireResponses || {},
            profilePreferences: cp.profilePreferences || [],
          });
        } catch {
          await addProfile({
            profileId: String(Date.now() + Math.random()),
            name: cp.name,
            accountType,
            ageGroup,
            age: ageNum,
            preferredGenres: cp.genres,
            preferredLanguages: cp.languages,
            questionnaireResponses: cp.questionnaireResponses || {},
            profilePreferences: cp.profilePreferences || [],
          });
        }
      }
      router.replace("/(user)/delivery-map?next=select-profile");
    } catch (e: any) {
      setGlobalError(e.message || "Registration failed. Please try again.");
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={st.safe}>
      {(step === 2 || showAddProfileQuestionnaire) && (
        <PersonalizedQuestionnaire
          forcedAccountType={step === 2 ? "PARENT" : undefined}
          initialResponses={
            step === 2
              ? {
                  name: details.name,
                  age: "25",
                }
              : undefined
          }
          onComplete={
            step === 2
              ? handleParentQuestionnaireComplete
              : handleAdditionalProfileQuestionnaireComplete
          }
          onCancel={() => {
            if (step === 2) {
              setStep(1);
            } else {
              setShowAddProfileQuestionnaire(false);
            }
          }}
        />
      )}
      {step !== 2 && !showAddProfileQuestionnaire && (
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
      >
        <ScrollView
          contentContainerStyle={st.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {step < 2 && (
            <TouchableOpacity
              style={st.backBtn}
              onPress={() =>
                step > 0 ? setStep((s) => Math.max(0, s - 1)) : router.back()
              }
            >
              <Text style={st.backArrow}>←</Text>
            </TouchableOpacity>
          )}
          <StepIndicator total={4} current={step} />
          {globalError ? (
            <Text style={[st.errorText, { marginBottom: Spacing.md }]}>
              {globalError}
            </Text>
          ) : null}

          {step === 0 && (
            <StepDetails
              form={details}
              onChange={(k, v) => setDetails((p) => ({ ...p, [k]: v }))}
              onNext={handleDetailsNext}
              onBack={() => router.back()}
              error={detailsError}
              sending={sendingLink}
            />
          )}

          {step === 1 && (
            <StepEmailVerification
              email={details.email.trim().toLowerCase()}
              onVerified={handleEmailVerified}
              onBack={() => setStep(0)}
            />
          )}

          {step === 3 && (
            <StepAddProfile
              profiles={profiles}
              onStartAddProfile={() => setShowAddProfileQuestionnaire(true)}
              onNext={() => handleFinish(parentGenres, parentLanguages)}
              onBack={() => setStep(2)}
              loading={loading}
            />
          )}

          {step === 0 && (
            <View style={st.footerRow}>
              <Text style={st.footerText}>Already have an account? </Text>
              <TouchableOpacity onPress={() => router.replace("/login")}>
                <Text style={st.footerLink}>Sign In</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
    paddingBottom: 120,
  },
  backBtn: {
    marginTop: Spacing.xs,
    width: 44,
    height: 44,
    borderRadius: Radius.full,
    backgroundColor: Colors.card,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  backArrow: { fontSize: 20, color: Colors.accentSage, fontWeight: "700" },
  dot: { height: 8, borderRadius: Radius.full },
  dotActive: { backgroundColor: Colors.accentSage, width: 28 },
  dotDone: { backgroundColor: Colors.accentSageLight, width: 16 },
  dotInactive: { backgroundColor: Colors.cardBorder, width: 16 },
  stepTitle: {
    fontSize: Typography.title + 2,
    fontWeight: "800",
    color: Colors.accentSage,
  },
  stepSubtitle: {
    fontSize: Typography.body,
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  label: {
    fontSize: Typography.label,
    fontWeight: "600",
    color: Colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  input: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
    fontSize: Typography.body,
    color: Colors.textPrimary,
    borderWidth: 1.5,
    borderColor: Colors.cardBorder,
  },
  togglePw: {
    fontSize: Typography.label,
    color: Colors.accentPeriwinkle,
    fontWeight: "600",
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
  btnDisabled: { opacity: 0.45 },
  btnBack: {
    borderRadius: Radius.full,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: Colors.cardBorder,
  },
  btnBackText: {
    fontSize: Typography.body,
    fontWeight: "600",
    color: Colors.textSecondary,
  },
  profileChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  profileChipEmoji: { fontSize: 24 },
  profileChipText: {
    fontSize: Typography.body,
    fontWeight: "700",
    color: Colors.textPrimary,
  },
  profileChipGenres: {
    fontSize: Typography.label,
    color: Colors.accentPeriwinkle,
    marginTop: 2,
  },
  addAnotherBtn: {
    borderWidth: 1.5,
    borderColor: Colors.accentSage,
    borderStyle: "dashed",
    borderRadius: Radius.lg,
    paddingVertical: 14,
    alignItems: "center",
  },
  addAnotherText: {
    fontSize: Typography.body,
    color: Colors.accentSage,
    fontWeight: "700",
  },
  addForm: { gap: Spacing.md },
  footerRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: Spacing.xl,
  },
  footerText: { fontSize: Typography.body, color: Colors.textSecondary },
  footerLink: {
    fontSize: Typography.body,
    color: Colors.accentSage,
    fontWeight: "700",
  },
});
