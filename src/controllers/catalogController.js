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
  Promotion,
  sequelize,
} from "../database/models/index.js";
import { fail, ok } from "../utils/http.js";

const paging = (req) => {
  const requestedPage = Number.parseInt(req.query.page || "1", 10);
  const requestedLimit = Number.parseInt(req.query.recordPerPage || "20", 10);
  const page = Number.isFinite(requestedPage) ? Math.max(1, requestedPage) : 1;
  const limit = Number.isFinite(requestedLimit) ? Math.min(100, Math.max(1, requestedLimit)) : 20;
  return { page, limit, offset: (page - 1) * limit };
};

export const catalog = async (req, res) => {
  const { page, limit, offset } = paging(req);
  const where = { showOnShop: true, status: "active" };
  if (req.query.categoryId) where.categoryId = req.query.categoryId;
  if (req.query.category) {
    const category = await Category.findOne({
      where: { slug: String(req.query.category).slice(0, 100), active: true },
      attributes: ["id"],
    });
    where.categoryId = category?.id || null;
  }
  const note = String(req.query.note || req.query.notes || "")
    .trim()
    .slice(0, 60);
  if (note)
    where[Op.or] = ["top_notes", "heart_notes", "base_notes"].map((field) =>
      sequelize.where(
        sequelize.fn("JSON_SEARCH", sequelize.col(`Product.${field}`), "one", `%${note}%`),
        {
          [Op.ne]: null,
        },
      ),
    );
  const minPrice = Number(req.query.minPrice ?? req.query.priceMin);
  const maxPrice = Number(req.query.maxPrice ?? req.query.priceMax);
  const variantWhere = { active: true };
  if (Number.isFinite(minPrice))
    variantWhere.price = { ...(variantWhere.price || {}), [Op.gte]: minPrice };
  if (Number.isFinite(maxPrice))
    variantWhere.price = { ...(variantWhere.price || {}), [Op.lte]: maxPrice };
  if (req.query.search) where.name = { [Op.like]: `%${String(req.query.search).slice(0, 80)}%` };
  const { rows, count } = await Product.findAndCountAll({
    where,
    include: [
      { model: Category, as: "category" },
      { model: ProductImage, as: "images", attributes: ["id", "path"] },
      { model: ProductReelLink, as: "reelsLinks", separate: true, order: [["position", "ASC"]] },
      {
        model: ProductFeatureNote,
        as: "featureNotes",
        separate: true,
        order: [["position", "ASC"]],
      },
      { model: ProductFaq, as: "faqs", separate: true, order: [["position", "ASC"]] },
      {
        model: ProductVariant,
        as: "variants",
        where: variantWhere,
        required: Number.isFinite(minPrice) || Number.isFinite(maxPrice),
      },
    ],
    distinct: true,
    limit,
    offset,
    order:
      req.query.sort === "price_asc"
        ? [[{ model: ProductVariant, as: "variants" }, "price", "ASC"]]
        : req.query.sort === "price_desc"
          ? [[{ model: ProductVariant, as: "variants" }, "price", "DESC"]]
          : [["createdAt", "DESC"]],
  });
  return ok(res, rows, "Products loaded.", {
    totalRecords: count,
    totalPages: Math.ceil(count / limit),
    currentPage: page,
  });
};

export const product = async (req, res) => {
  const row = await Product.findOne({
    where: {
      [Op.or]: [{ id: req.params.id }, { slug: req.params.id }],
      showOnShop: true,
      status: "active",
    },
    include: [
      { model: Category, as: "category" },
      { model: ProductImage, as: "images", attributes: ["id", "path"] },
      { model: ProductReelLink, as: "reelsLinks", separate: true, order: [["position", "ASC"]] },
      {
        model: ProductFeatureNote,
        as: "featureNotes",
        separate: true,
        order: [["position", "ASC"]],
      },
      { model: ProductFaq, as: "faqs", separate: true, order: [["position", "ASC"]] },
      { model: ProductVariant, as: "variants", where: { active: true }, required: false },
      {
        model: ProductReview,
        as: "reviews",
        where: { status: "approved" },
        required: false,
        attributes: ["id", "customerName", "rating", "title", "body", "createdAt"],
      },
    ],
  });
  if (!row) return fail(res, 404, "Product not found.");
  return ok(res, row, "Product loaded.");
};

