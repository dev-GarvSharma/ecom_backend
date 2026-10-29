"use strict";
const { DataTypes } = require("sequelize");

const statuses = ["Draft", "Scheduled", "Active", "Sending", "Sent", "Paused", "Failed"];

module.exports = {
  up: async (queryInterface) => {
    await queryInterface.addColumn("campaigns", "subject", {
      type: DataTypes.STRING(200),
      allowNull: true,
    });
    await queryInterface.sequelize.query(
      "UPDATE campaigns SET subject = name WHERE subject IS NULL",
    );
    await queryInterface.changeColumn("campaigns", "status", {
      type: DataTypes.ENUM(...statuses),
      allowNull: false,
      defaultValue: "Draft",
    });
  },
  down: async (queryInterface) => {
    await queryInterface.changeColumn("campaigns", "status", {
      type: DataTypes.ENUM("Draft", "Scheduled", "Active", "Sent", "Paused"),
      allowNull: false,
      defaultValue: "Draft",
    });
    await queryInterface.removeColumn("campaigns", "subject");
  },
};
