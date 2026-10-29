"use strict";
const { DataTypes } = require("sequelize");
const now = {
  created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
};

module.exports = {
  up: async (queryInterface) => {
    await queryInterface.createTable("role_permissions", {
      role_id: {
        type: DataTypes.UUID,
        allowNull: false,
        primaryKey: true,
        references: { model: "roles", key: "id" },
        onDelete: "CASCADE",
      },
      permission_id: {
        type: DataTypes.UUID,
        allowNull: false,
        primaryKey: true,
        references: { model: "permissions", key: "id" },
        onDelete: "CASCADE",
      },
      ...now,
    });
    const allPermissions = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];
    const grants = {
      1: [],
      2: allPermissions,
      3: [3, 4],
      4: [3, 5],
      5: [6, 7, 8],
      6: [6, 7, 8, 9],
      7: [8, 10, 11],
    };
    const rows = [];
    for (const [role, permissions] of Object.entries(grants))
      for (const permission of permissions)
        rows.push({
          role_id: `11111111-1111-4111-8111-${String(role).padStart(12, "0")}`,
          permission_id: `22222222-2222-4222-8222-${String(permission).padStart(12, "0")}`,
          created_at: new Date(),
          updated_at: new Date(),
        });
    if (rows.length) await queryInterface.bulkInsert("role_permissions", rows);
  },
  down: async (queryInterface) => queryInterface.dropTable("role_permissions"),
};
