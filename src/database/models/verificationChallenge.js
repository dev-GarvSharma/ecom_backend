import { DataTypes } from "sequelize";
import sequelize from "../../config/database.js";
export default sequelize.define(
  "VerificationChallenge",
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    userId: DataTypes.UUID,
    purpose: {
      type: DataTypes.ENUM("register", "login", "verify_contact"),
      allowNull: false,
    },
    channel: { type: DataTypes.ENUM("sms"), allowNull: false },
    destination: { type: DataTypes.STRING(254), allowNull: false },
    codeHash: { type: DataTypes.STRING(64), allowNull: false },
    attempts: { type: DataTypes.INTEGER.UNSIGNED, defaultValue: 0 },
    expiresAt: { type: DataTypes.DATE, allowNull: false },
    consumedAt: DataTypes.DATE,
  },
  { tableName: "verification_challenges", underscored: true, timestamps: true },
);
