import User from "./user.js";
import Category from "./category.js";
import Product from "./product.js";
import Cart from "./cart.js";
import CartItem from "./cartItem.js";
import Order from "./order.js";
import OrderItem from "./orderItem.js";
import Coupon from "./coupon.js";
import Notification from "./notification.js";
import Campaign from "./campaign.js";
import Setting from "./setting.js";
import Address from "./address.js";
import ProductImage from "./productImage.js";
import ProductVariant from "./productVariant.js";
import Role from "./role.js";
import Permission from "./permission.js";
import Promotion from "./promotion.js";
import CartSession from "./cartSession.js";
import UserInteractionEvent from "./userInteractionEvent.js";
import AuditLog from "./auditLog.js";
import CampaignDelivery from "./campaignDelivery.js";

Category.hasMany(Product, { foreignKey: "categoryId", as: "products" });
Product.belongsTo(Category, { foreignKey: "categoryId", as: "category" });
Product.hasMany(ProductImage, {
  foreignKey: "productId",
  as: "images",
  onDelete: "CASCADE",
});
ProductImage.belongsTo(Product, { foreignKey: "productId", as: "product" });
Product.hasMany(ProductVariant, {
  foreignKey: "productId",
  as: "variants",
  onDelete: "CASCADE",
});
ProductVariant.belongsTo(Product, { foreignKey: "productId", as: "product" });
User.hasOne(Cart, { foreignKey: "userId", as: "cart" });
Cart.belongsTo(User, { foreignKey: "userId", as: "user" });
Cart.hasMany(CartItem, {
  foreignKey: "cartId",
  as: "items",
  onDelete: "CASCADE",
});
CartItem.belongsTo(Cart, { foreignKey: "cartId" });
CartItem.belongsTo(ProductVariant, { foreignKey: "variantId", as: "variant" });
ProductVariant.hasMany(CartItem, { foreignKey: "variantId", as: "cartItems" });
User.hasMany(Order, { foreignKey: "userId", as: "orders" });
Order.belongsTo(User, { foreignKey: "userId", as: "customer" });
Order.hasMany(OrderItem, {
  foreignKey: "orderId",
  as: "items",
  onDelete: "CASCADE",
});
OrderItem.belongsTo(ProductVariant, { foreignKey: "variantId", as: "variant" });
User.hasMany(Address, { foreignKey: "userId", as: "addresses" });
User.belongsTo(Role, { foreignKey: "roleId", as: "primaryRole" });
Role.hasMany(User, { foreignKey: "roleId", as: "primaryUsers" });
User.belongsToMany(Role, {
  through: "user_roles",
  foreignKey: "user_id",
  otherKey: "role_id",
  as: "roles",
});
Role.belongsToMany(User, {
  through: "user_roles",
  foreignKey: "role_id",
  otherKey: "user_id",
  as: "users",
});
Role.belongsToMany(Permission, {
  through: "role_permissions",
  foreignKey: "role_id",
  otherKey: "permission_id",
  as: "permissions",
});
Permission.belongsToMany(Role, {
  through: "role_permissions",
  foreignKey: "permission_id",
  otherKey: "role_id",
  as: "roles",
});
User.belongsToMany(Permission, {
  through: "user_permissions",
  foreignKey: "user_id",
  otherKey: "permission_id",
  as: "directPermissions",
});
Permission.belongsToMany(User, {
  through: "user_permissions",
  foreignKey: "permission_id",
  otherKey: "user_id",
  as: "directUsers",
});
Cart.hasOne(CartSession, { foreignKey: "cartId", as: "session" });
CartSession.belongsTo(Cart, { foreignKey: "cartId" });
User.hasMany(UserInteractionEvent, { foreignKey: "userId", as: "interactionEvents" });
UserInteractionEvent.belongsTo(User, { foreignKey: "userId", as: "user" });
User.hasMany(AuditLog, { foreignKey: "actorUserId", as: "auditEvents" });
AuditLog.belongsTo(User, { foreignKey: "actorUserId", as: "actor" });
Campaign.hasMany(CampaignDelivery, { foreignKey: "campaignId", as: "deliveries", onDelete: "CASCADE" });
CampaignDelivery.belongsTo(Campaign, { foreignKey: "campaignId", as: "campaign" });
User.hasMany(CampaignDelivery, { foreignKey: "userId", as: "campaignDeliveries" });
CampaignDelivery.belongsTo(User, { foreignKey: "userId", as: "recipient" });
CartItem.belongsTo(Promotion, { foreignKey: "promotionId", as: "promotion" });
Promotion.hasMany(CartItem, { foreignKey: "promotionId", as: "cartItems" });
