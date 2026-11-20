"use strict";

const { DataTypes } = require("sequelize");

module.exports = {
  up: async (queryInterface) => {
    await queryInterface.addColumn("orders", "confirmation_email_status", {
      type: DataTypes.ENUM("pending", "sending", "sent", "failed"),
      allowNull: false,
      defaultValue: "pending",
    });
  },
  down: async (queryInterface) => {
    await queryInterface.removeColumn("orders", "confirmation_email_status");
  },
};
