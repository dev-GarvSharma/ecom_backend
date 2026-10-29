import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DataTypes } from "sequelize";
import sequelize from "./config/database.js";

const migrationsDirectory = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "database/migrations",
);

const migrate = async () => {
  const queryInterface = sequelize.getQueryInterface();
  await queryInterface
    .createTable("schema_migrations", {
      name: { type: DataTypes.STRING(255), primaryKey: true },
      executed_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
    })
    .catch((error) => {
      if (!/already exists/i.test(error.message)) throw error;
    });

  const [rows] = await sequelize.query("SELECT name FROM schema_migrations");
  const executed = new Set(rows.map((row) => row.name));
  const existingTables = new Set(
    (await queryInterface.showAllTables()).map((table) =>
      typeof table === "string" ? table : table.tableName,
    ),
  );
  const baselineMigration = "000-create-store_schema.js";
  const applicationTables = [...existingTables].filter(
    (table) => !["schema_migrations", "store_schema"].includes(table),
  );
  if (rows.length && !executed.has(baselineMigration))
    throw new Error(
      "This database uses the legacy migration history. Create an empty database for the perfume-store baseline; old migration history is not compatible.",
    );
  if (!executed.has(baselineMigration) && applicationTables.length)
    throw new Error(
      "The target database is not empty. The perfume-store baseline only runs on a new empty database.",
    );
  const files = (await fs.readdir(migrationsDirectory))
    .filter((file) => /^\d{3}-.*\.cjs$/.test(file))
    .sort();

  for (const file of files) {
    const migrationName = file.replace(/\.cjs$/, ".js");
    if (executed.has(migrationName)) continue;

    const createTableMatch = file.match(/^\d+-create-(.+)\.cjs$/);
    if (createTableMatch && existingTables.has(createTableMatch[1])) {
      if (migrationName !== baselineMigration)
        throw new Error(
          `Table ${createTableMatch[1]} exists without recorded migration ${migrationName}; inspect the incomplete migration before continuing.`,
        );
      await sequelize.query("INSERT INTO schema_migrations (name, executed_at) VALUES (?, NOW())", {
        replacements: [migrationName],
      });
      executed.add(migrationName);
      process.stdout.write(`Recovered baseline marker for ${migrationName}\n`);
      continue;
    }

    const migration = await import(path.join(migrationsDirectory, file));
    await migration.default.up(queryInterface, sequelize.constructor);
    await sequelize.query("INSERT INTO schema_migrations (name, executed_at) VALUES (?, NOW())", {
      replacements: [migrationName],
    });
    process.stdout.write(`Applied ${migrationName}\n`);
  }
};

try {
  await sequelize.authenticate();
  await migrate();
  process.stdout.write("Database migrations completed.\n");
} finally {
  await sequelize.close();
}
