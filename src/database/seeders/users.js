import { Role } from "../models/index.js";
import { seedUserByEmail } from "./helpers.js";

export const seedUsers = async () => {
  const adminRole = await Role.findOne({ where: { name: "admin" } });
  const customerRole = await Role.findOne({ where: { name: "customer" } });
  if (!adminRole || !customerRole)
    throw new Error("Built-in admin and customer roles must exist before seeding users.");
  const admin = await seedUserByEmail({
    name: "Test Admin",
    email: "admin@gmail.com",
    role: "admin",
    roleId: adminRole.id,
    isVerified: true,
    status: "active",
    phone: "+919012803123",
    location: "Mumbai",
  });
  await admin.addRole(adminRole);
  return { admin };
};
