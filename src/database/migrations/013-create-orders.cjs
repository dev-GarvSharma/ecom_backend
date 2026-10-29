"use strict";
const { DataTypes } = require("sequelize");
const now = {
  created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
};

module.exports = {
  up: async (queryInterface) =>
    queryInterface.createTable("orders", {
      id: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
      order_number: { type: DataTypes.STRING(80), unique: true },
      user_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: "users", key: "id" },
        onDelete: "RESTRICT",
      },
      status: {
        type: DataTypes.ENUM("Pending", "Processing", "Shipped", "Delivered", "Cancelled"),
        defaultValue: "Pending",
      },
      payment_status: {
        type: DataTypes.ENUM("Pending", "Paid", "Failed", "Refunded"),
        defaultValue: "Pending",
      },
      payment_method: DataTypes.STRING(30),
      payment_provider: DataTypes.STRING(40),
      payment_due_at: DataTypes.DATE,
      cancel_reason: DataTypes.STRING(500),
      cancelled_at: DataTypes.DATE,
      razorpay_order_id: { type: DataTypes.STRING(100), unique: true },
      payment_id: { type: DataTypes.STRING(100), unique: true },
      currency: { type: DataTypes.STRING(3), defaultValue: "INR" },
      subtotal: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
      discount: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
      shipping: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
      total: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
      shipping_address: { type: DataTypes.JSON, allowNull: false },
      coupon_code: DataTypes.STRING(40),
      ...now,
    }),
  down: async (queryInterface) => queryInterface.dropTable("orders"),
};
