import { sequelize, Product, Cart, CartItem, Order, OrderItem, Coupon, Notification } from "../database/models/index.js";
import { ok, fail } from "../utils/http.js";
import { createHmac, timingSafeEqual } from "node:crypto";
import { createRazorpayOrder, fetchRazorpayPayment, getRazorpayKeyId } from "../services/razorpay.js";

export const checkout = async (req, res) => {
  const { address, paymentMode, paymentMethod, couponCode } = req.body;
  const method = String(paymentMode || paymentMethod || "COD").toUpperCase();
  if (!["COD", "UPI", "CARD"].includes(method))
    return fail(res, 400, "Payment mode must be COD, UPI, or CARD.");
  if (
    !address?.recipient ||
    !address?.line1 ||
    !address?.city ||
    !address?.postalCode ||
    !address?.phone
  )
    return fail(res, 400, "Complete shipping address required.");
  const result = await sequelize.transaction(async (t) => {
    const [c] = await Cart.findOrCreate({
      where: { userId: req.user.id },
      transaction: t,
    });
    const items = await CartItem.findAll({
      where: { cartId: c.id },
      include: [{ model: Product, as: "product" }],
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    if (!items.length)
      throw Object.assign(new Error("Cart is empty."), { status: 400 });
    let subtotal = 0;
    for (const i of items) {
      if (!i.product || i.product.stock < i.quantity)
        throw Object.assign(
          new Error("Insufficient stock for " + (i.product?.name || "item")),
          { status: 409 },
        );
      subtotal += Number(i.product.price) * i.quantity;
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
      discount =
        coupon.type === "percentage"
          ? (subtotal * Number(coupon.value)) / 100
          : Number(coupon.value);
      if (coupon.maxDiscount)
        discount = Math.min(discount, Number(coupon.maxDiscount));
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
      const razorpayOrder = await createRazorpayOrder({
        amount: Math.round(Number(order.total) * 100),
        currency: order.currency,
        receipt: order.orderNumber,
        notes: { ecom_order_id: order.id, ecom_order_number: order.orderNumber },
      });
      order.razorpayOrderId = razorpayOrder.id;
      await order.save({ transaction: t });
      payment = {
        keyId: getRazorpayKeyId(),
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
          productId: i.product.id,
          name: i.product.name,
          sku: i.product.sku,
          quantity: i.quantity,
          unitPrice: i.product.price,
        },
        { transaction: t },
      );
      i.product.stock -= i.quantity;
      await i.product.save({ transaction: t });
    }
    await CartItem.destroy({ where: { cartId: c.id }, transaction: t });
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
  const { razorpay_order_id: razorpayOrderId, razorpay_payment_id: paymentId, razorpay_signature: signature } = req.body;
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

  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keySecret) return fail(res, 503, "Razorpay is not configured.");
  const expected = createHmac("sha256", keySecret)
    .update(`${order.razorpayOrderId}|${paymentId}`)
    .digest();
  const received = Buffer.from(signature, "hex");
  if (received.length !== expected.length || !timingSafeEqual(received, expected))
    return fail(res, 400, "Invalid Razorpay payment signature.");

  const payment = await fetchRazorpayPayment(paymentId);
  if (
    payment.order_id !== order.razorpayOrderId ||
    Number(payment.amount) !== Math.round(Number(order.total) * 100) ||
    payment.currency !== order.currency
  )
    return fail(res, 400, "Payment does not match the order amount.");

  order.paymentId = paymentId;
  if (["upi", "card"].includes(payment.method))
    order.paymentMethod = payment.method.toUpperCase();
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
