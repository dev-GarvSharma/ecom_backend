import { DataTypes } from "sequelize";
import sequelize from "../../config/database.js";

const b = { timestamps: true, underscored: true };

const CartItem = sequelize.define(
  "CartItem",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    cartId: { type: DataTypes.UUID, allowNull: false },
    variantId: { type: DataTypes.UUID, allowNull: false },
    promotionId: DataTypes.UUID,
    isPromotional: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    quantity: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  },
  {
    ...b,
    tableName: "cart_items",
    indexes: [{ unique: true, fields: ["cart_id", "variant_id"] }],
  },
);

export default CartItem;
