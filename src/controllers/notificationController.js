import { Op } from "sequelize";
import { sequelize, User, Category, Product, Cart, CartItem, Order, OrderItem, Coupon, Notification, Address, Campaign, Setting } from "../database/models/index.js";
import { ok, fail } from "../utils/http.js";
import { clearCache } from "../middleware/cache.js";


export const myNotifications = async (req, res) =>
  ok(
    res,
    await Notification.findAll({
      where: { userId: req.user.id },
      order: [["createdAt", "DESC"]],
      limit: 100,
    }),
    "Notifications loaded.",
  );

export const notificationRead = async (req, res) => {
  const [n] = await Notification.update(
    { read: true },
    { where: { id: req.params.id, userId: req.user.id } },
  );
  return n
    ? ok(res, null, "Marked read.")
    : fail(res, 404, "Notification not found.");
};

export const notificationsAdmin = async (_q, res) =>
  ok(
    res,
    await Notification.findAll({ order: [["createdAt", "DESC"]], limit: 100 }),
    "Notifications loaded.",
  );

export const readAll = async (req, res) => {
  const ids = req.body.notificationIds || [];
  await Notification.update(
    { read: true },
    { where: ids.length ? { id: { [Op.in]: ids } } : {} },
  );
  return ok(res, null, "Notifications marked read.");
};
