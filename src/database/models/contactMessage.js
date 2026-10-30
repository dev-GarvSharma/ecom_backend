import { DataTypes } from "sequelize";
import sequelize from "../../config/database.js";

export default sequelize.define(
  "ContactMessage",
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    name: { type: DataTypes.STRING(120), allowNull: false },
    email: { type: DataTypes.STRING(254), allowNull: false },
    phone: { type: DataTypes.STRING(30), allowNull: false },
    subject: { type: DataTypes.STRING(180), allowNull: false },
    message: { type: DataTypes.TEXT, allowNull: false },
    status: {
      type: DataTypes.ENUM("new", "in_progress", "resolved"),
      allowNull: false,
      defaultValue: "new",
    },
    adminNote: DataTypes.TEXT,
  },
  { tableName: "contact_messages", underscored: true, timestamps: true },
);
