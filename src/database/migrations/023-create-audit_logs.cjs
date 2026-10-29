"use strict";
const { DataTypes } = require("sequelize");
const now = {
  created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
};

module.exports = {
  up: async (queryInterface) => {
    await queryInterface.createTable("audit_logs", {
      id: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
      actor_user_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: "users", key: "id" },
        onDelete: "SET NULL",
      },
      action: { type: DataTypes.STRING(120), allowNull: false },
      resource_type: { type: DataTypes.STRING(80), allowNull: false },
      resource_id: DataTypes.STRING(80),
      changes: { type: DataTypes.JSON, allowNull: false, defaultValue: {} },
      ip_address: DataTypes.STRING(45),
      ...now,
    });
    await queryInterface.addIndex("audit_logs", ["resource_type", "resource_id", "created_at"]);
  },
  down: async (queryInterface) => queryInterface.dropTable("audit_logs"),
};
