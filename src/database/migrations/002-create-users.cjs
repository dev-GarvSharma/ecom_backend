"use strict";
const { DataTypes } = require("sequelize");
const now = {
  created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
};

module.exports = {
  up: async (queryInterface) =>
    queryInterface.createTable("users", {
      id: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
      name: { type: DataTypes.STRING(120), allowNull: false },
      email: { type: DataTypes.STRING(254), allowNull: true, unique: true },
      phone: { type: DataTypes.STRING(32), allowNull: false, unique: true },
      is_verified: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      role_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: "roles", key: "id" },
        onDelete: "RESTRICT",
      },
      role: { type: DataTypes.ENUM("user", "admin"), allowNull: false, defaultValue: "user" },
      status: {
        type: DataTypes.ENUM("active", "suspended"),
        allowNull: false,
        defaultValue: "active",
      },
      refresh_token_hash: DataTypes.STRING,
      location: DataTypes.STRING,
      last_login_at: DataTypes.DATE,
      ...now,
    }),
  down: async (queryInterface) => queryInterface.dropTable("users"),
};
