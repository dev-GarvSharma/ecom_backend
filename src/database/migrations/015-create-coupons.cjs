"use strict";
const { DataTypes } = require("sequelize");
const now = {
  created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
};

module.exports = {
  up: async (queryInterface) =>
    queryInterface.createTable("coupons", {
      id: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
      code: { type: DataTypes.STRING(40), allowNull: false, unique: true },
      type: { type: DataTypes.ENUM("percentage", "fixed"), allowNull: false },
      value: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
      min_order: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
      max_discount: DataTypes.DECIMAL(12, 2),
      usage_limit: DataTypes.INTEGER,
      used_count: { type: DataTypes.INTEGER, defaultValue: 0 },
      starts_at: DataTypes.DATE,
      expires_at: DataTypes.DATE,
      active: { type: DataTypes.BOOLEAN, defaultValue: true },
      ...now,
    }),
  down: async (queryInterface) => queryInterface.dropTable("coupons"),
};
