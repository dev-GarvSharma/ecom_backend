"use strict";
const { DataTypes } = require("sequelize");
const now = {
  created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
};

module.exports = {
  up: async (queryInterface) => {
    await queryInterface.createTable("cart_items", {
      id: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
      cart_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: "carts", key: "id" },
        onDelete: "CASCADE",
      },
      variant_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: "product_variants", key: "id" },
        onDelete: "CASCADE",
      },
      promotion_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: "promotions", key: "id" },
        onDelete: "SET NULL",
      },
      is_promotional: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      quantity: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
      ...now,
    });
    await queryInterface.addIndex("cart_items", ["cart_id", "variant_id"], { unique: true });
  },
  down: async (queryInterface) => queryInterface.dropTable("cart_items"),
};
