import { DataTypes } from "sequelize";
import sequelize from "../../config/database.js";
export default sequelize.define(
  "Role",
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    name: { type: DataTypes.STRING(80), allowNull: false, unique: true },
    description: DataTypes.STRING(255),
    isSystem: { type: DataTypes.BOOLEAN, defaultValue: false },
  },
  { tableName: "roles", underscored: true, timestamps: true },
);
