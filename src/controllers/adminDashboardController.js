import { Op } from "sequelize";
import { sequelize, User, Category, Product, Cart, CartItem, Order, OrderItem, Coupon, Notification, Address, Campaign, Setting } from "../database/models/index.js";
import { adminList } from "./adminResourceController.js";
import { ok, fail } from "../utils/http.js";
import { clearCache } from "../middleware/cache.js";


export const settings = async (req, res) => {
  if (req.method === "GET") {
    const rows = await Setting.findAll();
    return ok(
      res,
      Object.fromEntries(rows.map((x) => [x.key, x.value])),
      "Settings loaded.",
    );
  }
  for (const [key, value] of Object.entries(clean(req.body)))
    await Setting.upsert({ key, value });
  return ok(res, req.body, "Settings saved.");
};

export const dashboard = async (_req, res) => {
  const now = new Date();
  const thisWeekStart = new Date(now);
  thisWeekStart.setUTCHours(0, 0, 0, 0);
  const weekday = (thisWeekStart.getUTCDay() + 6) % 7;
  thisWeekStart.setUTCDate(thisWeekStart.getUTCDate() - weekday);
  const elapsedThisWeek = now.getTime() - thisWeekStart.getTime();
  const lastWeekStart = new Date(thisWeekStart);
  lastWeekStart.setUTCDate(lastWeekStart.getUTCDate() - 7);
  const lastWeekEnd = new Date(lastWeekStart.getTime() + elapsedThisWeek);

  const loadWeek = async (start, end) => {
    const orders = await Order.findAll({
      where: { createdAt: { [Op.gte]: start, [Op.lt]: end } },
      attributes: ["id", "userId", "total", "paymentStatus", "status", "createdAt", "updatedAt"],
      raw: true,
    });
    const paidOrders = orders.filter((order) => order.paymentStatus === "Paid");
    const items = paidOrders.length
      ? await OrderItem.findAll({
          where: { orderId: { [Op.in]: paidOrders.map((order) => order.id) } },
          attributes: ["orderId", "productId", "name", "sku", "quantity", "unitPrice"],
          raw: true,
        })
      : [];
    return {
      orders,
      paidOrders,
      items,
      sales: paidOrders.reduce((sum, order) => sum + Number(order.total || 0), 0),
      productsSold: items.reduce((sum, item) => sum + Number(item.quantity || 0), 0),
    };
  };

  const [thisWeek, lastWeek, recentOrders, lowStockProducts, pendingCount, processingCount, deliveredOrders, customerCount, totalProducts, totalOrders, lifetimeSales, priorOrderRows] = await Promise.all([
    loadWeek(thisWeekStart, now),
    loadWeek(lastWeekStart, lastWeekEnd),
    Order.findAll({
      limit: 5,
      order: [["createdAt", "DESC"]],
      include: [
        { model: User, as: "customer", attributes: ["id", "name", "email"] },
        { model: OrderItem, as: "items", attributes: ["name", "sku", "quantity", "unitPrice"] },
      ],
    }),
    Product.findAll({
      where: { status: "active", stock: { [Op.lte]: 10 } },
      attributes: ["id", "name", "sku", "stock"],
      order: [["stock", "ASC"]],
      limit: 10,
    }),
    Order.count({ where: { status: "Pending" } }),
    Order.count({ where: { status: "Processing" } }),
    Order.findAll({
      where: { status: "Delivered" },
      attributes: ["createdAt", "updatedAt"],
      raw: true,
    }),
    User.count({ where: { role: "user" } }),
    Product.count(),
    Order.count(),
    Order.sum("total", { where: { paymentStatus: "Paid" } }),
    Order.findAll({
      where: { createdAt: { [Op.lt]: lastWeekStart } },
      attributes: ["userId"],
      group: ["userId"],
      raw: true,
    }),
  ]);

  const percentChange = (current, previous) =>
    previous ? Number((((current - previous) / previous) * 100).toFixed(1)) : current ? 100 : 0;
  const currentWeekCustomers = await User.count({
    where: { role: "user", createdAt: { [Op.gte]: thisWeekStart, [Op.lt]: now } },
  });
  const lastWeekCustomers = await User.count({
    where: { role: "user", createdAt: { [Op.gte]: lastWeekStart, [Op.lt]: lastWeekEnd } },
  });

  const dailySales = (week, start) =>
    Array.from({ length: 7 }, (_, index) => {
      const date = new Date(start);
      date.setUTCDate(date.getUTCDate() + index);
      const key = date.toISOString().slice(0, 10);
      const revenue = week.paidOrders
        .filter((order) => new Date(order.createdAt).toISOString().slice(0, 10) === key)
        .reduce((sum, order) => sum + Number(order.total || 0), 0);
      return { date: key, day: date.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" }), revenue };
    });

  const topProductsMap = new Map();
  for (const item of thisWeek.items) {
    const key = item.productId || `${item.sku || ""}:${item.name}`;
    const product = topProductsMap.get(key) || {
      productId: item.productId,
      name: item.name,
      sku: item.sku,
      quantity: 0,
      revenue: 0,
    };
    const quantity = Number(item.quantity || 0);
    product.quantity += quantity;
    product.revenue += quantity * Number(item.unitPrice || 0);
    topProductsMap.set(key, product);
  }
  const topProducts = [...topProductsMap.values()]
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 5);

  const fulfilledDurations = deliveredOrders
    .map((order) => (new Date(order.updatedAt) - new Date(order.createdAt)) / 86400000)
    .filter((duration) => Number.isFinite(duration) && duration >= 0);
  const averageFulfillmentDays = fulfilledDurations.length
    ? Number((fulfilledDurations.reduce((sum, duration) => sum + duration, 0) / fulfilledDurations.length).toFixed(1))
    : null;

  const customersWithPriorOrders = new Set(
    priorOrderRows.map((order) => order.userId).filter(Boolean),
  );
  const customersWithOrdersBeforeThisWeek = new Set([
    ...customersWithPriorOrders,
    ...lastWeek.orders.map((order) => order.userId).filter(Boolean),
  ]);
  const currentRepeatOrders = thisWeek.orders.filter((order) =>
    customersWithOrdersBeforeThisWeek.has(order.userId),
  ).length;
  const previousRepeatOrders = lastWeek.orders.filter((order) =>
    customersWithPriorOrders.has(order.userId),
  ).length;
  const repeatPurchaseChange = percentChange(currentRepeatOrders, previousRepeatOrders);

  const recent = recentOrders.map((order) => ({
    id: order.orderNumber || order.id,
    uuid: order.id,
    customer: order.customer?.name || "Guest customer",
    email: order.customer?.email || "",
    date: order.createdAt,
    items: order.items?.reduce((sum, item) => sum + Number(item.quantity || 0), 0) || 0,
    total: Number(order.total),
    status: order.status,
    payment: order.paymentStatus,
  }));

  return ok(
    res,
    {
      sales: {
        total: Number(lifetimeSales || 0),
        thisWeek: thisWeek.sales,
        lastWeek: lastWeek.sales,
        changePercent: percentChange(thisWeek.sales, lastWeek.sales),
      },
      orders: recent,
      recentOrders: recent,
      products: topProducts,
      topProducts,
      salesOverview: {
        thisWeek: dailySales(thisWeek, thisWeekStart),
        lastWeek: dailySales(lastWeek, lastWeekStart),
      },
      storeInsights: {
        repeatPurchases: {
          thisWeek: currentRepeatOrders,
          lastWeek: previousRepeatOrders,
          changePercent: repeatPurchaseChange,
          message:
            repeatPurchaseChange >= 0
              ? `Returning customers placed ${repeatPurchaseChange}% more orders this week.`
              : `Returning customers placed ${Math.abs(repeatPurchaseChange)}% fewer orders this week.`,
        },
        restocking: {
          count: lowStockProducts.length,
          products: lowStockProducts,
          stockThreshold: 10,
        },
        cartConversion: {
          available: false,
          message: "Checkout funnel events are not currently tracked.",
        },
      },
      fulfillment: {
        unfulfilledOrders: pendingCount,
        readyToShip: processingCount,
        averageFulfillmentDays,
        fulfillmentTimeIsEstimated: averageFulfillmentDays !== null,
      },
      metrics: {
        products: totalProducts,
        customers: customerCount,
        orders: totalOrders,
        grossSales: {
          value: thisWeek.sales,
          changePercent: percentChange(thisWeek.sales, lastWeek.sales),
        },
        weeklyOrders: {
          value: thisWeek.orders.length,
          changePercent: percentChange(thisWeek.orders.length, lastWeek.orders.length),
        },
        newCustomers: {
          value: currentWeekCustomers,
          changePercent: percentChange(currentWeekCustomers, lastWeekCustomers),
        },
        productsSold: {
          value: thisWeek.productsSold,
          changePercent: percentChange(thisWeek.productsSold, lastWeek.productsSold),
        },
      },
      cards: {
        grossSales: {
          value: thisWeek.sales,
          changePercent: percentChange(thisWeek.sales, lastWeek.sales),
        },
        orders: {
          value: thisWeek.orders.length,
          changePercent: percentChange(thisWeek.orders.length, lastWeek.orders.length),
        },
        customers: {
          value: customerCount,
          changePercent: percentChange(currentWeekCustomers, Math.max(0, customerCount - currentWeekCustomers)),
          newThisWeek: currentWeekCustomers,
        },
        productsSold: {
          value: thisWeek.productsSold,
          changePercent: percentChange(thisWeek.productsSold, lastWeek.productsSold),
        },
      },
    },
    "Dashboard loaded.",
  );
};

