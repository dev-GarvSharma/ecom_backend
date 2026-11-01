import { DataTypes } from "sequelize";
import sequelize from "../../config/database.js";

const ProductVariant = sequelize.define(
  "ProductVariant",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    productId: { type: DataTypes.UUID, allowNull: false },
    sku: { type: DataTypes.STRING(80), unique: true, allowNull: false },
    options: { type: DataTypes.JSON, allowNull: false, defaultValue: {} },
    images: { type: DataTypes.JSON, allowNull: false, defaultValue: [] },
    price: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
    compareAtPrice: { type: DataTypes.DECIMAL(12, 2), allowNull: true },
    stock: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
    active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  },
  {
    timestamps: true,
    underscored: true,
    tableName: "product_variants",
    indexes: [{ fields: ["product_id"] }],
  },
);

export default ProductVariant;
