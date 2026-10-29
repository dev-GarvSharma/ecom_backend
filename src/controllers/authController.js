import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "node:crypto";
import { Op } from "sequelize";
import {
  User,
  VerificationChallenge,
  UserInteractionEvent,
  Role,
  Permission,
} from "../database/models/index.js";
import { ok, fail } from "../utils/http.js";
const access = (u) =>
  jwt.sign({ sub: u.id, role: u.role }, process.env.JWT_ACCESS_SECRET, {
    algorithm: "HS256",
    expiresIn: process.env.ACCESS_TOKEN_TTL || "15m",
    issuer: "ecom-api",
    audience: "ecom-client",
  });

const refresh = (u) =>
  jwt.sign({ sub: u.id, jti: crypto.randomUUID() }, process.env.JWT_REFRESH_SECRET, {
    algorithm: "HS256",
    expiresIn: process.env.REFRESH_TOKEN_TTL || "7d",
    issuer: "ecom-api",
    audience: "ecom-refresh",
  });

const cookie = {
  httpOnly: true,
  secure: process.env.COOKIE_SECURE === "true",
  sameSite: process.env.COOKIE_SAME_SITE || "lax",
  path: "/api/v1/auth",
  maxAge: 604800000,
};
const accessSummary = async (userId) => {
  const user = await User.findByPk(userId, {
    include: [
      { model: Role, as: "primaryRole", attributes: ["id", "name"] },
      { model: Role, as: "roles", attributes: ["id", "name"], through: { attributes: [] } },
      {
        model: Permission,
        as: "directPermissions",
        attributes: ["code"],
        through: { attributes: [] },
      },
    ],
  });
  const roles = user?.roles || [];
  const rolePermissions = roles.length
    ? await Permission.findAll({
        attributes: ["code"],
        include: [{ model: Role, as: "roles", where: { id: roles.map((role) => role.id) } }],
      })
    : [];
  const permissions = [
    ...new Set([
      ...rolePermissions.map((permission) => permission.code),
      ...(user?.directPermissions || []).map((permission) => permission.code),
    ]),
  ].sort();
  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      isVerified: user.isVerified,
      marketingEmailSubscribed: user.marketingEmailSubscribed,
      role: user.role,
      primaryRole: user.primaryRole?.name || null,
      roles: roles.map((role) => role.name),
      permissions,
    },
  };
};
async function issue(u, res) {
  const t = refresh(u);
  u.refreshTokenHash = await bcrypt.hash(t, 12);
  await u.save();
  res.cookie("refreshToken", t, cookie);
  return {
    ...(await accessSummary(u.id)),
    accessToken: access(u),
    tokenType: "Bearer",
    expiresIn: process.env.ACCESS_TOKEN_TTL || "15m",
  };
}
export const register = async (req, res) => {
  const name = String(req.body.name || "").trim();
  const email =
    String(req.body.email || "")
      .trim()
      .toLowerCase() || null;
  const phone = String(req.body.phone || "").replace(/[\s()-]/g, "");
  const marketingEmailSubscribed = req.body.marketingEmailSubscribed === true;
  if (name.length < 2 || !phone)
    return fail(res, 400, "Name and mobile number are required. Email is optional.");
  if (!/^\+[1-9]\d{7,14}$/.test(phone))
    return fail(res, 400, "Enter a mobile number in international format, such as +919876543210.");
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return fail(res, 400, "Enter a valid email address.");
  if (marketingEmailSubscribed && !email)
    return fail(res, 400, "Enter an email address to subscribe to campaign emails.");
  if (await User.unscoped().findOne({ where: { phone } }))
    return fail(res, 409, "Mobile number is already registered.");
  if (email && (await User.unscoped().findOne({ where: { email } })))
    return fail(res, 409, "Email address is already registered.");
  const customerRole = await Role.findOne({ where: { name: "customer" } });
  if (!customerRole) return fail(res, 503, "Default customer role is not configured.");
  const u = await User.create({
    name,
    email,
    phone,
    isVerified: false,
    marketingEmailSubscribed,
    marketingEmailSubscribedAt: marketingEmailSubscribed ? new Date() : null,
    roleId: customerRole.id,
  });
  await u.addRole(customerRole);
  const otp = await sendVerification(u, "sms", phone, "register");
  if (marketingEmailSubscribed)
    await UserInteractionEvent.create({
      userId: u.id,
      eventType: "marketing.email_subscribed",
      details: { email },
    });
  return ok(
    res,
    {
      userId: u.id,
      channel: "sms",
      destination: maskDestination(phone),
      expiresInSeconds: 600,
      ...(otp ? { otp } : {}),
    },
    "Verification code sent.",
    null,
    201,
  );
};

