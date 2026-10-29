import { seedCatalog } from "./catalog.js";
import { seedCommerce } from "./commerce.js";
import { seedRoles } from "./roles.js";
import { seedUsers } from "./users.js";

export const seedDatabase = async () => {
  if (process.env.NODE_ENV === "production")
    throw new Error("Development seed data is disabled in production.");
  const roles = await seedRoles();
  const catalog = await seedCatalog();
  const accountData = await seedUsers();
  const commerce = await seedCommerce({ ...catalog, ...accountData });
  return {
    admin: accountData.admin.email,
    categories: catalog.categories.length,
    products: catalog.products.length,
    users: accountData.users.length,
    ...roles,
    ...commerce,
  };
};
