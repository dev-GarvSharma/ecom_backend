import {
  Address,
  Campaign,
  Cart,
  CartItem,
  CartSession,
  Coupon,
  Notification,
  Order,
  OrderItem,
  ProductVariant,
  Promotion,
  Setting,
} from "../models/index.js";
import { seedBy } from "./helpers.js";

export const seedCommerce = async ({ users, products }) => {
  const coupons = [];
  for (let index = 1; index <= 12; index++) {
    const code = `TEST${String(index).padStart(2, "0")}`;
    coupons.push(
      await seedBy(Coupon, "code", {
        code,
        type: index % 2 ? "percentage" : "fixed",
        value: index % 2 ? 10 + (index % 4) * 5 : 100 + index * 10,
        minOrder: 500,
        maxDiscount: index % 2 ? 500 : null,
        usageLimit: 100,
        usedCount: 0,
        startsAt: new Date(Date.now() - 86400000),
        expiresAt: new Date(Date.now() + 365 * 86400000),
        active: true,
      }),
    );
  }
  const orderStatuses = ["Delivered", "Processing", "Pending", "Cancelled"];
  const paymentStatuses = ["Paid", "Pending", "Failed", "Refunded"];
  const paymentMethods = ["UPI", "UPI", "CARD", "CARD"];
  const orders = [];
  for (let index = 1; index <= 30; index++) {
    const serial = String(index).padStart(3, "0");
    const user = users[(index - 1) % users.length];
    const selected = [products[(index - 1) % products.length], products[index % products.length]];
    const subtotal = selected.reduce(
      (sum, product) => sum + Number(product.defaultVariant.price),
      0,
    );
    const statusIndex = (index - 1) % orderStatuses.length;
    const discount = statusIndex === 0 ? 100 : 0;
    const order = await seedBy(Order, "orderNumber", {
      orderNumber: `SEED-ORD-${serial}`,
      userId: user.id,
      status: orderStatuses[statusIndex],
      paymentStatus: paymentStatuses[statusIndex],
      paymentMethod: paymentMethods[statusIndex],
      paymentProvider: "razorpay",
      currency: "INR",
      subtotal,
      discount,
      shipping: subtotal - discount >= 2999 ? 0 : 99,
      total: subtotal - discount + (subtotal - discount >= 2999 ? 0 : 99),
      shippingAddress: {
        recipient: user.name,
        phone: user.phone,
        line1: `${index} Test Market Road`,
        city: user.location,
        state: "Maharashtra",
        postalCode: `400${String(index).padStart(3, "0")}`,
        country: "IN",
      },
      couponCode: statusIndex === 0 ? coupons[index % coupons.length].code : null,
    });
    orders.push(order);
    await OrderItem.destroy({ where: { orderId: order.id } });
    await OrderItem.bulkCreate(
      selected.map((product) => ({
        orderId: order.id,
        productId: product.id,
        variantId: product.defaultVariant.id,
        name: product.name,
        sku: product.defaultVariant.sku,
        variantOptions: product.defaultVariant.options,
        productSnapshot: { id: product.id, slug: product.slug },
        variantSnapshot: {
          id: product.defaultVariant.id,
          sku: product.defaultVariant.sku,
          options: product.defaultVariant.options,
        },
        quantity: 1,
        unitPrice: product.defaultVariant.price,
      })),
    );
  }
  const miniVariant = products.find(
    (product) => product.slug === "saffron-dusk-discovery-set",
  )?.defaultVariant;
  if (miniVariant)
    await seedBy(Promotion, "code", {
      code: "FREE-MINI",
      name: "Complimentary discovery set",
      type: "free_product",
      promotionalVariantId: miniVariant.id,
      minimumSubtotal: 3000,
      active: true,
    });

  for (let index = 0; index < users.length; index++) {
    const user = users[index];
    await seedBy(Address, "userId", {
      userId: user.id,
      recipient: user.name,
      phone: user.phone,
      line1: `${index + 1} Example Street`,
      line2: "Near Test Park",
      city: user.location,
      state: "Maharashtra",
      postalCode: `400${String(index + 1).padStart(3, "0")}`,
      country: "IN",
      isDefault: true,
    });
    const [cart] = await Cart.findOrCreate({
      where: { userId: user.id },
      defaults: { userId: user.id },
    });
    await CartSession.findOrCreate({
      where: { cartId: cart.id },
      defaults: { lastActivityAt: new Date() },
    });
    for (let itemIndex = 0; itemIndex < 2; itemIndex++) {
      const variant = products[(index + itemIndex) % products.length].defaultVariant;
      const [item] = await CartItem.findOrCreate({
        where: { cartId: cart.id, variantId: variant.id },
        defaults: { cartId: cart.id, variantId: variant.id, quantity: itemIndex + 1 },
      });
      if (item.quantity !== itemIndex + 1) await item.update({ quantity: itemIndex + 1 });
    }
  }
  for (let index = 1; index <= 30; index++) {
    const serial = String(index).padStart(3, "0");
    const user = users[(index - 1) % users.length];
    const values = {
      userId: user.id,
      title: `Test notification ${serial}`,
      detail: `Seed notification ${serial} for ${user.name}.`,
      type: ["order", "promotion", "info"][index % 3],
      read: index % 2 === 0,
      payload: { seed: true, orderNumber: orders[(index - 1) % orders.length].orderNumber },
    };
    const existing = await Notification.findOne({
      where: { userId: values.userId, title: values.title },
    });
    if (existing) await existing.update(values);
    else await Notification.create(values);
  }
  const statuses = ["Draft", "Scheduled", "Active", "Sent", "Paused"];
  for (let index = 1; index <= 12; index++)
    await seedBy(Campaign, "name", {
      name: `Test Campaign ${String(index).padStart(2, "0")}`,
      channel: index % 2 ? "email" : "sms",
      audience: index % 2 ? "All customers" : "Recent customers",
      status: statuses[(index - 1) % statuses.length],
      scheduledAt: new Date(Date.now() + index * 86400000),
      content: `Development campaign fixture ${index}.`,
    });
  for (const [key, value] of [
    ["store_name", "Perfume House"],
    ["support_email", "support@example.com"],
    ["currency", "INR"],
  ]) {
    const [setting] = await Setting.findOrCreate({ where: { key }, defaults: { key, value } });
    await setting.update({ value });
  }
  return { coupons: coupons.length, orders: orders.length, notifications: 30, campaigns: 12 };
};
