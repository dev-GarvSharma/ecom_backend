import { Op } from "sequelize";
import {
  sequelize,
  Cart,
  CartItem,
  Product,
  ProductImage,
  ProductVariant,
  CartSession,
  UserInteractionEvent,
  Promotion,
} from "../database/models/index.js";
import { ok, fail } from "../utils/http.js";

export const cartGet = async (req, res) => {
  const [c] = await Cart.findOrCreate({ where: { userId: req.user.id } });
  const [session] = await CartSession.findOrCreate({
    where: { cartId: c.id },
    defaults: { lastActivityAt: new Date() },
  });
  await session.update({ lastActivityAt: new Date(), status: "active", abandonedAt: null, recoverySentAt: null });
  return ok(
    res,
    await CartItem.findAll({
      where: { cartId: c.id },
      include: [
        {
          model: ProductVariant,
          as: "variant",
          include: [
            { model: Product, as: "product", include: [{ model: ProductImage, as: "images" }] },
          ],
        },
        { model: Promotion, as: "promotion" },
      ],
    }),
    "Cart loaded.",
  );
};

export const applyPromotion = async (req, res) => {
  const code = String(req.body.code || "")
    .trim()
    .toUpperCase();
  const promotion = await Promotion.findOne({ where: { code, active: true } });
  if (!promotion || promotion.type !== "free_product" || !promotion.promotionalVariantId)
    return fail(res, 404, "Promotion is unavailable.");
  const now = new Date();
  if (
    (promotion.startsAt && promotion.startsAt > now) ||
    (promotion.endsAt && promotion.endsAt < now) ||
    (promotion.usageLimit && promotion.usedCount >= promotion.usageLimit)
  )
    return fail(res, 409, "Promotion is not currently available.");
  const [cart] = await Cart.findOrCreate({ where: { userId: req.user.id } });
  const variant = await ProductVariant.findOne({
    where: { id: promotion.promotionalVariantId, active: true },
    include: [{ model: Product, as: "product", where: { status: "active", showOnShop: true } }],
  });
  if (!variant || variant.stock < 1) return fail(res, 409, "Promotional product is out of stock.");
  const existingItems = await CartItem.findAll({
    where: { cartId: cart.id },
    include: [{ model: ProductVariant, as: "variant" }],
  });
  if (existingItems.some((item) => item.variantId === variant.id))
    return fail(
      res,
      409,
      "This product option is already in your cart; choose another promotional item.",
    );
  const subtotal = existingItems.reduce(
    (sum, item) =>
      sum + (item.isPromotional ? 0 : Number(item.variant?.price || 0) * item.quantity),
    0,
  );
  if (subtotal < Number(promotion.minimumSubtotal))
    return fail(res, 409, "Cart does not meet this promotion's minimum spend.");
  const [item, created] = await CartItem.findOrCreate({
    where: { cartId: cart.id, variantId: variant.id },
    defaults: { quantity: 1, promotionId: promotion.id, isPromotional: true },
  });
  if (!created) await item.update({ promotionId: promotion.id, isPromotional: true, quantity: 1 });
  const [session] = await CartSession.findOrCreate({
    where: { cartId: cart.id },
    defaults: { lastActivityAt: new Date() },
  });
  await session.update({ lastActivityAt: new Date(), status: "active", abandonedAt: null, recoverySentAt: null });
  await UserInteractionEvent.create({
    userId: req.user.id,
    cartId: cart.id,
    eventType: "promotion.applied",
    details: { promotionId: promotion.id, code },
  });
  return ok(res, item, "Promotional product added to cart.", null, created ? 201 : 200);
};

export const cartAdd = async (req, res) => {
  const q = Number(req.body.quantity);
  const variant = await ProductVariant.findOne({
    where: { id: req.body.variantId, active: true },
    include: [{ model: Product, as: "product", where: { showOnShop: true, status: "active" } }],
  });
  if (!variant) return fail(res, 404, "Product option not found.");
  if (!Number.isInteger(q) || q < 1 || q > 99) return fail(res, 400, "Quantity must be 1 to 99.");
  if (variant.stock < q) return fail(res, 409, "Not enough stock for this option.");
  const [c] = await Cart.findOrCreate({ where: { userId: req.user.id } });
  const [i, newItem] = await CartItem.findOrCreate({
    where: { cartId: c.id, variantId: variant.id },
    defaults: { quantity: q },
  });
  if (!newItem && i.isPromotional) {
    await i.update({ quantity: q, isPromotional: false, promotionId: null });
  } else if (!newItem) {
    if (variant.stock < i.quantity + q) return fail(res, 409, "Not enough stock for this option.");
    i.quantity += q;
    await i.save();
  }
  await CartSession.findOrCreate({
    where: { cartId: c.id },
    defaults: { lastActivityAt: new Date() },
  }).then(([session]) =>
    session.update({ lastActivityAt: new Date(), status: "active", abandonedAt: null, recoverySentAt: null }),
  );
  await UserInteractionEvent.create({
    userId: req.user.id,
    cartId: c.id,
    eventType: "cart.item_added",
    details: { variantId: variant.id, quantity: q },
  });
  return ok(res, i, "Cart updated.", null, newItem ? 201 : 200);
};

