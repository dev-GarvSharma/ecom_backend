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
      rating_average: { type: DataTypes.DECIMAL(3, 2), allowNull: true },
      review_count: { type: DataTypes.INTEGER, allowNull: true },
      sprays: { type: DataTypes.INTEGER, allowNull: true },
      label_text: { type: DataTypes.STRING(255), allowNull: true },
      meta_title: { type: DataTypes.STRING(255), allowNull: true },
      meta_description: { type: DataTypes.TEXT, allowNull: true },
      meta_keywords: { type: DataTypes.TEXT, allowNull: true },
      url: { type: DataTypes.STRING(500), allowNull: true },
      canonical_url: { type: DataTypes.STRING(500), allowNull: true },
      robots_tags: { type: DataTypes.STRING(255), allowNull: true },
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
