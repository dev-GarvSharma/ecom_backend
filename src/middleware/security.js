import jwt from "jsonwebtoken";
import { User, Role, Permission } from "../database/models/index.js";
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
  req.user?.role === "admin" ? next() : fail(res, 403, "Administrator access required.");

export const requirePermission = (code) => async (req, res, next) => {
  try {
    const user = await User.findByPk(req.user.id, {
      include: [
        {
          model: Role,
          as: "roles",
          include: [{ model: Permission, as: "permissions", through: { attributes: [] } }],
          through: { attributes: [] },
        },
        {
          model: Permission,
          as: "directPermissions",
          through: { attributes: [] },
        },
      ],
    });
    const allowed =
      user?.directPermissions?.some((permission) => permission.code === code) ||
      user?.roles?.some((role) => role.permissions?.some((permission) => permission.code === code));
    return allowed ? next() : fail(res, 403, `Permission required: ${code}.`);
  } catch (error) {
    return next(error);
  }
};

export const authorizeAdminRoute = async (req, res, next) => {
  const path = req.path;
  let permission = "analytics.read";
  if (/\/roles/.test(path)) permission = "admin.roles.manage";
  else if (/\/users/.test(path)) permission = "admin.users.manage";
  else if (/\/permissions/.test(path)) permission = "admin.roles.manage";
  else if (/\/settings/.test(path)) permission = "settings.manage";
  else if (/\/audit/.test(path)) permission = "audit.read";
  else if (/\/abandoned-carts/.test(path))
    permission = req.method === "GET" ? "customers.read" : "customers.write";
  else if (/\/contact-messages/.test(path))
    permission = req.method === "GET" ? "customers.read" : "customers.write";
  else if (/\/blogs|\/blog-comments/.test(path)) permission = "marketing.manage";
  else if (/\/customers\/[^/]+\/orders/.test(path)) permission = "customers.read";
  else if (/\/notifications/.test(path)) permission = "admin.users.manage";
  else if (/\/marketing/.test(path)) permission = "marketing.manage";
  else if (/\/inventory/.test(path)) permission = "inventory.write";
  else if (/\/orders/.test(path))
    permission = req.method === "GET" || path.endsWith("/export") ? "orders.read" : "orders.write";
  else if (/\/customers/.test(path))
    permission =
      req.method === "GET" || path.endsWith("/export")
        ? "customers.read"
        : req.method === "POST"
          ? "admin.users.manage"
          : "customers.write";
  else if (/\/(coupons|promotions)/.test(path)) permission = "promotions.manage";
  else if (/\/products/.test(path))
    permission =
      req.method === "GET" || path.endsWith("/export") ? "catalog.read" : "catalog.write";
  else if (/\/categories/.test(path))
    permission =
      req.method === "GET" || path.endsWith("/export") ? "catalog.read" : "catalog.write";
  const check = requirePermission(permission);
  return check(req, res, next);
};
