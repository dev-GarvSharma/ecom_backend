"use strict";
const { DataTypes } = require("sequelize");
const now = {
  created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
};

module.exports = {
  up: async (queryInterface) => {
    await queryInterface.createTable("blog_comments", {
      id: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
      blog_post_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: "blog_posts", key: "id" },
        onDelete: "CASCADE",
      },
      name: { type: DataTypes.STRING(120), allowNull: false },
      email: { type: DataTypes.STRING(254), allowNull: false },
      comment: { type: DataTypes.TEXT, allowNull: false },
      status: {
        type: DataTypes.ENUM("pending", "approved", "rejected"),
        allowNull: false,
        defaultValue: "pending",
      },
      ...now,
    });
    await queryInterface.addIndex("blog_comments", ["blog_post_id", "status", "created_at"]);
  },
  down: async (queryInterface) => queryInterface.dropTable("blog_comments"),
};
