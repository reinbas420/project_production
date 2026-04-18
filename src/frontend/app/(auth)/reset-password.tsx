import { API_BASE_URL } from "@/constants/config";
import { Colors, Radius, Spacing, Typography } from "@/constants/theme";
import { useLocalSearchParams, useRouter } from "expo-router";
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

export default function ResetPasswordScreen() {
  const router = useRouter();
  const { email: paramEmail } = useLocalSearchParams<{ email?: string }>();
  const [email, setEmail] = useState(paramEmail ?? "");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  const handleResendOTP = async () => {
    if (resendCooldown > 0 || !email.trim()) return;
    setResending(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE_URL}/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Failed to resend OTP");
      setResendCooldown(60);
      const timer = setInterval(() => {
        setResendCooldown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (e: any) {
      setError(e.message || "Could not resend code.");
    } finally {
      setResending(false);
    }
  };

  const handleReset = async () => {
    if (!email.trim() || !otp.trim() || !password) {
      setError("Please fill in all fields.");
      return;
    }
    if (otp.trim().length !== 6) {
      setError("OTP must be 6 digits.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          otp: otp.trim(),
          newPassword: password,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Reset failed");

      router.replace("/(auth)/login");
    } catch (e: any) {
      setError(e.message || "Could not reset password. Please try again.");
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
            <Text style={st.emoji}>📬</Text>
            <Text style={st.title}>Enter Reset Code</Text>
            <Text style={st.subtitle}>
              We've sent a 6-digit code to your email. Enter it below with your
              new password.
            </Text>
          </View>
          <View style={st.form}>
            {!paramEmail && (
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
            )}
            <View style={st.fieldGroup}>
              <Text style={st.label}>Reset Code (OTP)</Text>
              <TextInput
                style={[st.input, st.otpInput]}
                placeholder="000000"
                placeholderTextColor={Colors.textMuted}
                keyboardType="number-pad"
                maxLength={6}
                autoCapitalize="none"
                autoCorrect={false}
                value={otp}
                onChangeText={setOtp}
              />
              <TouchableOpacity
                onPress={handleResendOTP}
                disabled={resendCooldown > 0 || resending}
                style={{ alignSelf: "center", marginTop: Spacing.xs }}
              >
                <Text
                  style={{
                    color:
                      resendCooldown > 0 ? Colors.textMuted : Colors.accentSage,
                    fontSize: Typography.label,
                    fontWeight: "600",
                  }}
                >
                  {resending
                    ? "Sending..."
                    : resendCooldown > 0
                      ? `Resend code in ${resendCooldown}s`
                      : "Resend code"}
                </Text>
              </TouchableOpacity>
            </View>
            <View style={st.fieldGroup}>
              <Text style={st.label}>New Password</Text>
              <View style={st.passwordRow}>
                <TextInput
                  style={[st.input, { flex: 1 }]}
                  placeholder="New password"
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

            {error ? <Text style={st.errorText}>{error}</Text> : null}

            <TouchableOpacity
              style={[st.btnPrimary, loading && { opacity: 0.7 }]}
              onPress={handleReset}
              activeOpacity={0.82}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={Colors.buttonPrimaryText} />
              ) : (
                <Text style={st.btnPrimaryText}>Reset Password</Text>
              )}
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
    lineHeight: 22,
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
  otpInput: {
    fontSize: 24,
    letterSpacing: 12,
    textAlign: "center",
    fontWeight: "700",
  },
  passwordRow: { flexDirection: "row", alignItems: "center", gap: Spacing.xs },
  eyeBtn: { paddingHorizontal: Spacing.xs },
  eyeIcon: { fontSize: 20 },
  errorText: {
    fontSize: Typography.label,
    color: Colors.error,
    textAlign: "center",
  },
  btnPrimary: {
    marginTop: Spacing.md,
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
});
