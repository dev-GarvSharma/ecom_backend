"use strict";
const { DataTypes } = require("sequelize");
const now = {
  created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
};

module.exports = {
  up: async (queryInterface) =>
    queryInterface.createTable("campaigns", {
      id: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
      name: { type: DataTypes.STRING(180), allowNull: false },
      channel: { type: DataTypes.STRING(40), defaultValue: "email" },
      audience: DataTypes.STRING(120),
      status: {
        type: DataTypes.ENUM("Draft", "Scheduled", "Active", "Sent", "Paused"),
        defaultValue: "Draft",
      },
      scheduled_at: DataTypes.DATE,
      content: DataTypes.TEXT,
      ...now,
    }),
  down: async (queryInterface) => queryInterface.dropTable("campaigns"),
};
