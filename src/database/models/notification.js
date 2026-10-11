import { DataTypes } from "sequelize";
import sequelize from "../../config/database.js";

const b = { timestamps: true, underscored: true };

const Notification = sequelize.define(
  "Notification",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    userId: DataTypes.UUID,
    title: { type: DataTypes.STRING, allowNull: false },
    detail: DataTypes.STRING,
    type: { type: DataTypes.STRING, defaultValue: "info" },
    read: { type: DataTypes.BOOLEAN, defaultValue: false },
    payload: DataTypes.JSON,
  },
  { ...b, tableName: "notifications" },
);

export default Notification;
