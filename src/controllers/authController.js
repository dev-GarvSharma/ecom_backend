import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "node:crypto";
import { User } from "../database/models/index.js";
import { ok, fail } from "../utils/http.js";
const access = (u) =>
  jwt.sign({ sub: u.id, role: u.role }, process.env.JWT_ACCESS_SECRET, {
    algorithm: "HS256",
    expiresIn: process.env.ACCESS_TOKEN_TTL || "15m",
    issuer: "ecom-api",
    audience: "ecom-client",
  });

const refresh = (u) =>
  jwt.sign(
    { sub: u.id, jti: crypto.randomUUID() },
    process.env.JWT_REFRESH_SECRET,
    {
      algorithm: "HS256",
      expiresIn: process.env.REFRESH_TOKEN_TTL || "7d",
      issuer: "ecom-api",
      audience: "ecom-refresh",
    },
  );

const cookie = {
  httpOnly: true,
  secure: process.env.COOKIE_SECURE === "true",
  sameSite: process.env.COOKIE_SAME_SITE || "lax",
  path: "/api/v1/auth",
  maxAge: 604800000,
};
async function issue(u, res) {
  const t = refresh(u);
  u.refreshTokenHash = await bcrypt.hash(t, 12);
  await u.save();
  res.cookie("refreshToken", t, cookie);
  return {
    user: { id: u.id, name: u.name, email: u.email, role: u.role },
    accessToken: access(u),
    tokenType: "Bearer",
    expiresIn: process.env.ACCESS_TOKEN_TTL || "15m",
  };
}
export const register = async (req, res) => {
  const { name, email, password } = req.body;
  if (
    typeof name !== "string" ||
    name.trim().length < 2 ||
    typeof email !== "string" ||
    typeof password !== "string" ||
    password.length < 12
  )
    return fail(
      res,
      400,
      "Name, email, and password of at least 12 characters are required.",
    );
  const normalized = email.trim().toLowerCase();
  if (await User.unscoped().findOne({ where: { email: normalized } }))
    return fail(res, 409, "Email is already registered.");
  const u = await User.create({
    name: name.trim(),
    email: normalized,
    passwordHash: await bcrypt.hash(password, 12),
  });
  return ok(res, await issue(u, res), "Account created.", null, 201);
};
export const login = async (req, res) => {
  const u = await User.unscoped().findOne({
    where: {
      email: String(req.body.email || "")
        .trim()
        .toLowerCase(),
    },
  });
  if (
    !u ||
    !(await bcrypt.compare(String(req.body.password || ""), u.passwordHash)) ||
    u.status !== "active"
  )
    return fail(res, 401, "Email or password is incorrect.");
  u.lastLoginAt = new Date();
  return ok(res, await issue(u, res), "Signed in.");
};
export const me = async (req, res) =>
  ok(
    res,
    {
      id: req.user.id,
      name: req.user.name,
      email: req.user.email,
      role: req.user.role,
    },
    "Profile loaded.",
  );
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
export const password = async (req, res) => {
  const u = await User.unscoped().findByPk(req.user.id);
  if (
    !(await bcrypt.compare(
      String(req.body.currentPassword || ""),
      u.passwordHash,
    ))
  )
    return fail(res, 400, "Current password is incorrect.");
  if (typeof req.body.password !== "string" || req.body.password.length < 12)
    return fail(res, 400, "Password must contain at least 12 characters.");
  u.passwordHash = await bcrypt.hash(req.body.password, 12);
  u.refreshTokenHash = null;
  await u.save();
  return ok(res, null, "Password changed; sign in again.");
};
