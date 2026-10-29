"use strict";
const { DataTypes } = require("sequelize");
const now = {
  created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
};

module.exports = {
  up: async (queryInterface) =>
    queryInterface.createTable("notifications", {
      id: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
      user_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: "users", key: "id" },
        onDelete: "CASCADE",
      },
      title: { type: DataTypes.STRING(180), allowNull: false },
      detail: DataTypes.STRING(500),
      type: { type: DataTypes.STRING(40), defaultValue: "info" },
      read: { type: DataTypes.BOOLEAN, defaultValue: false },
      payload: DataTypes.JSON,
      ...now,
    }),
  down: async (queryInterface) => queryInterface.dropTable("notifications"),
};
