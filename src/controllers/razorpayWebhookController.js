import { createHmac, timingSafeEqual } from "node:crypto";
import { Order } from "../database/models/index.js";
import { fail, ok } from "../utils/http.js";

const validSignature = (body, signature, secret) => {
  if (typeof signature !== "string" || !secret) return false;
  const expected = createHmac("sha256", secret).update(body).digest();
  const received = Buffer.from(signature, "hex");
  return received.length === expected.length && timingSafeEqual(received, expected);
};

export const razorpayWebhook = async (req, res) => {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) return fail(res, 503, "Razorpay webhook is not configured.");
  if (!Buffer.isBuffer(req.body))
    return fail(res, 400, "Raw webhook body is required.");
  if (!validSignature(req.body, req.get("x-razorpay-signature"), secret))
    return fail(res, 400, "Invalid Razorpay webhook signature.");

  let event;
  try {
    event = JSON.parse(req.body.toString("utf8"));
  } catch {
    return fail(res, 400, "Invalid webhook payload.");
  }

  const payment = event.payload?.payment?.entity;
  const gatewayOrderId = payment?.order_id || event.payload?.order?.entity?.id;
  const refund = event.payload?.refund?.entity;
  const where = refund?.payment_id
    ? { paymentId: refund.payment_id }
    : gatewayOrderId
      ? { razorpayOrderId: gatewayOrderId }
      : null;
  if (!where) return ok(res, { received: true, matched: false }, "Webhook received.");

  const order = await Order.findOne({ where });
  if (!order) return ok(res, { received: true, matched: false }, "Webhook received.");

  switch (event.event) {
    case "payment.captured":
    case "order.paid":
      if (
        payment &&
        (Number(payment.amount) !== Math.round(Number(order.total) * 100) ||
          payment.currency !== order.currency)
      )
        return fail(res, 400, "Payment amount does not match the order.");
      if (
        event.event === "order.paid" &&
        Number(event.payload.order.entity.amount_paid) < Math.round(Number(order.total) * 100)
      )
        return fail(res, 400, "Paid amount does not match the order.");
      if (order.paymentStatus !== "Refunded") {
        order.paymentStatus = "Paid";
        if (order.status === "Pending") order.status = "Processing";
      }
      if (payment?.id) order.paymentId = payment.id;
      if (["upi", "card"].includes(payment?.method))
        order.paymentMethod = payment.method.toUpperCase();
      break;
    case "payment.failed":
      if (order.paymentStatus !== "Paid" && order.paymentStatus !== "Refunded") {
        order.paymentStatus = "Failed";
        if (payment?.id) order.paymentId = payment.id;
      }
      break;
    case "refund.processed":
      if (Number(refund?.amount) >= Math.round(Number(order.total) * 100))
        order.paymentStatus = "Refunded";
      break;
    default:
      return ok(res, { received: true, processed: false }, "Webhook received.");
  }

  await order.save();
  return ok(res, { received: true, matched: true }, "Webhook processed.");
};
