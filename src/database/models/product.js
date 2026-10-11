import { DataTypes } from "sequelize";
import sequelize from "../../config/database.js";

const b = { timestamps: true, underscored: true };

const Product = sequelize.define(
  "Product",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    categoryId: { type: DataTypes.UUID, allowNull: false },
    name: { type: DataTypes.STRING(180), allowNull: false },
    slug: { type: DataTypes.STRING(200), unique: true },
    sku: { type: DataTypes.STRING(80), unique: true, allowNull: false },
    description: DataTypes.TEXT,
    price: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
    mrp: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
    stock: { type: DataTypes.INTEGER.UNSIGNED, defaultValue: 0 },
    weight: DataTypes.STRING,
    showOnShop: { type: DataTypes.BOOLEAN, defaultValue: true },
    status: {
      type: DataTypes.ENUM("active", "draft", "archived"),
      defaultValue: "active",
    },
  },
  { ...b, tableName: "products" },
);

export default Product;
