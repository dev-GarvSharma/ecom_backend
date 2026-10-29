"use strict";
const { DataTypes } = require("sequelize");
const now = {
  created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
};

module.exports = {
  up: async (queryInterface) => {
    await queryInterface.createTable("user_interaction_events", {
      id: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
      user_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: "users", key: "id" },
        onDelete: "SET NULL",
      },
      order_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: "orders", key: "id" },
        onDelete: "SET NULL",
      },
      cart_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: "carts", key: "id" },
        onDelete: "SET NULL",
      },
      event_type: { type: DataTypes.STRING(80), allowNull: false },
      details: { type: DataTypes.JSON, allowNull: false, defaultValue: {} },
      occurred_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      ...now,
    });
    await queryInterface.addIndex("user_interaction_events", ["user_id", "occurred_at"]);
  },
  down: async (queryInterface) => queryInterface.dropTable("user_interaction_events"),
};
