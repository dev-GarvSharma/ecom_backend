import { DataTypes } from "sequelize";
import sequelize from "../../config/database.js";

const b = { timestamps: true, underscored: true };

const Category = sequelize.define(
  "Category",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: { type: DataTypes.STRING(120), allowNull: false },
    slug: { type: DataTypes.STRING(150), unique: true },
    description: DataTypes.TEXT,
    image: { type: DataTypes.STRING(1024), allowNull: true },
    priority: { type: DataTypes.INTEGER, defaultValue: 0 },
    showOnHomePage: { type: DataTypes.BOOLEAN, defaultValue: false },
    active: { type: DataTypes.BOOLEAN, defaultValue: true },
    metaTitle: DataTypes.STRING,
    metaDescription: DataTypes.STRING,
    robotsMetaTag: DataTypes.STRING,
  },
  { ...b, tableName: "categories" },
);

export default Category;
