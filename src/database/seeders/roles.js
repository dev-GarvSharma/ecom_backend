import { Permission, Role } from "../models/index.js";

export const seedRoles = async () => {
  const [roles, permissions] = await Promise.all([Role.findAll(), Permission.findAll()]);
  const required = [
    "customer",
    "admin",
    "catalog_manager",
    "inventory_manager",
    "order_manager",
    "support",
    "marketing_manager",
  ];
  const missing = required.filter((name) => !roles.some((role) => role.name === name));
  if (missing.length)
    throw new Error(`Run database migrations before seeding; missing roles: ${missing.join(", ")}`);
  return { roles: roles.length, permissions: permissions.length };
};
