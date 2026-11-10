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
    ratingAverage: { type: DataTypes.DECIMAL(3, 2), allowNull: true },
    reviewCount: { type: DataTypes.INTEGER, allowNull: true },
    sprays: { type: DataTypes.INTEGER, allowNull: true },
    labelText: { type: DataTypes.STRING(255), allowNull: true },
    metaTitle: { type: DataTypes.STRING(255), allowNull: true },
    metaDescription: { type: DataTypes.TEXT, allowNull: true },
    metaKeywords: { type: DataTypes.TEXT, allowNull: true },
    url: { type: DataTypes.STRING(500), allowNull: true },
    canonicalUrl: { type: DataTypes.STRING(500), allowNull: true },
    robotsTags: { type: DataTypes.STRING(255), allowNull: true },
    showOnShop: { type: DataTypes.BOOLEAN, defaultValue: true },
    status: {
      type: DataTypes.ENUM("active", "draft", "archived"),
      defaultValue: "active",
    },
  },
  { ...b, tableName: "products" },
);

export default Product;
