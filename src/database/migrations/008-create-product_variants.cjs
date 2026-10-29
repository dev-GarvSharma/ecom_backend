"use strict";
const { DataTypes } = require("sequelize");
const now = {
  created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
};

module.exports = {
  up: async (queryInterface) => {
    await queryInterface.createTable("product_variants", {
      id: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
      product_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: "products", key: "id" },
        onDelete: "CASCADE",
      },
      sku: { type: DataTypes.STRING(80), allowNull: false, unique: true },
      options: { type: DataTypes.JSON, allowNull: false, defaultValue: {} },
      price: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
      compare_at_price: DataTypes.DECIMAL(12, 2),
      stock: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
      active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      ...now,
    });
    await queryInterface.addIndex("product_variants", ["product_id"]);
  },
  down: async (queryInterface) => queryInterface.dropTable("product_variants"),
};
