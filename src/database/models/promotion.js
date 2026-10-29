import { DataTypes } from "sequelize";
import sequelize from "../../config/database.js";
export default sequelize.define(
  "Promotion",
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    code: { type: DataTypes.STRING(50), allowNull: false, unique: true },
    name: { type: DataTypes.STRING(160), allowNull: false },
    type: { type: DataTypes.ENUM("free_product", "percentage", "fixed"), allowNull: false },
    value: DataTypes.DECIMAL(12, 2),
    promotionalVariantId: DataTypes.UUID,
    minimumSubtotal: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
    startsAt: DataTypes.DATE,
    endsAt: DataTypes.DATE,
    usageLimit: DataTypes.INTEGER,
    usedCount: { type: DataTypes.INTEGER.UNSIGNED, defaultValue: 0 },
    active: { type: DataTypes.BOOLEAN, defaultValue: true },
  },
  { tableName: "promotions", underscored: true, timestamps: true },
);
