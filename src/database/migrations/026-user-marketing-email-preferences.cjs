"use strict";
const { DataTypes } = require("sequelize");

module.exports = {
  up: async (queryInterface) => {
    await queryInterface.addColumn("users", "marketing_email_subscribed", {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
    await queryInterface.addColumn("users", "marketing_email_subscribed_at", {
      type: DataTypes.DATE,
      allowNull: true,
    });
    await queryInterface.addColumn("users", "marketing_email_unsubscribed_at", { type: DataTypes.DATE, allowNull: true });
  },
  down: async (queryInterface) => {
    await queryInterface.removeColumn("users", "marketing_email_unsubscribed_at");
    await queryInterface.removeColumn("users", "marketing_email_subscribed_at");
    await queryInterface.removeColumn("users", "marketing_email_subscribed");
  },
};
