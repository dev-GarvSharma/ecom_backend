import { Op } from "sequelize";
import { sequelize, User, Category, Product, ProductImage, Cart, CartItem, Order, OrderItem, Coupon, Notification, Address, Campaign, Setting } from "../database/models/index.js";
import { ok, fail } from "../utils/http.js";
import { clearCache } from "../middleware/cache.js";
const paging = (req) => {
  const page = Math.max(1, parseInt(req.query.page || "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(req.query.recordPerPage || "20", 10)));
  return { page, limit, offset: (page - 1) * limit };
};
const clean = (body) => {
  const values = { ...body };
  for (const key of ["id", "createdAt", "updatedAt", "password", "passwordHash", "refreshTokenHash"]) delete values[key];
  return values;
};
const uploadedImagePaths = (req) =>
  Object.values(req.files || {}).flat().map((file) => `/uploads/${file.filename}`);
const submittedImagePaths = (values) => {
  const paths = [];
  for (const value of [values.image, values.images]) {
    if (Array.isArray(value)) paths.push(...value);
    else if (typeof value === "string" && value.trim()) {
      try {
        const parsed = JSON.parse(value);
        paths.push(...(Array.isArray(parsed) ? parsed : [value]));
      } catch {
        paths.push(value);
      }
    }
  }
  return [...new Set(paths.filter((path) => typeof path === "string" && path.trim()))];
};
const hasInlineImage = (values) =>
  [values.image, ...(Array.isArray(values.images) ? values.images : [values.images])]
    .some((value) => typeof value === "string" && value.startsWith("data:"));
const map = { products: Product, inventory: Product, categories: Category, orders: Order, customers: User, coupons: Coupon, campaigns: Campaign };


export const adminList = async (req, res) => {
  const resource = req.params.resource,
    M = map[resource];
  if (!M) return fail(res, 404, "Resource not found.");
  const { page, limit, offset } = paging(req);
  let where = resource === "customers" ? { role: "user" } : {};
  const inc = ["products", "inventory"].includes(resource)
    ? [
        { model: Category, as: "category" },
        { model: ProductImage, as: "images", attributes: ["id", "path"] },
      ]
    : resource === "orders"
      ? [
          { model: User, as: "customer", attributes: ["name", "email"] },
          { model: OrderItem, as: "items" },
        ]
      : [];
  const { rows, count } = await M.findAndCountAll({
    where,
    include: inc,
    limit,
    offset,
    order: [["createdAt", "DESC"]],
    distinct: true,
  });
  let data = rows;
  if (resource === "customers")
    data = rows.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      location: u.location || "",
      orders: 0,
      spent: 0,
      joined: u.createdAt,
      segment: "New",
      status: u.status,
    }));
  if (resource === "products" || resource === "inventory") {
    data = rows.map((p) => ({
      id: p.id,
      sku: p.sku,
      quantity: String(p.stock),
      price: String(p.mrp),
      selling_price: String(p.price),
      show_on_shop: p.showOnShop,
      category: p.category?.name || "",
      ConsumableProductsModel: {
        id: p.id,
        name: p.name,
        sku: p.sku,
        mrp: String(p.mrp),
        selling_price: String(p.price),
        slug: p.slug,
        Weight: { quantity: p.weight },
        ConsumableProductsModelImages: (p.images || []).map((image) => ({ url: image.path })),
      },
    }));
    if (resource === "products") {
      const grouped = new Map();
      for (const item of data) {
        const name = item.category || "Uncategorized";
        if (!grouped.has(name))
          grouped.set(name, { id: item.categoryId, name, products: [] });
        grouped.get(name).products.push(item);
      }
      data = [...grouped.values()];
    }
  }
  if (resource === "orders")
    data = rows.map((o) => ({
      id: o.orderNumber,
      uuid: o.id,
      customer: o.customer?.name || "",
      email: o.customer?.email || "",
      date: o.createdAt,
      items: o.items?.reduce((s, i) => s + i.quantity, 0) || 0,
      total: Number(o.total),
      status: o.status,
      payment: o.paymentStatus,
      method: o.paymentMethod,
      paymentId: o.paymentId,
    }));
  let summary;
  if (resource === "orders") {
    const [totalOrders, toFulfill, shipped, revenue] = await Promise.all([
      Order.count(),
      Order.count({ where: { status: { [Op.in]: ["Pending", "Processing"] } } }),
      Order.count({ where: { status: "Shipped" } }),
      Order.sum("total", { where: { paymentStatus: "Paid" } }),
    ]);
    summary = {
      totalOrders,
      toFulfill,
      shipped,
      revenue: Number(revenue || 0),
    };
  }
  return ok(res, data, "Records loaded.", {
    totalRecords: count,
    totalPages: Math.ceil(count / limit),
    currentPage: page,
    ...(summary ? { summary } : {}),
  });
};

