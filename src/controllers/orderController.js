import {
  sequelize,
  Product,
  ProductVariant,
  Cart,
  CartItem,
  Order,
  OrderItem,
  Coupon,
  Notification,
  CartSession,
  UserInteractionEvent,
  Promotion,
  Setting,
} from "../database/models/index.js";
import { ok, fail } from "../utils/http.js";
import { createHmac, timingSafeEqual } from "node:crypto";
import {
  createRazorpayOrder,
  fetchRazorpayPayment,
  getRazorpayKeyId,
} from "../services/razorpay.js";

export const checkout = async (req, res) => {
  const { address, paymentMode, paymentMethod, couponCode } = req.body;
  const method = String(paymentMode || paymentMethod || "UPI").toUpperCase();
  const modeSetting = await Setting.findByPk("razorpay_mode");
  const razorpayMode = modeSetting?.value === "test" ? "test" : "live";
  const availableMethods =
    process.env.ENABLE_COD === "true" ? ["COD", "UPI", "CARD"] : ["UPI", "CARD"];
  if (!availableMethods.includes(method))
    return fail(res, 400, `Payment mode must be ${availableMethods.join(" or ")}.`);
  if (
    !address?.recipient ||
    !address?.line1 ||
    !address?.city ||
    !address?.postalCode ||
    !address?.phone
  )
    return fail(res, 400, "Complete shipping address required.");
  const [checkoutCart] = await Cart.findOrCreate({ where: { userId: req.user.id } });
  const [checkoutSession] = await CartSession.findOrCreate({
    where: { cartId: checkoutCart.id },
    defaults: { lastActivityAt: new Date() },
  });
  await checkoutSession.update({
    checkoutStartedAt: new Date(),
    lastActivityAt: new Date(),
    status: "active",
    abandonedAt: null,
    recoverySentAt: null,
  });
  await UserInteractionEvent.create({
    userId: req.user.id,
    cartId: checkoutCart.id,
    eventType: "checkout.started",
    details: { paymentMode: method },
  });
  const result = await sequelize.transaction(async (t) => {
    const [c] = await Cart.findOrCreate({
      where: { userId: req.user.id },
      transaction: t,
    });
    const items = await CartItem.findAll({
      where: { cartId: c.id },
      include: [
        { model: ProductVariant, as: "variant", include: [{ model: Product, as: "product" }] },
      ],
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    if (!items.length) throw Object.assign(new Error("Cart is empty."), { status: 400 });
    let subtotal = 0;
    for (const i of items) {
      if (
        !i.variant?.active ||
        !i.variant.product ||
        i.variant.product.status !== "active" ||
        !i.variant.product.showOnShop ||
        i.variant.stock < i.quantity
      )
        throw Object.assign(
          new Error("Insufficient stock for " + (i.variant?.product?.name || "item")),
          { status: 409 },
        );
      if (!i.isPromotional) subtotal += Number(i.variant.price) * i.quantity;
    }
    const promotions = new Map();
    for (const i of items.filter((item) => item.isPromotional)) {
      const promotion = i.promotionId
        ? await Promotion.findByPk(i.promotionId, { transaction: t, lock: t.LOCK.UPDATE })
        : null;
      if (
        !promotion ||
        !promotion.active ||
        promotion.type !== "free_product" ||
        promotion.promotionalVariantId !== i.variant.id ||
        subtotal < Number(promotion.minimumSubtotal) ||
        (promotion.usageLimit && promotion.usedCount >= promotion.usageLimit) ||
        (promotion.startsAt && promotion.startsAt > new Date()) ||
        (promotion.endsAt && promotion.endsAt < new Date())
      )
        throw Object.assign(new Error("Promotional product no longer qualifies for this cart."), {
          status: 409,
        });
      promotions.set(promotion.id, promotion);
    }
    for (const promotion of promotions.values()) {
      promotion.usedCount += 1;
      await promotion.save({ transaction: t });
    }
    let discount = 0,
      coupon = null;
    if (couponCode) {
      coupon = await Coupon.findOne({
        where: { code: String(couponCode).toUpperCase(), active: true },
        transaction: t,
        lock: t.LOCK.UPDATE,
      });
      const now = new Date();
      if (
        !coupon ||
        (coupon.startsAt && coupon.startsAt > now) ||
        (coupon.expiresAt && coupon.expiresAt < now) ||
        subtotal < Number(coupon.minOrder) ||
        (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit)
      )
        throw Object.assign(new Error("Coupon unavailable."), { status: 400 });
      if (coupon.perUserLimit) {
        const userCouponUses = await Order.count({
          where: { userId: req.user.id, couponCode: coupon.code },
          transaction: t,
          lock: t.LOCK.UPDATE,
        });
        if (userCouponUses >= coupon.perUserLimit)
          throw Object.assign(new Error("You have reached the usage limit for this coupon."), {
            status: 400,
          });
      }
      discount =
        coupon.type === "percentage"
          ? (subtotal * Number(coupon.value)) / 100
          : Number(coupon.value);
      if (coupon.maxDiscount) discount = Math.min(discount, Number(coupon.maxDiscount));
      discount = Math.min(discount, subtotal);
      coupon.usedCount++;
      await coupon.save({ transaction: t });
    }
    const shipping = subtotal - discount >= 2999 ? 0 : 99;
    const order = await Order.create(
      {
        orderNumber: "EC-" + Date.now().toString(36).toUpperCase(),
        userId: req.user.id,
        status: "Pending",
        paymentMethod: method,
        paymentProvider: method === "COD" ? null : "razorpay",
        razorpayMode: method === "COD" ? "live" : razorpayMode,
        currency: "INR",
        subtotal,
        discount,
        shipping,
        total: subtotal - discount + shipping,
        shippingAddress: address,
        couponCode: coupon?.code,
      },
      { transaction: t },
    );
    let payment = null;
    if (method !== "COD") {
      const razorpayOrder = await createRazorpayOrder(
        {
          amount: Math.round(Number(order.total) * 100),
          currency: order.currency,
          receipt: order.orderNumber,
          notes: { ecom_order_id: order.id, ecom_order_number: order.orderNumber },
        },
        razorpayMode,
      );
      order.razorpayOrderId = razorpayOrder.id;
      await order.save({ transaction: t });
      payment = {
        keyId: getRazorpayKeyId(razorpayMode),
        orderId: razorpayOrder.id,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency,
        mode: method,
      };
    }
    for (const i of items) {
      await OrderItem.create(
        {
          orderId: order.id,
          productId: i.variant.product.id,
          variantId: i.variant.id,
          name: i.variant.product.name,
          sku: i.variant.sku,
          variantOptions: i.variant.options,
          productSnapshot: {
            id: i.variant.product.id,
            slug: i.variant.product.slug,
            description: i.variant.product.description,
          },
          variantSnapshot: { id: i.variant.id, sku: i.variant.sku, options: i.variant.options },
          quantity: i.quantity,
          unitPrice: i.isPromotional ? 0 : i.variant.price,
        },
        { transaction: t },
      );
      i.variant.stock -= i.quantity;
      await i.variant.save({ transaction: t });
    }
    await CartItem.destroy({ where: { cartId: c.id }, transaction: t });
    const cartSession = await CartSession.findOne({
      where: { cartId: c.id },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    if (cartSession)
      await cartSession.update(
        { status: "converted", convertedOrderId: order.id, lastActivityAt: new Date() },
        { transaction: t },
      );
    await UserInteractionEvent.create(
      {
        userId: req.user.id,
        orderId: order.id,
        cartId: c.id,
        eventType: "order.placed",
        details: { paymentMethod: method, itemCount: items.length },
      },
      { transaction: t },
    );
    await Notification.create(
      {
        userId: req.user.id,
        title: "Order received",
        detail: order.orderNumber,
        type: "order",
      },
      { transaction: t },
    );
    return { order, payment };
  });
  return ok(res, result.payment ? result : result.order, "Order placed.", null, 201);
};

export const verifyPayment = async (req, res) => {
  const {
    razorpay_order_id: razorpayOrderId,
    razorpay_payment_id: paymentId,
    razorpay_signature: signature,
  } = req.body;
  const order = await Order.findOne({ where: { id: req.params.id, userId: req.user.id } });
  if (!order) return fail(res, 404, "Order not found.");
  if (order.paymentStatus === "Paid") return ok(res, order, "Payment already verified.");
  if (
    !order.razorpayOrderId ||
    order.razorpayOrderId !== razorpayOrderId ||
    typeof paymentId !== "string" ||
    typeof signature !== "string"
  )
    return fail(res, 400, "Payment details do not match this order.");

  const keySecret = getRazorpayKeySecret(order.razorpayMode || "live");
  const expected = createHmac("sha256", keySecret)
    .update(`${order.razorpayOrderId}|${paymentId}`)
    .digest();
  const received = Buffer.from(signature, "hex");
  if (received.length !== expected.length || !timingSafeEqual(received, expected))
    return fail(res, 400, "Invalid Razorpay payment signature.");

  const payment = await fetchRazorpayPayment(paymentId, order.razorpayMode || "live");
  if (
    payment.order_id !== order.razorpayOrderId ||
    Number(payment.amount) !== Math.round(Number(order.total) * 100) ||
    payment.currency !== order.currency
  )
    return fail(res, 400, "Payment does not match the order amount.");

  order.paymentId = paymentId;
  if (["upi", "card"].includes(payment.method)) order.paymentMethod = payment.method.toUpperCase();
  if (payment.status === "captured") {
    order.paymentStatus = "Paid";
    if (order.status === "Pending") order.status = "Processing";
  }
  await order.save();
  return ok(
    res,
    order,
    payment.status === "captured" ? "Payment verified." : "Payment is awaiting capture.",
  );
};

export const myOrders = async (req, res) =>
  ok(
    res,
    await Order.findAll({
      where: { userId: req.user.id },
      include: [{ model: OrderItem, as: "items" }],
      order: [["createdAt", "DESC"]],
    }),
    "Orders loaded.",
  );
