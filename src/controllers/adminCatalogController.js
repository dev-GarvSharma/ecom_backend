import { Op } from "sequelize";
import {
  Category,
  Product,
  ProductImage,
  ProductVariant,
  ProductReview,
  ProductReelLink,
  ProductFeatureNote,
  ProductFaq,
  AuditLog,
  sequelize,
} from "../database/models/index.js";
import { clearCache } from "../middleware/cache.js";
import { fail, ok } from "../utils/http.js";

const pageOptions = (req) => {
  const requestedPage = Number.parseInt(req.query.page || "1", 10);
  const requestedLimit = Number.parseInt(req.query.recordPerPage || "20", 10);
  const page = Number.isFinite(requestedPage) ? Math.max(1, requestedPage) : 1;
  const limit = Number.isFinite(requestedLimit) ? Math.min(100, Math.max(1, requestedLimit)) : 20;
  return { page, limit, offset: (page - 1) * limit };
};

const parseJson = (value, fallback) => {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};
const parseNotes = (value, fallback) => {
  if (value === undefined || value === null || value === "") return fallback;
  if (Array.isArray(value)) return value;
  if (typeof value !== "string") return null;
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed;
  } catch {
    // Multipart form fields are strings; accept a simple comma-separated list too.
  }
  return value.split(",").map((note) => note.trim()).filter(Boolean);
};
const parseBoolean = (value, fallback = true) => {
  if (value === undefined) return fallback;
  if (value === true || value === "true" || value === 1 || value === "1") return true;
  if (value === false || value === "false" || value === 0 || value === "0") return false;
  return null;
};

const imagePaths = (req, body) => {
  const existing = parseJson(body.images, []);
  const savedPaths = Array.isArray(existing)
    ? existing.map((image) => (typeof image === "string" ? image : image.path)).filter(Boolean)
    : [];
  const uploaded = (Array.isArray(req.files) ? req.files : Object.values(req.files || {}).flat())
    .filter((file) => file.fieldname === "images")
    .map((file) => `/uploads/${file.filename}`);
  return [...new Set([...savedPaths, ...uploaded])];
};

const uploadedFiles = (req) =>
  Array.isArray(req.files) ? req.files : Object.values(req.files || {}).flat();

const associations = [
  { model: Category, as: "category" },
  { model: ProductImage, as: "images", attributes: ["id", "path"] },
  { model: ProductVariant, as: "variants" },
  { model: ProductReelLink, as: "reelsLinks", separate: true, order: [["position", "ASC"]] },
  { model: ProductFeatureNote, as: "featureNotes", separate: true, order: [["position", "ASC"]] },
  { model: ProductFaq, as: "faqs", separate: true, order: [["position", "ASC"]] },
];

export const listProducts = async (req, res) => {
  const { page, limit, offset } = pageOptions(req);
  const where = {};
  if (req.query.search) where.name = { [Op.like]: `%${String(req.query.search).slice(0, 80)}%` };
  const { rows, count } = await Product.findAndCountAll({
    where,
    include: associations,
    distinct: true,
    limit,
    offset,
    order: [["createdAt", "DESC"]],
  });
  return ok(res, rows, "Products loaded.", {
    totalRecords: count,
    totalPages: Math.ceil(count / limit),
    currentPage: page,
  });
};

export const productDetail = async (req, res) => {
  const product = await Product.findByPk(req.params.id, { include: associations });
  if (!product) return fail(res, 404, "Product not found.");
  return ok(res, product, "Product loaded.");
};