export const adminDetail = async (req, res) => {
  const resource = req.params.resource,
    M = map[resource];
  if (!M) return fail(res, 404, "Resource not found.");
  const include =
    resource === "products"
      ? [
          { model: Category, as: "category" },
          { model: ProductImage, as: "images", attributes: ["id", "path"] },
        ]
      : resource === "orders"
        ? [{ model: OrderItem, as: "items" }]
        : [];
  const row =
    resource === "orders"
      ? await Order.findOne({
          where: {
            [Op.or]: [{ id: req.params.id }, { orderNumber: req.params.id }],
          },
          include,
        })
      : await M.findByPk(req.params.id, { include });
  if (!row) return fail(res, 404, "Record not found.");
  if (resource === "products") {
    const p = row.toJSON();
    return ok(
      res,
      {
        id: p.id,
        sku: p.sku,
        quantity: String(p.stock),
        price: String(p.mrp),
        selling_price: String(p.price),
        show_on_shop: p.showOnShop,
        ConsumableProductsModel: {
          id: p.id,
          name: p.name,
          sku: p.sku,
          mrp: String(p.mrp),
          selling_price: String(p.price),
          slug: p.slug,
          Weight: { quantity: p.weight },
          ConsumableProductsModelImages: (p.images || []).map((image) => ({
            url: image.path,
          })),
        },
      },
      "Record loaded.",
    );
  }
  if (resource === "customers") {
    const [totalOrders, lifetimeSpend] = await Promise.all([
      Order.count({ where: { userId: row.id } }),
      Order.sum("total", {
        where: {
          userId: row.id,
          status: { [Op.ne]: "Cancelled" },
          paymentStatus: { [Op.notIn]: ["Failed", "Refunded"] },
        },
      }),
    ]);
    return ok(
      res,
      {
        ...row.toJSON(),
        totalOrders,
        lifetimeSpend: Number(lifetimeSpend || 0),
      },
      "Record loaded.",
    );
  }
  return ok(res, row, "Record loaded.");
};

export const adminCreate = async (req, res) => {
  const resource = req.params.resource,
    M = map[resource];
  if (!M || ["orders", "customers"].includes(resource))
    return fail(res, 400, "Cannot create this resource.");
  try {
    let values = clean(req.body);
    if (resource === "categories") {
      if (typeof values.image === "string" && values.image.startsWith("data:"))
        return fail(res, 400, "Upload the category image as a multipart file in the image field.");
      if (req.files?.image?.[0]) values.image = `/uploads/${req.files.image[0].filename}`;
      values.metaTitle = values.meta_title;
      values.metaDescription = values.meta_description;
      values.robotsMetaTag = values.robots_meta_tag;
      values.showOnHomePage = values.show_on_home_page;
      for (const k of [
        "meta_title",
        "meta_description",
        "robots_meta_tag",
        "show_on_home_page",
      ])
        delete values[k];
    }
    if (resource === "products") {
      if (hasInlineImage(values))
        return fail(res, 400, "Upload product images as multipart files in the image or images field.");
      const paths = [...new Set([...submittedImagePaths(values), ...uploadedImagePaths(req)])];
      const category = await Category.findOne({
        where: { name: values.category },
      });
      if (!category)
        return fail(res, 400, "Select an existing product category.");
      values.categoryId = category.id;
      values.mrp = values.mrp ?? values.price;
      for (const k of ["category", "image", "images"]) delete values[k];
      if (["Out of stock", "Low stock", "In stock"].includes(values.status))
        values.status = "active";
    }
    const row = await M.create(values);
    if (resource === "products") {
      if (paths.length)
        await ProductImage.bulkCreate(paths.map((path) => ({ productId: row.id, path })));
      await row.reload({ include: [{ model: ProductImage, as: "images" }] });
    }
    await clearCache();
    return ok(res, row, "Record created.", null, 201);
  } catch (e) {
    if (e.name === "SequelizeUniqueConstraintError")
      return fail(res, 409, "Record already exists.");
    throw e;
  }
};

