"use strict";
const { DataTypes } = require("sequelize");
const now = {
  created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
};

module.exports = {
  up: async (queryInterface) => {
    await queryInterface.createTable("blog_posts", {
      id: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
      title: { type: DataTypes.STRING(200), allowNull: false },
      slug: { type: DataTypes.STRING(220), allowNull: false, unique: true },
      description: { type: DataTypes.STRING(500), allowNull: false },
      content: { type: DataTypes.TEXT("long"), allowNull: false },
      meta_title: DataTypes.STRING(200),
      meta_description: DataTypes.STRING(320),
      meta_tags: { type: DataTypes.JSON, allowNull: false, defaultValue: [] },
      banner_image: DataTypes.STRING(1024),
      status: {
        type: DataTypes.ENUM("draft", "published"),
        allowNull: false,
        defaultValue: "draft",
      },
      published_at: DataTypes.DATE,
      ...now,
    });
    await queryInterface.addIndex("blog_posts", ["status", "published_at"]);
  },
  down: async (queryInterface) => queryInterface.dropTable("blog_posts"),
};
