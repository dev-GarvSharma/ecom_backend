import { DataTypes } from "sequelize";
import sequelize from "../../config/database.js";

const b = { timestamps: true, underscored: true };

const Campaign = sequelize.define(
  "Campaign",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: { type: DataTypes.STRING, allowNull: false },
    subject: { type: DataTypes.STRING(200), allowNull: true },
    channel: { type: DataTypes.STRING, defaultValue: "email" },
    audience: DataTypes.STRING,
    status: {
      type: DataTypes.ENUM("Draft", "Scheduled", "Active", "Sending", "Sent", "Paused", "Failed"),
      defaultValue: "Draft",
    },
    scheduledAt: DataTypes.DATE,
    content: DataTypes.TEXT("long"),
  },
  { ...b, tableName: "campaigns" },
);

export default Campaign;
