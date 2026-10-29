import { DataTypes } from "sequelize";
import sequelize from "../../config/database.js";
export default sequelize.define(
  "AuditLog",
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    actorUserId: DataTypes.UUID,
    action: { type: DataTypes.STRING(120), allowNull: false },
    resourceType: { type: DataTypes.STRING(80), allowNull: false },
    resourceId: DataTypes.STRING(80),
    changes: { type: DataTypes.JSON, defaultValue: {} },
    ipAddress: DataTypes.STRING(45),
  },
  { tableName: "audit_logs", underscored: true, timestamps: true },
);
