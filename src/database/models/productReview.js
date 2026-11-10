import { DataTypes } from "sequelize";
import sequelize from "../../config/database.js";

const ProductReview = sequelize.define(
  "ProductReview",
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    productId: { type: DataTypes.UUID, allowNull: false },
    userId: { type: DataTypes.UUID, allowNull: true },
    customerName: { type: DataTypes.STRING(120), allowNull: false },
    rating: { type: DataTypes.INTEGER, allowNull: false },
    title: { type: DataTypes.STRING(180), allowNull: true },
    body: { type: DataTypes.TEXT, allowNull: false },
    status: {
      type: DataTypes.ENUM("pending", "approved", "disapproved"),
      allowNull: false,
      defaultValue: "pending",
    },
  },
  { timestamps: true, underscored: true, tableName: "product_reviews" },
);

export default ProductReview;
