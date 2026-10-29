"use strict";
const { DataTypes } = require("sequelize");
const now = {
  created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
};

module.exports = {
  up: async (queryInterface) =>
    queryInterface.createTable("promotions", {
      id: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
      code: { type: DataTypes.STRING(50), allowNull: false, unique: true },
      name: { type: DataTypes.STRING(160), allowNull: false },
      type: { type: DataTypes.ENUM("free_product", "percentage", "fixed"), allowNull: false },
      value: DataTypes.DECIMAL(12, 2),
      promotional_variant_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: "product_variants", key: "id" },
        onDelete: "SET NULL",
      },
      minimum_subtotal: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
      starts_at: DataTypes.DATE,
      ends_at: DataTypes.DATE,
      usage_limit: DataTypes.INTEGER,
      used_count: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
      active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      ...now,
    }),
  down: async (queryInterface) => queryInterface.dropTable("promotions"),
};