const saveProduct = async (req, res, existing = null) => {
  const body = req.body;
  const variants = parseJson(body.variants, []);
  if (!Array.isArray(variants) || !variants.length)
    return fail(res, 400, "Add at least one product variant.");
  const category = await Category.findByPk(body.categoryId);
  if (!category) return fail(res, 400, "Select an existing category.");
  if (
    variants.some(
      (variant) =>
        !variant.sku ||
        !Number.isFinite(Number(variant.price)) ||
        Number(variant.price) < 0 ||
        !Number.isInteger(Number(variant.stock ?? 0)) ||
        Number(variant.stock ?? 0) < 0 ||
        (variant.compareAtPrice != null &&
          variant.compareAtPrice !== "" &&
          (!Number.isFinite(Number(variant.compareAtPrice)) || Number(variant.compareAtPrice) < 0)),
    )
  )
    return fail(res, 400, "Each variant needs a SKU, valid price, and non-negative stock.");
  if (variants.some((variant) => Array.isArray(variant.images) && variant.images.length > 5))
    return fail(res, 400, "Each product variant supports up to five images.");

  const images = imagePaths(req, body);
  const showOnShop = parseBoolean(body.showOnShop, existing?.showOnShop ?? true);
  if (showOnShop === null) return fail(res, 400, "showOnShop must be a boolean.");
  const status = body.status || existing?.status || "active";
  if (!["active", "draft", "archived"].includes(status))
    return fail(res, 400, "Product status must be active, draft, or archived.");
  const productValues = {
    categoryId: category.id,
    name: String(body.name || "").trim(),
    slug: String(body.slug || body.name || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, ""),
    description: body.description || null,
    brand: body.brand || null,
    concentration: body.concentration || null,
    fragranceFamily: body.fragranceFamily || null,
    topNotes: parseNotes(body.topNotes, existing?.topNotes ?? []),
    heartNotes: parseNotes(body.heartNotes, existing?.heartNotes ?? []),
    baseNotes: parseNotes(body.baseNotes, existing?.baseNotes ?? []),
    attributes: parseJson(body.attributes, {}),
    ratingAverage: existing?.ratingAverage ?? null,
    reviewCount: existing?.reviewCount ?? 0,
    sprays:
      body.sprays === undefined
        ? (existing?.sprays ?? null)
        : body.sprays === "" || body.sprays === null
          ? null
          : Number(body.sprays),
    labelText: body.labelText ?? existing?.labelText ?? null,
    metaTitle: body.metaTitle ?? existing?.metaTitle ?? null,
    metaDescription: body.metaDescription ?? existing?.metaDescription ?? null,
    metaKeywords: body.metaKeywords ?? existing?.metaKeywords ?? null,
    url: body.url ?? existing?.url ?? null,
    canonicalUrl: body.canonicalUrl ?? existing?.canonicalUrl ?? null,
    robotsTags: body.robotsTags ?? existing?.robotsTags ?? null,
    showOnShop,
    status,
  };
  if ([productValues.topNotes, productValues.heartNotes, productValues.baseNotes].some((notes) => !Array.isArray(notes)))
    return fail(res, 400, "Product notes must be lists or comma-separated strings.");
  for (const [key, label, required] of [
    ["reelsLinks", "Reel links", "url"],
    ["featureNotes", "Feature notes", "text"],
    ["faqs", "Product FAQs", "question"],
  ]) {
    const rows = parseJson(body[key], []);
    if (!Array.isArray(rows)) return fail(res, 400, `${label} must be a list.`);
    if (rows.some((item) => !String(item?.[required] || "").trim()))
      return fail(res, 400, `Each ${label.toLowerCase()} row needs ${required}.`);
    if (key === "featureNotes" && rows.some((item) => !String(item.text || "").trim()))
      return fail(res, 400, "Each feature note needs text.");
    if (key === "faqs" && rows.some((item) => !String(item.answer || "").trim()))
      return fail(res, 400, "Each FAQ needs an answer.");
    if (body[key] !== undefined) body[key] = rows;
  }
  if (
    productValues.sprays !== null &&
    (!Number.isInteger(productValues.sprays) || productValues.sprays < 0)
  )
    return fail(res, 400, "Sprays must be a non-negative whole number.");
  if (!productValues.name) return fail(res, 400, "Product name is required.");

  const variantImageFiles = new Map();
  const featureNoteImageFiles = new Map();
  const requestFiles = uploadedFiles(req);
  const productImagesUploaded = requestFiles.some((file) => file.fieldname === "images");
  for (const file of requestFiles) {
    if (file.fieldname === "images") continue;
    const featureMatch = /^featureNoteImage_(\d+)$/.exec(file.fieldname);
    if (featureMatch) {
      featureNoteImageFiles.set(Number(featureMatch[1]), `/uploads/${file.filename}`);
      continue;
    }
    const match = /^variantImage_(\d+)_(\d+)$/.exec(file.fieldname);
    if (!match || Number(match[2]) > 4)
      return fail(
        res,
        400,
        "Variant image fields are invalid. Each variant supports up to five images.",
      );
    const key = `${match[1]}:${match[2]}`;
    if (variantImageFiles.has(key))
      return fail(res, 400, "Only one image can be uploaded for each variant image position.");
    variantImageFiles.set(key, `/uploads/${file.filename}`);
  }

  try {
    const product = await sequelize.transaction(async (transaction) => {
      const row = existing
        ? await existing.update(productValues, { transaction })
        : await Product.create(productValues, { transaction });
      for (const [key, Model, fields] of [
        ["reelsLinks", ProductReelLink, ["url"]],
        ["featureNotes", ProductFeatureNote, ["text", "image"]],
        ["faqs", ProductFaq, ["question", "answer"]],
      ]) {
        if (body[key] === undefined) continue;
        await Model.destroy({ where: { productId: row.id }, transaction });
        const values = body[key].map((item, position) => ({
          productId: row.id,
          position,
          ...Object.fromEntries(
            fields.map((field) => [
              field,
              field === "image"
                ? featureNoteImageFiles.get(position) || item[field] || null
                : item[field] || null,
            ]),
          ),
        }));
        if (values.length) await Model.bulkCreate(values, { transaction });
      }
      const currentVariants = await ProductVariant.findAll({
        where: { productId: row.id },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      const submittedIds = new Set(variants.map((variant) => variant.id).filter(Boolean));
      for (const variant of currentVariants) {
        if (!submittedIds.has(variant.id)) await variant.update({ active: false }, { transaction });
      }
      for (const [variantIndex, variant] of variants.entries()) {
        const current = variant.id ? currentVariants.find((item) => item.id === variant.id) : null;
        const formIndex =
          variant.formIndex !== undefined &&
          variant.formIndex !== null &&
          variant.formIndex !== "" &&
          Number.isInteger(Number(variant.formIndex))
            ? Number(variant.formIndex)
            : variantIndex;
        const submittedImages = Array.isArray(variant.images)
          ? variant.images
          : current?.images || [];
        const variantImages = Array.from(
          { length: 5 },
          (_, imageIndex) =>
            variantImageFiles.get(`${formIndex}:${imageIndex}`) ||
            submittedImages[imageIndex] ||
            null,
        ).filter(Boolean);
        const values = {
          sku: String(variant.sku).trim(),
          options: variant.options && typeof variant.options === "object" ? variant.options : {},
          images: variantImages,
          price: Number(variant.price),
          compareAtPrice: variant.compareAtPrice === "" ? null : (variant.compareAtPrice ?? null),
          stock: Number(variant.stock || 0),
          active: parseBoolean(variant.active),
        };
        if (values.active === null)
          throw Object.assign(new Error("Variant active must be a boolean."), { status: 400 });
        if (variant.id) {
          if (!current)
            throw Object.assign(new Error("Variant does not belong to this product."), {
              status: 400,
            });
          await current.update(values, { transaction });
        } else {
          await ProductVariant.create({ ...values, productId: row.id }, { transaction });
        }
      }
      if (body.images !== undefined || productImagesUploaded) {
        await ProductImage.destroy({ where: { productId: row.id }, transaction });
        if (images.length)
          await ProductImage.bulkCreate(
            images.map((path) => ({ productId: row.id, path })),
            { transaction },
          );
      }
      await AuditLog.create(
        {
          actorUserId: req.user.id,
          action: existing ? "product.update" : "product.create",
          resourceType: "product",
          resourceId: row.id,
          changes: {
            name: productValues.name,
            slug: productValues.slug,
            categoryId: productValues.categoryId,
            variants: variants.map(({ id, sku, price, stock, active, images }) => ({
              id: id || null,
              sku,
              price,
              stock: stock ?? 0,
              active: active !== false,
              imageCount: Array.isArray(images) ? images.length : 0,
            })),
            imagesChanged: body.images !== undefined || productImagesUploaded,
          },
          ipAddress: req.ip,
        },
        { transaction },
      );
      return Product.findByPk(row.id, { include: associations, transaction });
    });
    await clearCache();
    return ok(
      res,
      product,
      existing ? "Product updated." : "Product created.",
      null,
      existing ? 200 : 201,
    );
  } catch (error) {
    if (error.name === "SequelizeUniqueConstraintError")
      return fail(res, 409, "A product slug or variant SKU already exists.");
    if (error.status) return fail(res, error.status, error.message);
    throw error;
  }
};

export const createProduct = (req, res) => saveProduct(req, res);

export const updateProduct = async (req, res) => {
  const product = await Product.findByPk(req.params.id);
  if (!product) return fail(res, 404, "Product not found.");
  return saveProduct(req, res, product);
};

export const deleteProduct = async (req, res) => {
  const product = await Product.findByPk(req.params.id);
  if (!product) return fail(res, 404, "Product not found.");
  await product.update({ status: "archived", showOnShop: false });
  await AuditLog.create({
    actorUserId: req.user.id,
    action: "product.archive",
    resourceType: "product",
    resourceId: product.id,
    changes: { status: "archived", showOnShop: false },
    ipAddress: req.ip,
  });
  await clearCache();
  return ok(res, null, "Product archived.");
};

export const productReviews = async (req, res) => {
  const { page, limit, offset } = pageOptions(req);
  const where = {};
  if (req.query.productId) where.productId = req.query.productId;
  if (["pending", "approved", "disapproved"].includes(req.query.status))
    where.status = req.query.status;
  const { rows, count } = await ProductReview.findAndCountAll({
    where,
    include: [{ model: Product, as: "product", attributes: ["id", "name", "slug"] }],
    limit,
    offset,
    order: [["createdAt", "DESC"]],
  });
  return ok(res, rows, "Reviews loaded.", {
    totalRecords: count,
    totalPages: Math.ceil(count / limit),
    currentPage: page,
  });
};

export const moderateProductReview = async (req, res) => {
  const review = await ProductReview.findByPk(req.params.id);
  if (!review) return fail(res, 404, "Review not found.");
  const status = req.body.status;
  if (!["approved", "disapproved"].includes(status))
    return fail(res, 400, "Status must be approved or disapproved.");
  await sequelize.transaction(async (transaction) => {
    await review.update({ status }, { transaction });
    const aggregate = await ProductReview.findOne({
      where: { productId: review.productId, status: "approved" },
      attributes: [
        [sequelize.fn("AVG", sequelize.col("rating")), "average"],
        [sequelize.fn("COUNT", sequelize.col("id")), "count"],
      ],
      raw: true,
      transaction,
    });
    await Product.update(
      {
        ratingAverage: aggregate.count ? Number(Number(aggregate.average).toFixed(2)) : null,
        reviewCount: Number(aggregate.count || 0),
      },
      { where: { id: review.productId }, transaction },
    );
  });
  return ok(res, review, "Review moderation updated.");
};

export const createAdminProductReview = async (req, res) => {
  const product = await Product.findByPk(req.body.productId);
  const rating = Number(req.body.rating);
  const customerName = String(req.body.customerName || "")
    .trim()
    .slice(0, 120);
  const body = String(req.body.body || "").trim();
  const status = req.body.status || "pending";
  if (!product) return fail(res, 400, "Select an existing product.");
  if (!Number.isInteger(rating) || rating < 1 || rating > 5 || !customerName || !body)
    return fail(res, 400, "A customer name, review, and rating from 1 to 5 are required.");
  if (!["pending", "approved", "disapproved"].includes(status))
    return fail(res, 400, "Review status is invalid.");
  const review = await ProductReview.create({
    productId: product.id,
    customerName,
    rating,
    title:
      String(req.body.title || "")
        .trim()
        .slice(0, 180) || null,
    body,
    status,
  });
  if (status === "approved") {
    const aggregate = await ProductReview.findOne({
      where: { productId: product.id, status: "approved" },
      attributes: [
        [sequelize.fn("AVG", sequelize.col("rating")), "average"],
        [sequelize.fn("COUNT", sequelize.col("id")), "count"],
      ],
      raw: true,
    });
    await product.update({
      ratingAverage: Number(Number(aggregate.average).toFixed(2)),
      reviewCount: Number(aggregate.count || 0),
    });
  }
  return ok(res, review, "Review created.", null, 201);
};

export const setVisibility = async (req, res) => {
  const { productIds, showOnShop } = req.body;
  if (
    !Array.isArray(productIds) ||
    !productIds.length ||
    productIds.some((id) => typeof id !== "string") ||
    typeof showOnShop !== "boolean"
  )
    return fail(res, 400, "Product IDs and visibility are required.");
  const uniqueIds = [...new Set(productIds)];
  const count = await Product.count({ where: { id: { [Op.in]: uniqueIds } } });
  if (count !== uniqueIds.length) return fail(res, 404, "One or more products were not found.");
  await Product.update({ showOnShop }, { where: { id: { [Op.in]: productIds } } });
  await AuditLog.create({
    actorUserId: req.user.id,
    action: "product.visibility.update",
    resourceType: "product",
    changes: { productIds: uniqueIds, showOnShop },
    ipAddress: req.ip,
  });
  await clearCache();
  return ok(res, null, "Visibility updated.");
};

export const inventory = async (req, res) => {
  const { page, limit, offset } = pageOptions(req);
  const { rows, count } = await ProductVariant.findAndCountAll({
    include: [
      {
        model: Product,
        as: "product",
        include: [
          { model: Category, as: "category" },
          { model: ProductImage, as: "images", attributes: ["id", "path"] },
        ],
      },
    ],
    limit,
    offset,
    order: [["updatedAt", "DESC"]],
  });
  return ok(res, rows, "Inventory loaded.", {
    totalRecords: count,
    totalPages: Math.ceil(count / limit),
    currentPage: page,
  });
};

export const updateInventory = async (req, res) => {
  const variant = await ProductVariant.findByPk(req.params.id);
  const quantity = Number(req.body.quantity);
  if (!variant) return fail(res, 404, "Variant not found.");
  if (!Number.isInteger(quantity) || quantity < 0)
    return fail(res, 400, "Quantity must be a non-negative integer.");
  const previousStock = variant.stock;
  await variant.update({ stock: quantity });
  await AuditLog.create({
    actorUserId: req.user.id,
    action: "inventory.quantity.update",
    resourceType: "product_variant",
    resourceId: variant.id,
    changes: { previousStock, stock: quantity },
    ipAddress: req.ip,
  });
  await clearCache();
  return ok(res, variant, "Inventory updated.");
};

export const restockInventory = async (req, res) => {
  const variant = await ProductVariant.findByPk(req.params.id);
  const quantity = Number(req.body.quantity);
  if (!variant) return fail(res, 404, "Variant not found.");
  if (!Number.isInteger(quantity) || quantity < 1)
    return fail(res, 400, "Restock quantity must be a positive integer.");
  const previousStock = variant.stock;
  await variant.increment("stock", { by: quantity });
  await variant.reload();
  await AuditLog.create({
    actorUserId: req.user.id,
    action: "inventory.restock",
    resourceType: "product_variant",
    resourceId: variant.id,
    changes: { previousStock, restockQuantity: quantity, stock: variant.stock },
    ipAddress: req.ip,
  });
  await clearCache();
  return ok(res, variant, "Variant restocked.");
};
