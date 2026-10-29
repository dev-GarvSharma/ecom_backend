"use strict";
const { DataTypes } = require("sequelize");
const now = {
  created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
};

module.exports = {
  up: async (queryInterface) => {
    await queryInterface.createTable("roles", {
      id: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
      name: { type: DataTypes.STRING(80), allowNull: false, unique: true },
      description: DataTypes.STRING(255),
      is_system: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      ...now,
    });
    const roles = [
      "customer",
      "admin",
      "catalog_manager",
      "inventory_manager",
      "order_manager",
      "support",
      "marketing_manager",
    ];
    await queryInterface.bulkInsert(
      "roles",
      roles.map((name, index) => ({
        id: `11111111-1111-4111-8111-${String(index + 1).padStart(12, "0")}`,
        name,
        description: `${name} access role`,
        is_system: true,
        created_at: new Date(),
        updated_at: new Date(),
      })),
    );
  },
  down: async (queryInterface) => queryInterface.dropTable("roles"),
};
