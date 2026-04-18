/**
 * StepEmailVerification — "Check your inbox" UI for OTP-based email verification.
 *
 * Shows a 6-digit OTP input. The OTP is sent by the backend via Nodemailer.
 */
import { Colors, Radius, Spacing, Typography } from "@/constants/theme";
import { sendVerificationEmail, verifyOTP } from "@/utils/emailVerification";
import React, { useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    Animated,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";

interface StepEmailVerificationProps {
  email: string;
  onVerified: () => void;
  onBack: () => void;
}

const RESEND_COOLDOWN = 60; // seconds

export default function StepEmailVerification({
  email,
  onVerified,
  onBack,
}: StepEmailVerificationProps) {
  const [timer, setTimer] = useState(RESEND_COOLDOWN);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const pulse = useRef(new Animated.Value(1)).current;

  // ── Pulse animation for mail icon ─────────────────────────────────────────
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1.12,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  // ── Countdown timer ───────────────────────────────────────────────────────
  useEffect(() => {
    if (timer <= 0) return;
    const id = setTimeout(() => setTimer((t) => t - 1), 1000);
    return () => clearTimeout(id);
  }, [timer]);

  // ── Resend ────────────────────────────────────────────────────────────────
  const handleResend = async () => {
    setError("");
    try {
      await sendVerificationEmail(email);
      setTimer(RESEND_COOLDOWN);
    } catch (e: any) {
      setError(e.message || "Could not resend email.");
    }
  };

  // ── OTP verify ────────────────────────────────────────────────────────────
  const handleOTPVerify = async () => {
    const code = otpCode.trim();
    if (code.length !== 6) {
      setError("Please enter the 6-digit code.");
      return;
    }
    setVerifying(true);
    setError("");
    try {
      await verifyOTP(email, code);
      onVerified();
    } catch (e: any) {
      setError(e.message || "Verification failed. Please try again.");
      setVerifying(false);
    }
  };

  return (
    <View style={st.container}>
      <Animated.Text style={[st.mailIcon, { transform: [{ scale: pulse }] }]}>
        📧
      </Animated.Text>

      <Text style={st.title}>Check your inbox</Text>
      <Text style={st.subtitle}>
        We sent a verification code to{"\n"}
        <Text style={st.emailHighlight}>{email}</Text>
      </Text>

      <Text style={st.body}>
        Enter the 6-digit code from the email to verify your account.
      </Text>

      <TextInput
        style={st.otpInput}
        placeholder="000000"
        placeholderTextColor={Colors.textMuted}
        value={otpCode}
        onChangeText={(t) => setOtpCode(t.replace(/[^0-9]/g, "").slice(0, 6))}
        keyboardType="number-pad"
        maxLength={6}
        autoFocus
      />

      {error ? <Text style={st.errorText}>{error}</Text> : null}

      <TouchableOpacity
        style={[st.verifyBtn, verifying && { opacity: 0.7 }]}
        onPress={handleOTPVerify}
        disabled={verifying}
        activeOpacity={0.82}
      >
        {verifying ? (
          <ActivityIndicator color={Colors.buttonPrimaryText} />
        ) : (
          <Text style={st.verifyBtnText}>Verify Code</Text>
        )}
      </TouchableOpacity>

      {/* Resend button */}
      <TouchableOpacity
        style={[st.resendBtn, timer > 0 && st.resendDisabled]}
        disabled={timer > 0}
        onPress={handleResend}
      >
        <Text style={[st.resendText, timer > 0 && { color: Colors.textMuted }]}>
          {timer > 0 ? `Resend in ${timer}s` : "Resend verification email"}
        </Text>
      </TouchableOpacity>

      {/* Back button */}
      <TouchableOpacity style={st.backBtn} onPress={onBack}>
        <Text style={st.backText}>← Change email</Text>
      </TouchableOpacity>
    </View>
  );
}

const st = StyleSheet.create({
  container: { gap: Spacing.md, alignItems: "center", paddingTop: Spacing.xl },
  mailIcon: { fontSize: 64, marginBottom: Spacing.sm },
  title: {
    fontSize: Typography.title + 2,
    fontWeight: "800",
    color: Colors.accentSage,
    textAlign: "center",
  },
  subtitle: {
    fontSize: Typography.body,
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 24,
  },
  emailHighlight: {
    fontWeight: "700",
    color: Colors.accentPeriwinkle,
  },
  body: {
    fontSize: Typography.body - 1,
    color: Colors.textMuted,
    textAlign: "center",
    lineHeight: 22,
    paddingHorizontal: Spacing.md,
  },
  otpInput: {
    fontSize: 32,
    fontWeight: "700",
    letterSpacing: 12,
    textAlign: "center",
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.xl,
    paddingVertical: 16,
    borderWidth: 2,
    borderColor: Colors.accentSage,
    color: Colors.textPrimary,
    width: "80%",
  },
  verifyBtn: {
    backgroundColor: Colors.buttonPrimary,
    borderRadius: Radius.full,
    paddingVertical: 16,
    alignSelf: "stretch",
    alignItems: "center",
  },
  verifyBtnText: {
    fontSize: Typography.body,
    fontWeight: "700",
    color: Colors.buttonPrimaryText,
  },
  errorText: {
    fontSize: Typography.label,
    color: Colors.error,
    textAlign: "center",
  },
  resendBtn: {
    paddingVertical: 12,
    paddingHorizontal: Spacing.xl,
    borderRadius: Radius.full,
    borderWidth: 1.5,
    borderColor: Colors.accentSage,
  },
  resendDisabled: {
    borderColor: Colors.cardBorder,
  },
  resendText: {
    fontSize: Typography.body,
    fontWeight: "600",
    color: Colors.accentSage,
  },
  backBtn: {
    borderRadius: Radius.full,
    paddingVertical: 14,
    paddingHorizontal: Spacing.xl,
    borderWidth: 1.5,
    borderColor: Colors.cardBorder,
    alignSelf: "stretch",
    alignItems: "center",
    marginTop: Spacing.sm,
  },
  backText: {
    fontSize: Typography.body,
    fontWeight: "600",
    color: Colors.textSecondary,
  },
});
