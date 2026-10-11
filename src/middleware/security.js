import jwt from "jsonwebtoken";
import { User } from "../database/models/index.js";
import { fail } from "../utils/http.js";
export const authenticate = async (req, res, next) => {
  try {
    const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
    if (!token) return fail(res, 401, "Authentication required.");
    const c = jwt.verify(token, process.env.JWT_ACCESS_SECRET, {
      algorithms: ["HS256"],
      issuer: "ecom-api",
      audience: "ecom-client",
    });
    const u = await User.findByPk(c.sub);
    if (!u || u.status !== "active" || u.role !== c.role)
      return fail(res, 401, "Session is invalid.");
    req.user = u;
    next();
  } catch {
    return fail(res, 401, "Invalid or expired access token.");
  }
};
export const requireAdmin = (req, res, next) =>
  req.user?.role === "admin"
    ? next()
    : fail(res, 403, "Administrator access required.");
