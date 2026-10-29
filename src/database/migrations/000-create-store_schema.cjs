"use strict";
const { DataTypes } = require("sequelize");
const now = {
  created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
};

module.exports = {
  up: async (queryInterface) =>
    queryInterface.createTable("store_schema", {
      store_name: { type: DataTypes.STRING(120), allowNull: false, defaultValue: "Perfume Store" },
      ...now,
    }),
  down: async (queryInterface) => queryInterface.dropTable("store_schema"),
};
