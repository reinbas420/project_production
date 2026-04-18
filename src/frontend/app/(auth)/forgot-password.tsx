import { API_BASE_URL } from "@/constants/config";
import { Colors, Radius, Spacing, Typography } from "@/constants/theme";
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

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleRequestOTP = async () => {
    if (!email.trim()) {
      setError("Please enter your email address.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const trimmedEmail = email.trim().toLowerCase();

      const res = await fetch(`${API_BASE_URL}/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmedEmail }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Failed to send reset OTP");

      // Navigate to reset screen with the email so user doesn't re-enter it
      router.push({
        pathname: "/(auth)/reset-password",
        params: { email: trimmedEmail },
      });
    } catch (e: any) {
      setError(e.message || "Could not send reset code. Please try again.");
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
            <Text style={st.emoji}>🔒</Text>
            <Text style={st.title}>Reset Password</Text>
            <Text style={st.subtitle}>
              Enter your email address and we'll send you a 6-digit code to
              reset your password.
            </Text>
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

            {error ? <Text style={st.errorText}>{error}</Text> : null}

            <TouchableOpacity
              style={[st.btnPrimary, loading && { opacity: 0.7 }]}
              onPress={handleRequestOTP}
              activeOpacity={0.82}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={Colors.buttonPrimaryText} />
              ) : (
                <Text style={st.btnPrimaryText}>Send Reset Code</Text>
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
