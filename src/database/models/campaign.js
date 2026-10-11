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
    channel: { type: DataTypes.STRING, defaultValue: "Email campaign" },
    audience: DataTypes.STRING,
    status: {
      type: DataTypes.ENUM("Draft", "Scheduled", "Active", "Sent", "Paused"),
      defaultValue: "Draft",
    },
    scheduledAt: DataTypes.DATE,
    content: DataTypes.TEXT,
  },
  { ...b, tableName: "campaigns" },
);

export default Campaign;
