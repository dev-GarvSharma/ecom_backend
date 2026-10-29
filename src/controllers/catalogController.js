import { Op } from "sequelize";
import { Category, Product, ProductImage, ProductVariant } from "../database/models/index.js";
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
  if (req.query.search) where.name = { [Op.like]: `%${String(req.query.search).slice(0, 80)}%` };
  const { rows, count } = await Product.findAndCountAll({
    where,
    include: [
      { model: Category, as: "category" },
      { model: ProductImage, as: "images", attributes: ["id", "path"] },
      { model: ProductVariant, as: "variants", where: { active: true }, required: false },
    ],
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
      { model: ProductVariant, as: "variants", where: { active: true }, required: false },
    ],
  });
  if (!row) return fail(res, 404, "Product not found.");
  return ok(res, row, "Product loaded.");
};

export const categories = async (_q, res) =>
  ok(res, await Category.findAll({ where: { active: true } }), "Categories loaded.");
