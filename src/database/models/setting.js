import { DataTypes } from "sequelize";
import sequelize from "../../config/database.js";

const b = { timestamps: true, underscored: true };

const Setting = sequelize.define(
  "Setting",
  {
    key: { type: DataTypes.STRING, primaryKey: true },
    value: { type: DataTypes.JSON, allowNull: false },
  },
  { ...b, tableName: "settings" },
);

export default Setting;
