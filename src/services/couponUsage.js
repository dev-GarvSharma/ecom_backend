import { Coupon, Order } from "../database/models/index.js";

// Caller must pass an order locked in the same transaction. This makes duplicate
// payment verification and webhook delivery safe to retry.
export const consumeOrderCoupon = async (order, transaction) => {
  if (!order.couponCode || order.couponConsumed) return false;

  const coupon = await Coupon.findOne({
    where: { code: order.couponCode },
    transaction,
    lock: transaction.LOCK.UPDATE,
  });
  if (coupon) {
    coupon.usedCount = Number(coupon.usedCount || 0) + 1;
    await coupon.save({ transaction });
  }

  order.couponConsumed = true;
  await order.save({ transaction });
  return true;
};

export const releaseCodOrderCoupon = async (order, transaction) => {
  if (
    order.paymentMethod !== "COD" ||
    !order.couponCode ||
    !order.couponConsumed
  )
    return false;

  const coupon = await Coupon.findOne({
    where: { code: order.couponCode },
    transaction,
    lock: transaction.LOCK.UPDATE,
  });
  if (coupon) {
    coupon.usedCount = Math.max(0, Number(coupon.usedCount || 0) - 1);
    await coupon.save({ transaction });
  }

  order.couponConsumed = false;
  await order.save({ transaction });
  return true;
};

export const countUserCouponUses = (userId, couponCode, transaction) =>
  Order.count({
    where: { userId, couponCode, couponConsumed: true },
    transaction,
  });
