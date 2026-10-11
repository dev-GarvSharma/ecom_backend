import { DataTypes } from "sequelize";
import sequelize from "../../config/database.js";

const b = { timestamps: true, underscored: true };

const Order = sequelize.define(
  "Order",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    orderNumber: { type: DataTypes.STRING, unique: true },
    userId: { type: DataTypes.UUID, allowNull: false },
    status: {
      type: DataTypes.ENUM("Pending", "Processing", "Shipped", "Delivered", "Cancelled"),
      defaultValue: "Pending",
    },
    paymentStatus: {
      type: DataTypes.ENUM("Pending", "Paid", "Failed", "Refunded"),
      defaultValue: "Pending",
    },
    paymentMethod: DataTypes.STRING,
    razorpayOrderId: { type: DataTypes.STRING, unique: true },
    paymentId: { type: DataTypes.STRING, unique: true },
    currency: { type: DataTypes.STRING(3), defaultValue: "INR" },
    subtotal: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
    discount: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
    shipping: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
    total: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
    shippingAddress: { type: DataTypes.JSON, allowNull: false },
    couponCode: DataTypes.STRING,
  },
  { ...b, tableName: "orders" },
);

export default Order;