const maskDestination = (value) => `${value.slice(0, -4).replace(/\d/g, "*")}${value.slice(-4)}`;
const deliverCode = async (channel, destination, code) => {
  if (process.env.NODE_ENV !== "production" && process.env.OTP_DELIVERY_MODE !== "http") {
    return code;
  }
  const url = process.env.OTP_DELIVERY_URL;
  const token = process.env.OTP_DELIVERY_TOKEN;
  if (!url || !token || new URL(url).protocol !== "https:")
    throw Object.assign(new Error("Secure OTP delivery is not configured."), { status: 503 });
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify({ channel, destination, code }),
  });
  if (!response.ok) throw Object.assign(new Error("OTP delivery failed."), { status: 503 });
  return process.env.NODE_ENV === "production" ? undefined : code;
};
const sendVerification = async (user, channel, destination, purpose) => {
  const code = String(crypto.randomInt(0, 1000000)).padStart(6, "0");
  const secret = process.env.OTP_HASH_SECRET || process.env.JWT_REFRESH_SECRET;
  const codeHash = crypto
    .createHmac("sha256", secret)
    .update(`${destination}:${purpose}:${code}`)
    .digest("hex");
  await VerificationChallenge.update(
    { consumedAt: new Date() },
    { where: { destination, purpose, consumedAt: null } },
  );
  await VerificationChallenge.create({
    userId: user.id,
    purpose,
    channel,
    destination,
    codeHash,
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
  });
  return deliverCode(channel, destination, code);
};

export const requestVerification = async (req, res) => {
  const destination = String(req.body.phone || req.body.identifier || "").replace(/[\s()-]/g, "");
  if (!/^\+[1-9]\d{7,14}$/.test(destination))
    return fail(res, 400, "Enter a mobile number in international format.");
  const user = await User.unscoped().findOne({
    where: { phone: destination, status: "active" },
  });
  if (!user) return fail(res, 401, "Unable to verify account with those details.");
  const purpose = user.isVerified ? "login" : "verify_contact";
  const otp = await sendVerification(user, "sms", destination, purpose);
  return ok(
    res,
    {
      channel: "sms",
      destination: maskDestination(destination),
      purpose,
      expiresInSeconds: 600,
      ...(otp ? { otp } : {}),
    },
    "Verification code sent.",
  );
};

export const confirmVerification = async (req, res) => {
  const destination = String(req.body.phone || req.body.identifier || "").replace(/[\s()-]/g, "");
  if (!/^\+[1-9]\d{7,14}$/.test(destination))
    return fail(res, 400, "Enter a mobile number in international format.");
  const channel = "sms";
  const purpose = ["register", "verify_contact"].includes(req.body.purpose)
    ? req.body.purpose
    : "login";
  const challenge = await VerificationChallenge.findOne({
    where: { destination, channel, purpose, consumedAt: null },
    order: [["createdAt", "DESC"]],
  });
  if (!challenge || challenge.expiresAt < new Date() || challenge.attempts >= 5)
    return fail(res, 401, "Verification code is invalid or expired.");
  const received = crypto
    .createHmac("sha256", process.env.OTP_HASH_SECRET || process.env.JWT_REFRESH_SECRET)
    .update(`${destination}:${purpose}:${String(req.body.code || "")}`)
    .digest();
  const expected = Buffer.from(challenge.codeHash, "hex");
  if (received.length !== expected.length || !crypto.timingSafeEqual(received, expected)) {
    await challenge.increment("attempts");
    return fail(res, 401, "Verification code is invalid or expired.");
  }
  const user = await User.unscoped().findByPk(challenge.userId);
  if (!user || user.status !== "active") return fail(res, 401, "Account is unavailable.");
  if (purpose === "login" && !user.isVerified)
    return fail(res, 401, "Verify your mobile number before signing in.");
  await challenge.update({ consumedAt: new Date() });
  await user.update({ isVerified: true, lastLoginAt: new Date() });
  await UserInteractionEvent.create({
    userId: user.id,
    eventType: "auth.verified",
    details: { channel, purpose },
  });
  return ok(res, await issue(user, res), purpose === "login" ? "Signed in." : "Account verified.");
};
export const login = requestVerification;
export const me = async (req, res) =>
  ok(res, (await accessSummary(req.user.id)).user, "Profile loaded.");
