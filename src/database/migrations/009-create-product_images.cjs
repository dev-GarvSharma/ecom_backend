"use strict";
const { DataTypes } = require("sequelize");
const now = {
  created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
};

module.exports = {
  up: async (queryInterface) =>
    queryInterface.createTable("product_images", {
      id: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
      product_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: "products", key: "id" },
        onDelete: "CASCADE",
      },
      path: { type: DataTypes.STRING(1024), allowNull: false },
      ...now,
    }),
  down: async (queryInterface) => queryInterface.dropTable("product_images"),
};
