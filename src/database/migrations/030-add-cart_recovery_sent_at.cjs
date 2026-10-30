"use strict";
const { DataTypes } = require("sequelize");

module.exports = {
  up: async (queryInterface) => {
    await queryInterface.addColumn("cart_sessions", "recovery_sent_at", {
      type: DataTypes.DATE,
      allowNull: true,
    });
  },
  down: async (queryInterface) => {
    await queryInterface.removeColumn("cart_sessions", "recovery_sent_at");
  },
};