export const cartSync = async (req, res) => {
  const items = req.body.items;
  if (!Array.isArray(items)) return fail(res, 400, "Cart items are required.");
  const normalized = items.map((item) => ({
    variantId: String(item.variantId || ""),
    quantity: Number(item.quantity),
  }));
  if (
    normalized.some(
      (item) =>
        !item.variantId ||
        !Number.isInteger(item.quantity) ||
        item.quantity < 1 ||
        item.quantity > 99,
    )
  )
    return fail(res, 400, "Each cart item needs a variant and quantity from 1 to 99.");
  const variantIds = normalized.map((item) => item.variantId);
  if (new Set(variantIds).size !== variantIds.length)
    return fail(res, 400, "Cart contains duplicate variants.");

  const result = await sequelize
    .transaction(async (transaction) => {
      const variants = await ProductVariant.findAll({
        where: { id: { [Op.in]: variantIds }, active: true },
        include: [{ model: Product, as: "product", where: { showOnShop: true, status: "active" } }],
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (variants.length !== normalized.length)
        throw Object.assign(new Error("One or more selected perfume sizes are unavailable."), {
          status: 409,
        });
      for (const item of normalized) {
        const variant = variants.find((row) => row.id === item.variantId);
        if (variant.stock < item.quantity)
          throw Object.assign(new Error(`Not enough stock for ${variant.product.name}.`), {
            status: 409,
          });
      }
      const [cart] = await Cart.findOrCreate({
        where: { userId: req.user.id },
        transaction,
      });
      await CartItem.destroy({ where: { cartId: cart.id }, transaction });
      if (normalized.length)
        await CartItem.bulkCreate(
          normalized.map((item) => ({ cartId: cart.id, ...item })),
          { transaction },
        );
      const [session] = await CartSession.findOrCreate({
        where: { cartId: cart.id },
        defaults: { lastActivityAt: new Date() },
        transaction,
      });
      await session.update(
        { lastActivityAt: new Date(), status: "active", abandonedAt: null, recoverySentAt: null },
        { transaction },
      );
      await UserInteractionEvent.create(
        {
          userId: req.user.id,
          cartId: cart.id,
          eventType: "cart.synced",
          details: { itemCount: normalized.length },
        },
        { transaction },
      );
      return { cartId: cart.id, items: normalized };
    })
    .catch((error) => {
      if (error.status) return { error };
      throw error;
    });
  if (result.error) return fail(res, result.error.status, result.error.message);
  return ok(res, result, "Cart synchronized.");
};

export const cartAbandon = async (req, res) => {
  const cart = await Cart.findOne({ where: { userId: req.user.id } });
  if (!cart) return fail(res, 404, "Cart not found.");
  if (!(await CartItem.count({ where: { cartId: cart.id } })))
    return fail(res, 409, "Add a product before submitting cart abandonment feedback.");
  const allowed = new Set(["price", "shipping_cost", "payment_issue", "changed_mind", "other"]);
  const reason = String(req.body.reason || "other");
  if (!allowed.has(reason)) return fail(res, 400, "Choose a supported abandonment reason.");
  const comment = String(req.body.comment || "")
    .trim()
    .slice(0, 500);
  const [session] = await CartSession.findOrCreate({
    where: { cartId: cart.id },
    defaults: { lastActivityAt: new Date() },
  });
  await session.update({
    status: "abandoned",
    abandonedAt: new Date(),
    abandonmentReason: reason,
    abandonmentComment: comment || null,
    lastActivityAt: new Date(),
    recoverySentAt: null,
  });
  await UserInteractionEvent.create({
    userId: req.user.id,
    cartId: cart.id,
    eventType: "cart.abandoned",
    details: { reason, comment: comment || null },
  });
  return ok(res, { status: "abandoned" }, "Abandonment feedback saved.");
};

export const cartUpdate = async (req, res) => {
  const i = await CartItem.findByPk(req.params.id, {
    include: [
      { model: Cart, where: { userId: req.user.id } },
      { model: ProductVariant, as: "variant" },
    ],
  });
  if (!i) return fail(res, 404, "Cart item not found.");
  const q = Number(req.body.quantity);
  if (q === 0) {
    await i.destroy();
    await CartSession.update(
      { lastActivityAt: new Date(), status: "active", abandonedAt: null, recoverySentAt: null },
      { where: { cartId: i.cartId } },
    );
    await UserInteractionEvent.create({
      userId: req.user.id,
      cartId: i.cartId,
      eventType: "cart.item_removed",
      details: { cartItemId: i.id, variantId: i.variantId },
    });
    return ok(res, null, "Cart item removed.");
  }
  if (!Number.isInteger(q) || q < 1 || q > 99) return fail(res, 400, "Quantity must be 1 to 99.");
  if (i.isPromotional && q !== 1)
    return fail(res, 400, "A promotional product is limited to one unit.");
  if (i.variant.stock < q) return fail(res, 409, "Not enough stock for this option.");
  i.quantity = q;
  await i.save();
  await CartSession.update(
    { lastActivityAt: new Date(), status: "active", abandonedAt: null, recoverySentAt: null },
    { where: { cartId: i.cartId } },
  );
  await UserInteractionEvent.create({
    userId: req.user.id,
    cartId: i.cartId,
    eventType: "cart.item_updated",
    details: { cartItemId: i.id, variantId: i.variantId, quantity: q },
  });
  return ok(res, i, "Cart updated.");
};

export const cartRemove = async (req, res) => {
  const i = await CartItem.findByPk(req.params.id, {
    include: [{ model: Cart, where: { userId: req.user.id } }],
  });
  if (!i) return fail(res, 404, "Cart item not found.");
  await i.destroy();
  await CartSession.update(
    { lastActivityAt: new Date(), status: "active", abandonedAt: null, recoverySentAt: null },
    { where: { cartId: i.cartId } },
  );
  await UserInteractionEvent.create({
    userId: req.user.id,
    cartId: i.cartId,
    eventType: "cart.item_removed",
    details: { cartItemId: i.id, variantId: i.variantId },
  });
  return ok(res, null, "Cart item removed.");
};
