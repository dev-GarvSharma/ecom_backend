import { DataTypes } from "sequelize";
import sequelize from "../../config/database.js";
export default sequelize.define(
  "CartSession",
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    cartId: { type: DataTypes.UUID, allowNull: false, unique: true },
    status: { type: DataTypes.ENUM("active", "converted", "abandoned"), defaultValue: "active" },
    lastActivityAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    checkoutStartedAt: DataTypes.DATE,
    abandonedAt: DataTypes.DATE,
    recoverySentAt: DataTypes.DATE,
    abandonmentReason: DataTypes.STRING(80),
    abandonmentComment: DataTypes.STRING(500),
    convertedOrderId: DataTypes.UUID,
  },
  { tableName: "cart_sessions", underscored: true, timestamps: true },
);
