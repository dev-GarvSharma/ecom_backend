import "dotenv/config";
import sequelize from "./config/database.js";
import { seedDatabase } from "./database/seeders/index.js";

try {
  await sequelize.authenticate();
  const counts = await seedDatabase();
  process.stdout.write(`Seed data ready: ${JSON.stringify(counts)}\n`);
} finally {
  await sequelize.close();
}
