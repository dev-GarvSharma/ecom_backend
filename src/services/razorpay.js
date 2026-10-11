const credentials = () => {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret)
    throw Object.assign(new Error("Razorpay is not configured."), { status: 503 });
  return { keyId, keySecret };
};

const request = async (endpoint, options = {}) => {
  const { keyId, keySecret } = credentials();
  const response = await fetch(`https://api.razorpay.com/v1${endpoint}`, {
    ...options,
    signal: AbortSignal.timeout(10000),
    headers: {
      Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok)
    throw Object.assign(
      new Error(result.error?.description || "Razorpay request failed."),
      { status: 502 },
    );
  return result;
};

export const createRazorpayOrder = (payload) =>
  request("/orders", { method: "POST", body: JSON.stringify(payload) });

export const fetchRazorpayPayment = (paymentId) =>
  request(`/payments/${encodeURIComponent(paymentId)}`);

export const getRazorpayKeyId = () => credentials().keyId;
