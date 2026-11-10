import { DataTypes } from "sequelize";
import sequelize from "../../config/database.js";

const ProductReelLink = sequelize.define(
  "ProductReelLink",
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    productId: { type: DataTypes.UUID, allowNull: false },
    url: { type: DataTypes.STRING(1000), allowNull: false },
    position: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  },
  { timestamps: true, underscored: true, tableName: "product_reel_links" },
);

export default ProductReelLink;
