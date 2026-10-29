"use strict";
const { DataTypes } = require("sequelize");
const now = {
  created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
};

module.exports = {
  up: async (queryInterface) =>
    queryInterface.createTable("user_addresses", {
      id: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
      user_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: "users", key: "id" },
        onDelete: "CASCADE",
      },
      recipient: DataTypes.STRING(120),
      phone: DataTypes.STRING(32),
      line1: DataTypes.STRING(255),
      line2: DataTypes.STRING(255),
      city: DataTypes.STRING(120),
      state: DataTypes.STRING(120),
      postal_code: DataTypes.STRING(20),
      country: { type: DataTypes.STRING(2), defaultValue: "IN" },
      is_default: { type: DataTypes.BOOLEAN, defaultValue: false },
      ...now,
    }),
  down: async (queryInterface) => queryInterface.dropTable("user_addresses"),
};