export const analytics = async (req, res) => {
  const period = ["7d", "30d", "90d"].includes(req.query.period)
    ? req.query.period
    : "30d";
  const days = Number.parseInt(period, 10);
  const now = new Date();
  const currentStart = new Date(now);
  currentStart.setUTCHours(0, 0, 0, 0);
  currentStart.setUTCDate(currentStart.getUTCDate() - days + 1);
  const previousStart = new Date(currentStart);
  previousStart.setUTCDate(previousStart.getUTCDate() - days);

  const loadPeriod = async (start, end, withBreakdown = false) => {
    const orders = await Order.findAll({
      where: { createdAt: { [Op.gte]: start, [Op.lt]: end } },
      attributes: ["id", "total", "paymentStatus", "createdAt"],
      raw: true,
    });
    const paidOrders = orders.filter((order) => order.paymentStatus === "Paid");
    const paidOrderIds = paidOrders.map((order) => order.id);
    const items = paidOrderIds.length
      ? await OrderItem.findAll({
          where: { orderId: { [Op.in]: paidOrderIds } },
          attributes: ["orderId", "productId", "name", "sku", "quantity", "unitPrice"],
          raw: true,
        })
      : [];
    const revenue = paidOrders.reduce((sum, order) => sum + Number(order.total || 0), 0);
    const itemsSold = items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
    const result = {
      orders: orders.length,
      paidOrders: paidOrders.length,
      revenue,
      averageOrderValue: paidOrders.length ? revenue / paidOrders.length : 0,
      itemsSold,
    };

    if (!withBreakdown) return result;

    const dailyRevenue = new Map();
    for (let day = new Date(start); day < end; day.setUTCDate(day.getUTCDate() + 1)) {
      dailyRevenue.set(day.toISOString().slice(0, 10), 0);
    }
    for (const order of paidOrders) {
      const date = new Date(order.createdAt).toISOString().slice(0, 10);
      dailyRevenue.set(date, (dailyRevenue.get(date) || 0) + Number(order.total || 0));
    }

    const products = new Map();
    for (const item of items) {
      const key = item.productId || `${item.sku || ""}:${item.name}`;
      const product = products.get(key) || {
        productId: item.productId,
        name: item.name,
        sku: item.sku,
        quantity: 0,
        revenue: 0,
      };
      const quantity = Number(item.quantity || 0);
      product.quantity += quantity;
      product.revenue += quantity * Number(item.unitPrice || 0);
      products.set(key, product);
    }

    return {
      ...result,
      salesOverTime: [...dailyRevenue].map(([date, amount]) => ({ date, revenue: amount })),
      salesByChannel: [
        { channel: "Online store", orders: paidOrders.length, revenue },
        { channel: "Social commerce", orders: 0, revenue: 0 },
        { channel: "Direct", orders: 0, revenue: 0 },
      ],
      topProducts: [...products.values()]
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, 10),
    };
  };

  const [current, previous] = await Promise.all([
    loadPeriod(currentStart, now, true),
    loadPeriod(previousStart, currentStart),
  ]);
  const changePercent = (value, previousValue) =>
    previousValue ? Number((((value - previousValue) / previousValue) * 100).toFixed(1)) : value ? 100 : 0;

  return ok(
    res,
    {
      period,
      metrics: {
        totalSales: { value: current.revenue, changePercent: changePercent(current.revenue, previous.revenue) },
        orders: { value: current.orders, changePercent: changePercent(current.orders, previous.orders) },
        averageOrderValue: {
          value: current.averageOrderValue,
          changePercent: changePercent(current.averageOrderValue, previous.averageOrderValue),
        },
        itemsSold: { value: current.itemsSold, changePercent: changePercent(current.itemsSold, previous.itemsSold) },
      },
      salesOverTime: current.salesOverTime,
      salesByChannel: current.salesByChannel,
      topProducts: current.topProducts,
      // Keep these fields for clients using the earlier analytics response.
      orders: current.orders,
      revenue: current.revenue,
    },
    "Analytics loaded.",
  );
};

export const marketing = async (_q, res) =>
  ok(
    res,
    {
      subscribers: await User.count({
        where: { role: "user", status: "active" },
      }),
      revenue: Number(
        (await Order.sum("total", { where: { paymentStatus: "Paid" } })) || 0,
      ),
      campaigns: await Campaign.count(),
    },
    "Marketing loaded.",
  );

export const campaignList = async (req, res) => {
  req.params.resource = "campaigns";
  return adminList(req, res);
};

export const exportData = async (req, res) => {
  req.params.resource = req.params.resource || "products";
  return adminList(req, res);
};
