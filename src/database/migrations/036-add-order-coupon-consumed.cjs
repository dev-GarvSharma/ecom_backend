"use strict";

const { DataTypes } = require("sequelize");

module.exports = {
  up: async (queryInterface) => {
    await queryInterface.addColumn("orders", "coupon_consumed", {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
    await queryInterface.sequelize.query(
      "UPDATE orders SET coupon_consumed = 1 WHERE coupon_code IS NOT NULL AND (payment_status = 'Paid' OR (payment_method = 'COD' AND status <> 'Cancelled'))",
    );
    await queryInterface.sequelize.query(
      "UPDATE coupons c LEFT JOIN (SELECT coupon_code, COUNT(*) AS consumed_count FROM orders WHERE coupon_consumed = 1 GROUP BY coupon_code) o ON o.coupon_code = c.code SET c.used_count = COALESCE(o.consumed_count, 0)",
    );
  },
  down: async (queryInterface) => {
    await queryInterface.removeColumn("orders", "coupon_consumed");
  },
};
