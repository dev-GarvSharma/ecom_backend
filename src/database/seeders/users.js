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
  const users = [];
  for (let index = 1; index <= 15; index++) {
    const serial = String(index).padStart(2, "0");
    const user = await seedUserByEmail({
      name: `Test Customer ${serial}`,
      email: `customer${serial}@example.com`,
      role: "user",
      roleId: customerRole.id,
      isVerified: true,
      status: "active",
      phone: `+91990000${String(index).padStart(4, "0")}`,
      location: ["Mumbai", "Delhi", "Bengaluru", "Pune", "Jaipur"][(index - 1) % 5],
    });
    await user.addRole(customerRole);
    users.push(user);
  }
  return { admin, users };
};
