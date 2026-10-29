"use strict";
const { DataTypes } = require("sequelize");
const now = {
  created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
};

module.exports = {
  up: async (queryInterface) => {
    await queryInterface.createTable("cart_sessions", {
      id: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
      cart_id: {
        type: DataTypes.UUID,
        allowNull: false,
        unique: true,
        references: { model: "carts", key: "id" },
        onDelete: "CASCADE",
      },
      status: {
        type: DataTypes.ENUM("active", "converted", "abandoned"),
        allowNull: false,
        defaultValue: "active",
      },
      last_activity_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      checkout_started_at: DataTypes.DATE,
      abandoned_at: DataTypes.DATE,
      abandonment_reason: DataTypes.STRING(80),
      abandonment_comment: DataTypes.STRING(500),
      converted_order_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: "orders", key: "id" },
        onDelete: "SET NULL",
      },
      ...now,
    });
    await queryInterface.addIndex("cart_sessions", ["status", "last_activity_at"]);
  },
  down: async (queryInterface) => queryInterface.dropTable("cart_sessions"),
};
