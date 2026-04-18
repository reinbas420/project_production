import { API_BASE_URL } from "@/constants/config";
import { Colors, Radius, Spacing, Typography } from "@/constants/theme";
import useAppStore, { AppRole } from "@/store/useAppStore";
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

export default function LoginScreen() {
  const router = useRouter();
  const { setAuth, setHasDeliveryAddress } = useAppStore();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSignIn = async () => {
    if (!email.trim() || !password) {
      setError("Please fill in all fields.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Login failed");
      const { token, user } = json.data;
      const role: AppRole =
        user.role === "LIBRARIAN"
          ? "LIBRARIAN"
          : user.role === "ADMIN"
            ? "ADMIN"
            : "USER";
      await setAuth({
        userId: user.id,
        email: user.email,
        token,
        role,
        profiles: user.profiles ?? [],
      });

      if (role === "LIBRARIAN") router.replace("/(librarian)");
      else if (role === "ADMIN") router.replace("/(admin)");
      else router.replace("/(select-profile)");
    } catch (e: any) {
      setError(e.message || "Could not sign in. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={st.safe}>
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
          <TouchableOpacity style={st.backBtn} onPress={() => router.back()}>
            <Text style={st.backArrow}>←</Text>
          </TouchableOpacity>
          <View style={st.header}>
            <Text style={st.title}>Welcome back</Text>
            <Text style={st.subtitle}>Sign in to your account</Text>
          </View>
          <View style={st.form}>
            <View style={st.fieldGroup}>
              <Text style={st.label}>Email address</Text>
              <TextInput
                style={st.input}
                placeholder="you@example.com"
                placeholderTextColor={Colors.textMuted}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                value={email}
                onChangeText={setEmail}
              />
            </View>
            <View style={st.fieldGroup}>
              <Text style={st.label}>Password</Text>
              <View style={st.passwordRow}>
                <TextInput
                  style={[st.input, { flex: 1 }]}
                  placeholder="Enter your password"
                  placeholderTextColor={Colors.textMuted}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  value={password}
                  onChangeText={setPassword}
                />
                <TouchableOpacity
                  style={st.eyeBtn}
                  onPress={() => setShowPassword((v) => !v)}
                >
                  <Text style={st.eyeIcon}>{showPassword ? "🙈" : "👁️"}</Text>
                </TouchableOpacity>
              </View>
            </View>
            <TouchableOpacity
              style={st.forgotBtn}
              onPress={() => router.push("/(auth)/forgot-password")}
            >
              <Text style={st.forgotText}>Forgot password?</Text>
            </TouchableOpacity>
            {error ? <Text style={st.errorText}>{error}</Text> : null}
            <TouchableOpacity
              style={[st.btnPrimary, loading && { opacity: 0.7 }]}
              onPress={handleSignIn}
              activeOpacity={0.82}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={Colors.buttonPrimaryText} />
              ) : (
                <Text style={st.btnPrimaryText}>Sign In</Text>
              )}
            </TouchableOpacity>
          </View>
          <View style={st.footerRow}>
            <Text style={st.footerText}>New here? </Text>
            <TouchableOpacity onPress={() => router.replace("/signup")}>
              <Text style={st.footerLink}>Create an account</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  scroll: { flexGrow: 1, paddingHorizontal: Spacing.xl, paddingBottom: 120 },
  backBtn: {
    marginTop: Spacing.md,
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
  header: { marginTop: Spacing.xl, marginBottom: Spacing.xl },
  emoji: { fontSize: 48, marginBottom: Spacing.sm },
  title: {
    fontSize: Typography.display,
    fontWeight: "800",
    color: Colors.accentSage,
  },
  subtitle: {
    fontSize: Typography.body,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
  },
  form: { gap: Spacing.md },
  fieldGroup: { gap: Spacing.xs },
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
  passwordRow: { flexDirection: "row", alignItems: "center", gap: Spacing.xs },
  eyeBtn: { paddingHorizontal: Spacing.xs },
  eyeIcon: { fontSize: 20 },
  forgotBtn: { alignSelf: "flex-end" },
  forgotText: {
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
    marginTop: Spacing.sm,
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
