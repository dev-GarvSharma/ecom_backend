import { DataTypes } from "sequelize";
import sequelize from "../../config/database.js";

const b = { timestamps: true, underscored: true };

const Address = sequelize.define(
  "Address",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    userId: { type: DataTypes.UUID, allowNull: false },
    recipient: DataTypes.STRING,
    phone: DataTypes.STRING,
    line1: DataTypes.STRING,
    line2: DataTypes.STRING,
    city: DataTypes.STRING,
    state: DataTypes.STRING,
    postalCode: DataTypes.STRING,
    country: { type: DataTypes.STRING(2), defaultValue: "IN" },
    isDefault: { type: DataTypes.BOOLEAN, defaultValue: false },
  },
  { ...b, tableName: "user_addresses" },
);

export default Address;
