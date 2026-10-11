import { DataTypes } from "sequelize";
import sequelize from "../../config/database.js";

const b = { timestamps: true, underscored: true };

const Coupon = sequelize.define(
  "Coupon",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    code: { type: DataTypes.STRING(40), unique: true },
    type: { type: DataTypes.ENUM("percentage", "fixed"), allowNull: false },
    value: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
    minOrder: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
    maxDiscount: DataTypes.DECIMAL(12, 2),
    usageLimit: DataTypes.INTEGER,
    usedCount: { type: DataTypes.INTEGER, defaultValue: 0 },
    startsAt: DataTypes.DATE,
    expiresAt: DataTypes.DATE,
    active: { type: DataTypes.BOOLEAN, defaultValue: true },
  },
  { ...b, tableName: "coupons" },
);

export default Coupon;
