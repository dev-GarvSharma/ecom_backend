"use strict";
const { DataTypes } = require("sequelize");
const now = {
  created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
};

module.exports = {
  up: async (queryInterface) =>
    queryInterface.createTable("product_reviews", {
      id: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
      product_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: "products", key: "id" },
        onDelete: "CASCADE",
      },
      user_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: "users", key: "id" },
        onDelete: "SET NULL",
      },
      customer_name: { type: DataTypes.STRING(120), allowNull: false },
      rating: { type: DataTypes.INTEGER, allowNull: false },
      title: { type: DataTypes.STRING(180), allowNull: true },
      body: { type: DataTypes.TEXT, allowNull: false },
      status: {
        type: DataTypes.ENUM("pending", "approved", "disapproved"),
        allowNull: false,
        defaultValue: "pending",
      },
      ...now,
    }),
  down: async (queryInterface) => queryInterface.dropTable("product_reviews"),
};
