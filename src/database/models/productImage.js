import { DataTypes } from "sequelize";
import sequelize from "../../config/database.js";

const ProductImage = sequelize.define(
  "ProductImage",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    productId: { type: DataTypes.UUID, allowNull: false },
    path: { type: DataTypes.STRING(1024), allowNull: false },
  },
  { tableName: "product_images", underscored: true, timestamps: true },
);

export default ProductImage;
