import { Op } from "sequelize";
import { sequelize, User, Category, Product, Cart, CartItem, Order, OrderItem, Coupon, Notification, Address, Campaign, Setting } from "../database/models/index.js";
import { ok, fail } from "../utils/http.js";
import { clearCache } from "../middleware/cache.js";


export const validateCoupon = async (req, res) => {
  const c = await Coupon.findOne({
    where: { code: String(req.body.code || "").toUpperCase(), active: true },
  });
  return c
    ? ok(
        res,
        { code: c.code, type: c.type, value: c.value, minOrder: c.minOrder },
        "Coupon found; checkout checks eligibility.",
      )
    : fail(res, 404, "Coupon not found.");
};
