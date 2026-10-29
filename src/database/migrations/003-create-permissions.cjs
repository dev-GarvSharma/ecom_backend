"use strict";
const { DataTypes } = require("sequelize");
const now = {
  created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
};

module.exports = {
  up: async (queryInterface) => {
    await queryInterface.createTable("permissions", {
      id: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
      code: { type: DataTypes.STRING(120), allowNull: false, unique: true },
      description: DataTypes.STRING(255),
      ...now,
    });
    const codes = [
      "admin.users.manage",
      "admin.roles.manage",
      "catalog.read",
      "catalog.write",
      "inventory.write",
      "orders.read",
      "orders.write",
      "customers.read",
      "customers.write",
      "promotions.manage",
      "marketing.manage",
      "analytics.read",
      "settings.manage",
      "audit.read",
    ];
    await queryInterface.bulkInsert(
      "permissions",
      codes.map((code, index) => ({
        id: `22222222-2222-4222-8222-${String(index + 1).padStart(12, "0")}`,
        code,
        description: code.replaceAll(".", " "),
        created_at: new Date(),
        updated_at: new Date(),
      })),
    );
  },
  down: async (queryInterface) => queryInterface.dropTable("permissions"),
};
