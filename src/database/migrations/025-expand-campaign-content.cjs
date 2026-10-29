"use strict";

const { DataTypes } = require("sequelize");

module.exports = {
  up: async (queryInterface) => {
    await queryInterface.changeColumn("campaigns", "content", {
      type: DataTypes.TEXT("long"),
      allowNull: true,
    });
  },
  down: async (queryInterface) => {
    await queryInterface.changeColumn("campaigns", "content", {
      type: DataTypes.TEXT,
      allowNull: true,
    });
  },
};
