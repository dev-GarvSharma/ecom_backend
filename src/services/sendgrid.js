const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const sendGridConfig = () => {
  const apiKey = process.env.SENDGRID_API_KEY;
  const fromEmail = String(process.env.SENDGRID_FROM_EMAIL || "").trim().toLowerCase();
  const fromName = String(process.env.SENDGRID_FROM_NAME || "").trim();
  if (!apiKey || !emailPattern.test(fromEmail)) {
    throw Object.assign(
      new Error("SendGrid is not configured. Set SENDGRID_API_KEY and a verified SENDGRID_FROM_EMAIL."),
      { status: 503 },
    );
  }
  return { apiKey, from: { email: fromEmail, ...(fromName ? { name: fromName } : {}) } };
};

export const sendGridMail = async (payload) => {
  const { apiKey } = sendGridConfig();
  const baseUrl = String(process.env.SENDGRID_API_BASE_URL || "https://api.sendgrid.com").replace(/\/$/, "");
  if (!baseUrl.startsWith("https://"))
    throw Object.assign(new Error("SendGrid API base URL must use HTTPS."), { status: 503 });
  const response = await fetch(`${baseUrl}/v3/mail/send`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(30000),
  });
  if (response.status !== 202) {
    const detail = await response.text().catch(() => "");
    throw Object.assign(new Error(`SendGrid rejected the campaign batch (${response.status}). ${detail.slice(0, 700)}`), {
      status: 502,
    });
  }
  return response.headers.get("x-message-id");
};
