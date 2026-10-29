import { DataTypes } from "sequelize";
import sequelize from "../../config/database.js";
export default sequelize.define(
  "Permission",
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    code: { type: DataTypes.STRING(120), allowNull: false, unique: true },
    description: DataTypes.STRING(255),
  },
  { tableName: "permissions", underscored: true, timestamps: true },
);
