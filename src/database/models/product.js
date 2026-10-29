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
    description: DataTypes.TEXT,
    brand: DataTypes.STRING(120),
    concentration: DataTypes.STRING(80),
    fragranceFamily: DataTypes.STRING(120),
    topNotes: { type: DataTypes.JSON, allowNull: false, defaultValue: [] },
    heartNotes: { type: DataTypes.JSON, allowNull: false, defaultValue: [] },
    baseNotes: { type: DataTypes.JSON, allowNull: false, defaultValue: [] },
    attributes: { type: DataTypes.JSON, allowNull: false, defaultValue: {} },
    showOnShop: { type: DataTypes.BOOLEAN, defaultValue: true },
    status: {
      type: DataTypes.ENUM("active", "draft", "archived"),
      defaultValue: "active",
    },
  },
  { ...b, tableName: "products" },
);

export default Product;
