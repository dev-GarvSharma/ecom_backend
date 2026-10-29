"use strict";
const { DataTypes } = require("sequelize");
const now = {
  created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
};

module.exports = {
  up: async (queryInterface) =>
    queryInterface.createTable("user_roles", {
      user_id: {
        type: DataTypes.UUID,
        allowNull: false,
        primaryKey: true,
        references: { model: "users", key: "id" },
        onDelete: "CASCADE",
      },
      role_id: {
        type: DataTypes.UUID,
        allowNull: false,
        primaryKey: true,
        references: { model: "roles", key: "id" },
        onDelete: "CASCADE",
      },
      ...now,
    }),
  down: async (queryInterface) => queryInterface.dropTable("user_roles"),
};