export const updateProfile = async (req, res) => {
  if (!Object.hasOwn(req.body || {}, "email"))
    return fail(res, 400, "Only the account email can be updated here.");
  const email = String(req.body.email || "").trim().toLowerCase() || null;
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return fail(res, 400, "Enter a valid email address.");
  if (email && await User.unscoped().findOne({ where: { email, id: { [Op.ne]: req.user.id } } }))
    return fail(res, 409, "Email address is already registered.");
  const user = await User.unscoped().findByPk(req.user.id);
  const changed = user.email !== email;
  const wasSubscribed = user.marketingEmailSubscribed;
  await user.update({
    email,
    ...(changed ? {
      marketingEmailSubscribed: false,
      marketingEmailUnsubscribedAt: wasSubscribed ? new Date() : user.marketingEmailUnsubscribedAt,
    } : {}),
  });
  if (changed && wasSubscribed)
    await UserInteractionEvent.create({ userId: user.id, eventType: "marketing.email_unsubscribed", details: { source: "email_changed" } });
  return ok(res, { email: user.email, marketingEmailSubscribed: user.marketingEmailSubscribed }, "Account email updated.");
};
export const history = async (req, res) =>
  ok(
    res,
    await UserInteractionEvent.findAll({
      where: { userId: req.user.id },
      order: [["occurredAt", "DESC"]],
      limit: 100,
    }),
    "Account history loaded.",
  );

export const marketingPreferences = async (req, res) => {
  const user = await User.unscoped().findByPk(req.user.id);
  if (!user) return fail(res, 404, "Account not found.");
  if (req.method === "GET")
    return ok(res, {
      email: user.email,
      subscribed: user.marketingEmailSubscribed,
      subscribedAt: user.marketingEmailSubscribedAt,
      unsubscribedAt: user.marketingEmailUnsubscribedAt,
    }, "Marketing preferences loaded.");
  if (typeof req.body.subscribed !== "boolean")
    return fail(res, 400, "subscribed must be true or false.");
  if (req.body.subscribed && (!user.email || !user.isVerified || user.status !== "active"))
    return fail(res, 400, "Add an email address and verify your account before subscribing.");
  const now = new Date();
  await user.update({
    marketingEmailSubscribed: req.body.subscribed,
    marketingEmailSubscribedAt: req.body.subscribed ? now : user.marketingEmailSubscribedAt,
    marketingEmailUnsubscribedAt: req.body.subscribed ? null : now,
  });
  await UserInteractionEvent.create({
    userId: user.id,
    eventType: req.body.subscribed ? "marketing.email_subscribed" : "marketing.email_unsubscribed",
    details: { email: user.email },
  });
  return ok(res, { subscribed: user.marketingEmailSubscribed }, "Marketing preference saved.");
};
export const refreshToken = async (req, res) => {
  try {
    const t = req.cookies?.refreshToken;
    if (!t) return fail(res, 401, "Refresh session required.");
    const c = jwt.verify(t, process.env.JWT_REFRESH_SECRET, {
      algorithms: ["HS256"],
      issuer: "ecom-api",
      audience: "ecom-refresh",
    });
    const u = await User.unscoped().findByPk(c.sub);
    if (!u?.refreshTokenHash || !(await bcrypt.compare(t, u.refreshTokenHash)))
      return fail(res, 401, "Refresh session expired.");
    return ok(res, await issue(u, res), "Session refreshed.");
  } catch {
    return fail(res, 401, "Refresh session expired.");
  }
};
export const logout = async (req, res) => {
  const t = req.cookies?.refreshToken;
  if (t)
    try {
      const c = jwt.verify(t, process.env.JWT_REFRESH_SECRET);
      const u = await User.unscoped().findByPk(c.sub);
      if (u) {
        u.refreshTokenHash = null;
        await u.save();
      }
    } catch {}
  res.clearCookie("refreshToken", { ...cookie, maxAge: undefined });
  return ok(res, null, "Signed out.");
};
