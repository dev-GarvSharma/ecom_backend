import { DataTypes } from "sequelize";
import sequelize from "../../config/database.js";

export default sequelize.define(
  "BlogPost",
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    title: { type: DataTypes.STRING(200), allowNull: false },
    slug: { type: DataTypes.STRING(220), allowNull: false, unique: true },
    description: { type: DataTypes.STRING(500), allowNull: false },
    content: { type: DataTypes.TEXT("long"), allowNull: false },
    metaTitle: DataTypes.STRING(200),
    metaDescription: DataTypes.STRING(320),
    metaTags: { type: DataTypes.JSON, allowNull: false, defaultValue: [] },
    bannerImage: DataTypes.STRING(1024),
    status: { type: DataTypes.ENUM("draft", "published"), allowNull: false, defaultValue: "draft" },
    publishedAt: DataTypes.DATE,
  },
  { tableName: "blog_posts", underscored: true, timestamps: true },
);
