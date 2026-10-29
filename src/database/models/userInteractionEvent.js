import { DataTypes } from "sequelize";
import sequelize from "../../config/database.js";
export default sequelize.define(
  "UserInteractionEvent",
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    userId: DataTypes.UUID,
    orderId: DataTypes.UUID,
    cartId: DataTypes.UUID,
    eventType: { type: DataTypes.STRING(80), allowNull: false },
    details: { type: DataTypes.JSON, defaultValue: {} },
    occurredAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  },
  { tableName: "user_interaction_events", underscored: true, timestamps: true },
);
