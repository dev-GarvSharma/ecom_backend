"use strict";
const { DataTypes } = require("sequelize");
const now = {
  created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
};

module.exports = {
  up: async (queryInterface) =>
    queryInterface.createTable("products", {
      id: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
      category_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: "categories", key: "id" },
        onDelete: "RESTRICT",
      },
      name: { type: DataTypes.STRING(180), allowNull: false },
      slug: { type: DataTypes.STRING(200), unique: true },
      description: DataTypes.TEXT,
      brand: DataTypes.STRING(120),
      concentration: DataTypes.STRING(80),
      fragrance_family: DataTypes.STRING(120),
      top_notes: { type: DataTypes.JSON, allowNull: false, defaultValue: [] },
      heart_notes: { type: DataTypes.JSON, allowNull: false, defaultValue: [] },
      base_notes: { type: DataTypes.JSON, allowNull: false, defaultValue: [] },
      attributes: { type: DataTypes.JSON, allowNull: false, defaultValue: {} },
      show_on_shop: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      status: {
        type: DataTypes.ENUM("active", "draft", "archived"),
        allowNull: false,
        defaultValue: "active",
      },
      ...now,
    }),
  down: async (queryInterface) => queryInterface.dropTable("products"),
};
