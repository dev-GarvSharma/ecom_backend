const credentials = (mode = "live") => {
  const keyId = mode === "test" ? process.env.RAZORPAY_TEST_KEY_ID : process.env.RAZORPAY_KEY_ID;
  const keySecret =
    mode === "test" ? process.env.RAZORPAY_TEST_KEY_SECRET : process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret)
    throw Object.assign(new Error("Razorpay is not configured."), { status: 503 });
  return { keyId, keySecret };
};

const request = async (endpoint, options = {}, mode = "live") => {
  const { keyId, keySecret } = credentials(mode);
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
    throw Object.assign(new Error(result.error?.description || "Razorpay request failed."), {
      status: 502,
    });
  return result;
};

export const createRazorpayOrder = (payload, mode = "live") =>
  request("/orders", { method: "POST", body: JSON.stringify(payload) }, mode);

export const fetchRazorpayPayment = (paymentId, mode = "live") =>
  request(`/payments/${encodeURIComponent(paymentId)}`, {}, mode);

export const getRazorpayKeyId = (mode = "live") => credentials(mode).keyId;
export const getRazorpayKeySecret = (mode = "live") => credentials(mode).keySecret;
