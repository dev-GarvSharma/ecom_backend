import { Op } from "sequelize";
import { sequelize, User, Category, Product, Cart, CartItem, Order, OrderItem, Coupon, Notification, Address, Campaign, Setting } from "../database/models/index.js";
import { ok, fail } from "../utils/http.js";
import { clearCache } from "../middleware/cache.js";


export const cartGet = async (req, res) => {
  const [c] = await Cart.findOrCreate({ where: { userId: req.user.id } });
  return ok(
    res,
    await CartItem.findAll({
      where: { cartId: c.id },
      include: [{ model: Product, as: "product" }],
    }),
    "Cart loaded.",
  );
};

export const cartAdd = async (req, res) => {
  const q = Number(req.body.quantity),
    p = await Product.findOne({
      where: { id: req.body.productId, showOnShop: true, status: "active" },
    });
  if (!p) return fail(res, 404, "Product not found.");
  if (!Number.isInteger(q) || q < 1 || q > 99)
    return fail(res, 400, "Quantity must be 1 to 99.");
  const [c] = await Cart.findOrCreate({ where: { userId: req.user.id } });
  const [i, newItem] = await CartItem.findOrCreate({
    where: { cartId: c.id, productId: p.id },
    defaults: { quantity: q },
  });
  if (!newItem) {
    i.quantity += q;
    await i.save();
  }
  return ok(res, i, "Cart updated.", null, newItem ? 201 : 200);
};

export const cartUpdate = async (req, res) => {
  const i = await CartItem.findByPk(req.params.id, {
    include: [{ model: Cart, where: { userId: req.user.id } }],
  });
  if (!i) return fail(res, 404, "Cart item not found.");
  const q = Number(req.body.quantity);
  if (q === 0) {
    await i.destroy();
    return ok(res, null, "Cart item removed.");
  }
  if (!Number.isInteger(q) || q < 1 || q > 99)
    return fail(res, 400, "Quantity must be 1 to 99.");
  i.quantity = q;
  await i.save();
  return ok(res, i, "Cart updated.");
};

export const cartRemove = async (req, res) => {
  const i = await CartItem.findByPk(req.params.id, {
    include: [{ model: Cart, where: { userId: req.user.id } }],
  });
  if (!i) return fail(res, 404, "Cart item not found.");
  await i.destroy();
  return ok(res, null, "Cart item removed.");
};
