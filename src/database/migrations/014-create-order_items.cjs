"use strict";
const { DataTypes } = require("sequelize");
const now = {
  created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
};

module.exports = {
  up: async (queryInterface) =>
    queryInterface.createTable("order_items", {
      id: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
      order_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: "orders", key: "id" },
        onDelete: "CASCADE",
      },
      product_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: "products", key: "id" },
        onDelete: "SET NULL",
      },
      variant_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: "product_variants", key: "id" },
        onDelete: "SET NULL",
      },
      name: { type: DataTypes.STRING(180), allowNull: false },
      sku: DataTypes.STRING(80),
      variant_options: DataTypes.JSON,
      product_snapshot: DataTypes.JSON,
      variant_snapshot: DataTypes.JSON,
      quantity: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
      unit_price: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
      ...now,
    }),
  down: async (queryInterface) => queryInterface.dropTable("order_items"),
};
