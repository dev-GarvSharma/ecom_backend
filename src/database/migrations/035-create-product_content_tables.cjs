"use strict";
const { DataTypes } = require("sequelize");
const now = {
  created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
};
const productReference = () => ({
  type: DataTypes.UUID,
  allowNull: false,
  references: { model: "products", key: "id" },
  onDelete: "CASCADE",
});

module.exports = {
  up: async (queryInterface) => {
    await queryInterface.createTable("product_reel_links", {
      id: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
      product_id: productReference(),
      url: { type: DataTypes.STRING(1000), allowNull: false },
      position: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      ...now,
    });
    await queryInterface.createTable("product_feature_notes", {
      id: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
      product_id: productReference(),
      text: { type: DataTypes.TEXT, allowNull: false },
      image: { type: DataTypes.STRING(1000), allowNull: true },
      position: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      ...now,
    });
    await queryInterface.createTable("product_faqs", {
      id: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
      product_id: productReference(),
      question: { type: DataTypes.STRING(500), allowNull: false },
      answer: { type: DataTypes.TEXT, allowNull: false },
      position: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      ...now,
    });
  },
  down: async (queryInterface) => {
    await queryInterface.dropTable("product_faqs");
    await queryInterface.dropTable("product_feature_notes");
    await queryInterface.dropTable("product_reel_links");
  },
};
