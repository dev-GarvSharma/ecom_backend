import { Op } from "sequelize";
import { sequelize, User, Category, Product, Cart, CartItem, Order, OrderItem, Coupon, Notification, Address, Campaign, Setting } from "../database/models/index.js";
import { ok, fail } from "../utils/http.js";
import { clearCache } from "../middleware/cache.js";


export const addresses = async (req, res) =>
  ok(
    res,
    await Address.findAll({ where: { userId: req.user.id } }),
    "Addresses loaded.",
  );

export const addressAdd = async (req, res) =>
  ok(
    res,
    await Address.create({ ...clean(req.body), userId: req.user.id }),
    "Address saved.",
    null,
    201,
  );
