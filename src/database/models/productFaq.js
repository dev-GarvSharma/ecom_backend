import { DataTypes } from "sequelize";
import sequelize from "../../config/database.js";

const ProductFaq = sequelize.define(
  "ProductFaq",
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    productId: { type: DataTypes.UUID, allowNull: false },
    question: { type: DataTypes.STRING(500), allowNull: false },
    answer: { type: DataTypes.TEXT, allowNull: false },
    position: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  },
  { timestamps: true, underscored: true, tableName: "product_faqs" },
);

export default ProductFaq;
