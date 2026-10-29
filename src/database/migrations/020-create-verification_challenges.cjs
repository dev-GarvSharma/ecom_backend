"use strict";
const { DataTypes } = require("sequelize");
const now = {
  created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
};

module.exports = {
  up: async (queryInterface) => {
    await queryInterface.createTable("verification_challenges", {
      id: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
      user_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: "users", key: "id" },
        onDelete: "CASCADE",
      },
      purpose: {
        type: DataTypes.ENUM("register", "login", "verify_contact"),
        allowNull: false,
      },
      channel: { type: DataTypes.ENUM("sms"), allowNull: false },
      destination: { type: DataTypes.STRING(254), allowNull: false },
      code_hash: { type: DataTypes.STRING(64), allowNull: false },
      attempts: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
      expires_at: { type: DataTypes.DATE, allowNull: false },
      consumed_at: DataTypes.DATE,
      ...now,
    });
    await queryInterface.addIndex("verification_challenges", [
      "destination",
      "purpose",
      "created_at",
    ]);
  },
  down: async (queryInterface) => queryInterface.dropTable("verification_challenges"),
};
