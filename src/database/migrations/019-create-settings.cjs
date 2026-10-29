"use strict";
const { DataTypes } = require("sequelize");
const now = {
  created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
};

module.exports = {
  up: async (queryInterface) =>
    queryInterface.createTable("settings", {
      key: { type: DataTypes.STRING(120), allowNull: false, primaryKey: true },
      value: { type: DataTypes.JSON, allowNull: false },
      ...now,
    }),
  down: async (queryInterface) => queryInterface.dropTable("settings"),
};