export const adminUpdate = async (req, res) => {
  const resource = req.params.resource,
    M = map[resource];
  if (!M) return fail(res, 404, "Resource not found.");
  const row =
    resource === "orders"
      ? await Order.findOne({
          where: {
            [Op.or]: [{ id: req.params.id }, { orderNumber: req.params.id }],
          },
        })
      : await M.findByPk(req.params.id);
  if (!row) return fail(res, 404, "Record not found.");
  let values = clean(req.body);
  let submittedPaths = [];
  let uploadedPaths = [];
  if (resource === "categories") {
    if (typeof values.image === "string" && values.image.startsWith("data:"))
      return fail(res, 400, "Upload the category image as a multipart file in the image field.");
    if (req.files?.image?.[0]) values.image = `/uploads/${req.files.image[0].filename}`;
    values.metaTitle = values.meta_title;
    values.metaDescription = values.meta_description;
    values.robotsMetaTag = values.robots_meta_tag;
    values.showOnHomePage = values.show_on_home_page;
    for (const k of [
      "meta_title",
      "meta_description",
      "robots_meta_tag",
      "show_on_home_page",
    ])
      delete values[k];
  }
  if (resource === "products") {
    if (hasInlineImage(values))
      return fail(res, 400, "Upload product images as multipart files in the image or images field.");
    submittedPaths = submittedImagePaths(values);
    uploadedPaths = uploadedImagePaths(req);
    if (values.category) {
      const cat = await Category.findOne({ where: { name: values.category } });
      if (!cat) return fail(res, 400, "Select an existing product category.");
      values.categoryId = cat.id;
    }
    values.mrp = values.mrp ?? values.price;
    for (const k of ["category", "image", "images"]) delete values[k];
    if (["Out of stock", "Low stock", "In stock"].includes(values.status))
      delete values.status;
  }
  if (resource === "customers") delete values.role;
  if (
    resource === "orders" &&
    !Object.keys(values).every((k) => k === "status")
  )
    return fail(res, 400, "Only order status can be updated.");
  await row.update(values);
  if (resource === "products") {
    if (submittedPaths.length) await ProductImage.destroy({ where: { productId: row.id } });
    const paths = [...new Set([...submittedPaths, ...uploadedPaths])];
    if (paths.length)
      await ProductImage.bulkCreate(paths.map((path) => ({ productId: row.id, path })));
    await row.reload({ include: [{ model: ProductImage, as: "images" }] });
  }
  await clearCache();
  return ok(res, row, "Record updated.");
};

export const adminDelete = async (req, res) => {
  const M = map[req.params.resource];
  if (!M) return fail(res, 404, "Resource not found.");
  const row = await M.findByPk(req.params.id);
  if (!row) return fail(res, 404, "Record not found.");
  if (req.params.resource === "products")
    await row.update({ status: "archived", showOnShop: false });
  else if (req.params.resource === "customers")
    await row.update({ status: "suspended", refreshTokenHash: null });
  else await row.destroy();
  await clearCache();
  return ok(res, null, "Record removed.");
};

export const visibility = async (req, res) => {
  if (
    !Array.isArray(req.body.productIds) ||
    typeof req.body.showOnShop !== "boolean"
  )
    return fail(res, 400, "Product IDs and visibility required.");
  await Product.update(
    { showOnShop: req.body.showOnShop },
    { where: { id: { [Op.in]: req.body.productIds } } },
  );
  await clearCache();
  return ok(res, null, "Visibility updated.");
};

export const stock = async (req, res) => {
  const q = Number(req.body.quantity);
  if (!Number.isInteger(q) || q < 0)
    return fail(res, 400, "Quantity must be non-negative integer.");
  const p = await Product.findByPk(req.params.id);
  if (!p) return fail(res, 404, "Product not found.");
  await p.update({ stock: q });
  return ok(res, p, "Inventory updated.");
};
