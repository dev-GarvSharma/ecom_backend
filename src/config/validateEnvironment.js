const requiredVariables = [
  "MYSQL_DATABASE",
  "MYSQL_USER",
  "MYSQL_PASSWORD",
  "JWT_ACCESS_SECRET",
  "JWT_REFRESH_SECRET",
];

export default function validateEnvironment() {
  for (const key of requiredVariables) {
    if (!process.env[key]) throw new Error(`${key} is required`);
  }

  if (
    process.env.NODE_ENV === "production" &&
    ["JWT_ACCESS_SECRET", "JWT_REFRESH_SECRET"].some((key) => process.env[key].length < 32)
  ) {
    throw new Error("Production JWT secrets must each contain at least 32 characters.");
  }

  if (process.env.NODE_ENV === "production" && process.env.COOKIE_SECURE !== "true") {
    throw new Error("COOKIE_SECURE=true is required in production.");
  }

  if (
    process.env.NODE_ENV === "production" &&
    (!process.env.OTP_DELIVERY_URL || !process.env.OTP_DELIVERY_TOKEN)
  ) {
    throw new Error(
      "OTP_DELIVERY_URL and OTP_DELIVERY_TOKEN are required in production for verified sign-in.",
    );
  }

  if (
    process.env.NODE_ENV === "production" &&
    ["RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET", "RAZORPAY_WEBHOOK_SECRET"].some(
      (key) => !process.env[key],
    )
  ) {
    throw new Error("Razorpay API and webhook secrets are required for prepaid production checkout.");
  }
}
