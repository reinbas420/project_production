/**
 * Email verification helpers — backend OTP flow.
 *
 * Sends a 6-digit OTP via the backend (Nodemailer) and verifies it
 * against `POST /auth/verify-otp`.
 */
import { API_BASE_URL } from "@/constants/config";

/**
 * Send a verification OTP email via the backend.
 */
export async function sendVerificationEmail(email: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/auth/send-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: email.trim().toLowerCase() }),
  });
  const json = await res.json();
  if (!res.ok)
    throw new Error(json.message || "Failed to send verification email");
  if (json.data?.previewUrl) {
    console.log(`📧 Email preview: ${json.data.previewUrl}`);
  }
}

/**
 * Verify a 6-digit OTP code against the backend.
 */
export async function verifyOTP(email: string, otp: string): Promise<boolean> {
  const res = await fetch(`${API_BASE_URL}/auth/verify-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: email.trim().toLowerCase(), otp }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || "Verification failed");
  return json.data?.verified === true;
}
