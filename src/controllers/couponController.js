import { Cart, CartItem, Coupon, ProductVariant } from "../database/models/index.js";
import { ok, fail } from "../utils/http.js";
import { countUserCouponUses } from "../services/couponUsage.js";

export const validateCoupon = async (req, res) => {
  const code = String(req.body.code || "").trim().toUpperCase();
  if (!code) return fail(res, 400, "Enter a coupon code.");

  const coupon = await Coupon.findOne({ where: { code, active: true } });
  if (!coupon) return fail(res, 404, "Coupon not found.");

  const now = new Date();
  if (
    (coupon.startsAt && coupon.startsAt > now) ||
    (coupon.expiresAt && coupon.expiresAt < now)
  ) return fail(res, 400, "This coupon is not currently available.");

  if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit)
    return fail(res, 400, "This coupon has reached its usage limit.");

  if (coupon.perUserLimit) {
    const previousUses = await countUserCouponUses(req.user.id, coupon.code);
    if (previousUses >= coupon.perUserLimit)
      return fail(res, 400, "You have already used this coupon.");
  }

  const cart = await Cart.findOne({ where: { userId: req.user.id } });
  const items = cart
    ? await CartItem.findAll({
        where: { cartId: cart.id },
        attributes: ["quantity", "isPromotional"],
        include: [{ model: ProductVariant, as: "variant", attributes: ["price"] }],
      })
    : [];
  const subtotal = items.reduce(
    (sum, item) => sum + (item.isPromotional ? 0 : Number(item.variant?.price || 0) * item.quantity),
    0,
  );

  if (subtotal < Number(coupon.minOrder || 0))
    return fail(res, 400, `This coupon requires a minimum order of ₹${Number(coupon.minOrder).toLocaleString("en-IN")}.`);

  return ok(
    res,
    {
      code: coupon.code,
      type: coupon.type,
      value: coupon.value,
      minOrder: coupon.minOrder,
      maxDiscount: coupon.maxDiscount,
      eligible: true,
    },
    "Coupon is eligible for this order.",
  );
};
