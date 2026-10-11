import bcrypt from "bcryptjs";
import {
  Address,
  Campaign,
  Cart,
  CartItem,
  Category,
  Coupon,
  Notification,
  Order,
  OrderItem,
  Product,
  Setting,
  User,
} from "../models/index.js";

const seedUser = async (values) => {
  const [user] = await User.unscoped().findOrCreate({
    where: { email: values.email },
    defaults: values,
  });
  await user.update(values);
  return user;
};

const seedBy = async (Model, key, values) => {
  const [record] = await Model.findOrCreate({
    where: { [key]: values[key] },
    defaults: values,
  });
  await record.update(values);
  return record;
};

export const seedDatabase = async () => {
  if (process.env.NODE_ENV === "production")
    throw new Error("Development seed data is disabled in production.");

  const adminPasswordHash = await bcrypt.hash("Admin@123", 12);
  const admin = await seedUser({
    name: "Test Admin",
    email: "admin@gmail.com",
    passwordHash: adminPasswordHash,
    role: "admin",
    status: "active",
    phone: "+919900000000",
    location: "Mumbai",
  });

  const categories = [];
  for (let index = 1; index <= 12; index++) {
    categories.push(
      await seedBy(Category, "slug", {
        name: `Test Category ${String(index).padStart(2, "0")}`,
        slug: `test-category-${String(index).padStart(2, "0")}`,
        description: `Seed category ${index} for catalog and pagination testing.`,
        priority: 13 - index,
        showOnHomePage: index <= 6,
        active: true,
        metaTitle: `Test Category ${index}`,
        metaDescription: `Development seed category ${index}.`,
        robotsMetaTag: "index,follow",
      }),
    );
  }

  const products = [];
  for (let index = 1; index <= 30; index++) {
    const serial = String(index).padStart(3, "0");
    products.push(
      await seedBy(Product, "sku", {
        categoryId: categories[(index - 1) % categories.length].id,
        name: `Test Product ${serial}`,
        slug: `test-product-${serial}`,
        sku: `TEST-SKU-${serial}`,
        description: `Development seed product ${index} for catalog and order testing.`,
        price: 199 + index * 25,
        mrp: 249 + index * 25,
        stock: 100 + index,
        weight: `${100 + index * 10} g`,
        showOnShop: true,
        status: "active",
      }),
    );
  }

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

  const users = [];
  const userPasswordHash = await bcrypt.hash("TestUser@123", 12);
  for (let index = 1; index <= 15; index++) {
    const serial = String(index).padStart(2, "0");
    users.push(
      await seedUser({
        name: `Test Customer ${serial}`,
        email: `customer${serial}@example.com`,
        passwordHash: userPasswordHash,
        role: "user",
        status: "active",
        phone: `+91990000${String(index).padStart(4, "0")}`,
        location: ["Mumbai", "Delhi", "Bengaluru", "Pune", "Jaipur"][
          (index - 1) % 5
        ],
      }),
    );
  }

  const seededOrders = [];
  const orderStatuses = ["Delivered", "Processing", "Pending", "Cancelled"];
  const paymentStatuses = ["Paid", "Pending", "Failed", "Refunded"];
  const paymentMethods = ["COD", "UPI", "CARD", "CARD"];
  for (let index = 1; index <= 30; index++) {
    const serial = String(index).padStart(3, "0");
    const user = users[(index - 1) % users.length];
    const selectedProducts = [
      products[(index - 1) % products.length],
      products[(index + 6) % products.length],
    ];
    const subtotal = selectedProducts.reduce(
      (sum, product) => sum + Number(product.price),
      0,
    );
    const statusIndex = (index - 1) % orderStatuses.length;
    const orderValues = {
      orderNumber: `SEED-ORD-${serial}`,
      userId: user.id,
      status: orderStatuses[statusIndex],
      paymentStatus: paymentStatuses[statusIndex],
      paymentMethod: paymentMethods[statusIndex],
      currency: "INR",
      subtotal,
      discount: statusIndex === 0 ? 100 : 0,
      shipping: subtotal >= 2999 ? 0 : 99,
      total: subtotal - (statusIndex === 0 ? 100 : 0) + (subtotal >= 2999 ? 0 : 99),
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
    };
    const order = await seedBy(Order, "orderNumber", orderValues);
    seededOrders.push(order);
    await OrderItem.destroy({ where: { orderId: order.id } });
    await OrderItem.bulkCreate(
      selectedProducts.map((product) => ({
        orderId: order.id,
        productId: product.id,
        name: product.name,
        sku: product.sku,
        quantity: 1,
        unitPrice: product.price,
      })),
    );
  }

  for (let index = 0; index < users.length; index++) {
    const user = users[index];
    const addressValues = {
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
    };
    await seedBy(Address, "userId", addressValues);

    const [cart] = await Cart.findOrCreate({
      where: { userId: user.id },
      defaults: { userId: user.id },
    });
    for (let itemIndex = 0; itemIndex < 2; itemIndex++) {
      const product = products[(index * 2 + itemIndex) % products.length];
      const [cartItem] = await CartItem.findOrCreate({
        where: { cartId: cart.id, productId: product.id },
        defaults: { cartId: cart.id, productId: product.id, quantity: itemIndex + 1 },
      });
      if (cartItem.quantity !== itemIndex + 1)
        await cartItem.update({ quantity: itemIndex + 1 });
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
      payload: { seed: true, orderNumber: seededOrders[(index - 1) % seededOrders.length].orderNumber },
    };
    const existing = await Notification.findOne({
      where: { userId: values.userId, title: values.title },
    });
    if (existing) await existing.update(values);
    else await Notification.create(values);
  }

  const campaignStatuses = ["Draft", "Scheduled", "Active", "Sent", "Paused"];
  for (let index = 1; index <= 12; index++) {
    await seedBy(Campaign, "name", {
      name: `Test Campaign ${String(index).padStart(2, "0")}`,
      channel: index % 2 ? "Email campaign" : "SMS campaign",
      audience: index % 2 ? "All customers" : "Recent customers",
      status: campaignStatuses[(index - 1) % campaignStatuses.length],
      scheduledAt: new Date(Date.now() + index * 86400000),
      content: `Development campaign fixture ${index}.`,
    });
  }

  for (const [key, value] of [
    ["store_name", "Ecom Test Store"],
    ["support_email", "support@example.com"],
    ["currency", "INR"],
  ]) {
    const [setting] = await Setting.findOrCreate({ where: { key }, defaults: { key, value } });
    await setting.update({ value });
  }

  return {
    admin: admin.email,
    categories: categories.length,
    products: products.length,
    coupons: coupons.length,
    users: users.length,
    orders: seededOrders.length,
    notifications: 30,
    campaigns: 12,
  };
};
