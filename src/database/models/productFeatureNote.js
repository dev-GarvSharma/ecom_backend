import { DataTypes } from "sequelize";
import sequelize from "../../config/database.js";

const ProductFeatureNote = sequelize.define(
  "ProductFeatureNote",
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    productId: { type: DataTypes.UUID, allowNull: false },
    text: { type: DataTypes.TEXT, allowNull: false },
    image: { type: DataTypes.STRING(1000), allowNull: true },
    position: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  },
  { timestamps: true, underscored: true, tableName: "product_feature_notes" },
);

export default ProductFeatureNote;
