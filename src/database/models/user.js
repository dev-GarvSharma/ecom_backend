import { DataTypes } from "sequelize";
import sequelize from "../../config/database.js";

const b = { timestamps: true, underscored: true };

const User = sequelize.define(
  "User",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: { type: DataTypes.STRING(120), allowNull: false },
    email: { type: DataTypes.STRING(254), allowNull: false, unique: true },
    passwordHash: { type: DataTypes.STRING, allowNull: false },
    role: { type: DataTypes.ENUM("user", "admin"), defaultValue: "user" },
    status: {
      type: DataTypes.ENUM("active", "suspended"),
      defaultValue: "active",
    },
    refreshTokenHash: DataTypes.STRING,
    phone: DataTypes.STRING,
    location: DataTypes.STRING,
    lastLoginAt: DataTypes.DATE,
  },
  {
    ...b,
    tableName: "users",
    defaultScope: {
      attributes: { exclude: ["passwordHash", "refreshTokenHash"] },
    },
    scopes: { secrets: {} },
  },
);

export default User;
