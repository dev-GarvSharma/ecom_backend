"use strict";
const { DataTypes } = require("sequelize");
const now = {
  created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
};

module.exports = {
  up: async (queryInterface) => {
    await queryInterface.createTable("campaign_deliveries", {
      id: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
      campaign_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: "campaigns", key: "id" },
        onDelete: "CASCADE",
      },
      user_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: "users", key: "id" },
        onDelete: "CASCADE",
      },
      email: { type: DataTypes.STRING(254), allowNull: false },
      status: { type: DataTypes.ENUM("queued", "accepted", "failed", "skipped"), allowNull: false },
      provider_message_id: DataTypes.STRING(255),
      error: DataTypes.STRING(1000),
      accepted_at: DataTypes.DATE,
      ...now,
    });
    await queryInterface.addIndex("campaign_deliveries", ["campaign_id", "user_id"], {
      unique: true,
      name: "campaign_deliveries_campaign_user_unique",
    });
  },
  down: async (queryInterface) => queryInterface.dropTable("campaign_deliveries"),
};
