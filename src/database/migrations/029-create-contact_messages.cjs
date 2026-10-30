"use strict";
const { DataTypes } = require("sequelize");
const now = {
  created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
};

module.exports = {
  up: async (queryInterface) => {
    await queryInterface.createTable("contact_messages", {
      id: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
      name: { type: DataTypes.STRING(120), allowNull: false },
      email: { type: DataTypes.STRING(254), allowNull: false },
      phone: { type: DataTypes.STRING(30), allowNull: false },
      subject: { type: DataTypes.STRING(180), allowNull: false },
      message: { type: DataTypes.TEXT, allowNull: false },
      status: {
        type: DataTypes.ENUM("new", "in_progress", "resolved"),
        allowNull: false,
        defaultValue: "new",
      },
      admin_note: DataTypes.TEXT,
      ...now,
    });
    await queryInterface.addIndex("contact_messages", ["status", "created_at"]);
  },
  down: async (queryInterface) => queryInterface.dropTable("contact_messages"),
};