export const categories = async (_q, res) =>
  ok(
    res,
    await Category.findAll({ where: { active: true, showOnHomePage: true } }),
    "Categories loaded.",
  );

export const listProductReviews = async (req, res) => {
  const { page, limit, offset } = paging(req);
  const product = await Product.findOne({
    where: {
      [Op.or]: [{ id: req.params.id }, { slug: req.params.id }],
      status: "active",
      showOnShop: true,
    },
  });
  if (!product) return fail(res, 404, "Product not found.");
  const { rows, count } = await ProductReview.findAndCountAll({
    where: { productId: product.id, status: "approved" },
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

export const createProductReview = async (req, res) => {
  const product = await Product.findOne({
    where: { [Op.or]: [{ id: req.params.id }, { slug: req.params.id }] },
  });
  if (!product || product.status !== "active" || !product.showOnShop)
    return fail(res, 404, "Product not found.");
  const rating = Number(req.body.rating);
  const customerName = String(req.body.customerName || req.user.name || "")
    .trim()
    .slice(0, 120);
  const body = String(req.body.body || "").trim();
  if (!Number.isInteger(rating) || rating < 1 || rating > 5 || !customerName || !body)
    return fail(res, 400, "A customer name, review, and rating from 1 to 5 are required.");
  const review = await ProductReview.create({
    productId: product.id,
    userId: req.user.id,
    customerName,
    rating,
    title:
      String(req.body.title || "")
        .trim()
        .slice(0, 180) || null,
    body,
  });
  return ok(res, review, "Review submitted for approval.", null, 201);
};

export const productsListHomepage = async (req, res) => {
  const row = await Product.findAll({
    where: {
      showOnShop: true,
      status: "active",
    },
    include: [
      { model: Category, as: "category", attributes: ["name", "slug"] },
      { model: ProductImage, as: "images", attributes: ["id", "path"] },
      {
        model: ProductFeatureNote,
        as: "featureNotes",
        separate: true,
        order: [["position", "ASC"]],
        attributes: ["text", "image"],
      },
      {
        model: ProductVariant,
        as: "variants",
        where: {
          active: true,
        },
        attributes: ["id", "price", "compareAtPrice", "stock", "images", "options"],
      },
    ],
    attributes: [
      "id",
      "name",
      "slug",
      "brand",
      "ratingAverage",
      "reviewCount",
      "sprays",
      "labelText",
    ],
  });
  if (!row) return fail(res, 404, "Products not found.");
  return ok(res, row, "Products loaded.");
};

export const promotionalProducts = async (_req, res) => {
  const now = new Date();
  const promotions = await Promotion.findAll({
    where: {
      active: true,
      type: "free_product",
      promotionalVariantId: { [Op.ne]: null },
      [Op.and]: [
        { [Op.or]: [{ startsAt: null }, { startsAt: { [Op.lte]: now } }] },
        { [Op.or]: [{ endsAt: null }, { endsAt: { [Op.gte]: now } }] },
      ],
    },
    include: [
      {
        model: ProductVariant,
        as: "promotionalVariant",
        where: { active: true, stock: { [Op.gt]: 0 } },
        required: true,
        include: [
          {
            model: Product,
            as: "product",
            where: { status: "active", showOnShop: true },
            required: true,
            include: [{ model: ProductImage, as: "images", attributes: ["id", "path"] }],
          },
        ],
      },
    ],
    order: [["minimumSubtotal", "ASC"]],
  });
  const available = promotions.filter(
    (promotion) => !promotion.usageLimit || promotion.usedCount < promotion.usageLimit,
  );
  return ok(
    res,
    available.map((promotion) => ({
      id: promotion.id,
      code: promotion.code,
      name: promotion.name,
      minimumSubtotal: promotion.minimumSubtotal,
      promotionalProduct: promotion.promotionalVariant,
      remainingUses:
        promotion.usageLimit == null
          ? null
          : Math.max(0, promotion.usageLimit - promotion.usedCount),
    })),
    "Promotional products loaded.",
  );
};
