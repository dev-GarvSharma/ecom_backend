import { Op } from "sequelize";
import { AuditLog, BlogComment, BlogPost } from "../database/models/index.js";
import { fail, ok } from "../utils/http.js";
import sanitizeHtml from "../utils/sanitizeHtml.js";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const paging = (req) => {
  const page = Math.max(1, Number.parseInt(req.query.page || "1", 10) || 1);
  const limit = Math.min(
    50,
    Math.max(1, Number.parseInt(req.query.limit || req.query.recordPerPage || "20", 10) || 20),
  );
  return { page, limit, offset: (page - 1) * limit };
};
const makeSlug = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 220);
const parseTags = (value) => {
  const tags = Array.isArray(value) ? value : String(value || "").split(",");
  return [...new Set(tags.map((tag) => String(tag).trim()).filter(Boolean))].slice(0, 20);
};

export const blogList = async (req, res) => {
  const { page, limit, offset } = paging(req);
  const { rows, count } = await BlogPost.findAndCountAll({
    where: { status: "published", publishedAt: { [Op.lte]: new Date() } },
    attributes: [
      "id",
      "title",
      "slug",
      "description",
      "bannerImage",
      "publishedAt",
      "metaTitle",
      "metaDescription",
      "metaTags",
    ],
    limit,
    offset,
    order: [["publishedAt", "DESC"]],
  });
  return ok(res, rows, "Blog posts loaded.", {
    totalRecords: count,
    totalPages: Math.ceil(count / limit),
    currentPage: page,
  });
};

export const blogDetails = async (req, res) => {
  const post = await BlogPost.findOne({
    where: { slug: req.params.slug, status: "published", publishedAt: { [Op.lte]: new Date() } },
    attributes: [
      "id",
      "title",
      "slug",
      "description",
      "content",
      "bannerImage",
      "publishedAt",
      "metaTitle",
      "metaDescription",
      "metaTags",
    ],
    include: [
      {
        model: BlogComment,
        as: "comments",
        where: { status: "approved" },
        required: false,
        attributes: ["id", "name", "comment", "createdAt"],
        order: [["createdAt", "ASC"]],
      },
    ],
  });
  if (!post) return fail(res, 404, "Blog post not found.");
  post.comments.sort((first, second) => new Date(first.createdAt) - new Date(second.createdAt));
  return ok(res, post, "Blog post loaded.");
};

export const submitBlogComment = async (req, res) => {
  const post = await BlogPost.findOne({
    where: { slug: req.params.slug, status: "published", publishedAt: { [Op.lte]: new Date() } },
    attributes: ["id"],
  });
  if (!post) return fail(res, 404, "Blog post not found.");
  const name = String(req.body.name || "").trim();
  const email = String(req.body.email || "")
    .trim()
    .toLowerCase();
  const comment = String(req.body.comment || "").trim();
  if (name.length < 2 || name.length > 120)
    return fail(res, 400, "Name must be 2 to 120 characters.");
  if (email.length > 254 || !emailPattern.test(email))
    return fail(res, 400, "Enter a valid email address.");
  if (comment.length < 2 || comment.length > 3000)
    return fail(res, 400, "Comment must be 2 to 3,000 characters.");
  await BlogComment.create({ blogPostId: post.id, name, email, comment, status: "pending" });
  return ok(res, null, "Your comment was submitted for admin approval.", null, 201);
};

export const adminBlogList = async (req, res) => {
  const { page, limit, offset } = paging(req);
  const { rows, count } = await BlogPost.findAndCountAll({
    attributes: { exclude: ["content"] },
    limit,
    offset,
    order: [["updatedAt", "DESC"]],
  });
  return ok(res, rows, "Blog posts loaded.", {
    totalRecords: count,
    totalPages: Math.ceil(count / limit),
    currentPage: page,
  });
};

export const adminBlogDetail = async (req, res) => {
  const post = await BlogPost.findByPk(req.params.id);
  if (!post) return fail(res, 404, "Blog post not found.");
  return ok(res, post, "Blog post loaded.");
};

const saveBlogPost = async (req, res, existing = null) => {
  const title = String(req.body.title || "").trim();
  const description = String(req.body.description || "").trim();
  const content = sanitizeHtml(req.body.content);
  const slug = makeSlug(req.body.slug || title);
  const status = String(req.body.status || existing?.status || "draft");
  if (title.length < 2 || title.length > 200)
    return fail(res, 400, "Title must be 2 to 200 characters.");
  if (!slug) return fail(res, 400, "Add a title or valid slug.");
  if (description.length < 2 || description.length > 500)
    return fail(res, 400, "Description must be 2 to 500 characters.");
  if (content.replace(/<[^>]+>/g, " ").trim().length < 2)
    return fail(res, 400, "Blog content is required.");
  if (!["draft", "published"].includes(status))
    return fail(res, 400, "Status must be draft or published.");

  const bannerImage = req.file ? `/uploads/${req.file.filename}` : existing?.bannerImage || null;
  const values = {
    title,
    slug,
    description,
    content,
    metaTitle:
      String(req.body.metaTitle || title)
        .trim()
        .slice(0, 200) || null,
    metaDescription:
      String(req.body.metaDescription || description)
        .trim()
        .slice(0, 320) || null,
    metaTags: parseTags(req.body.metaTags),
    bannerImage,
    status,
    publishedAt: status === "published" ? existing?.publishedAt || new Date() : null,
  };
  try {
    const post = existing ? await existing.update(values) : await BlogPost.create(values);
    await AuditLog.create({
      actorUserId: req.user.id,
      action: existing ? "blog.update" : "blog.create",
      resourceType: "blog_post",
      resourceId: post.id,
      changes: { title, slug, status, bannerImage },
      ipAddress: req.ip,
    });
    return ok(
      res,
      post,
      existing ? "Blog post updated." : "Blog post created.",
      null,
      existing ? 200 : 201,
    );
  } catch (error) {
    if (error.name === "SequelizeUniqueConstraintError")
      return fail(res, 409, "A blog post already uses this slug.");
    throw error;
  }
};

export const createBlogPost = (req, res) => saveBlogPost(req, res);

export const updateBlogPost = async (req, res) => {
  const post = await BlogPost.findByPk(req.params.id);
  if (!post) return fail(res, 404, "Blog post not found.");
  return saveBlogPost(req, res, post);
};

export const deleteBlogPost = async (req, res) => {
  const post = await BlogPost.findByPk(req.params.id);
  if (!post) return fail(res, 404, "Blog post not found.");
  await post.destroy();
  await AuditLog.create({
    actorUserId: req.user.id,
    action: "blog.delete",
    resourceType: "blog_post",
    resourceId: post.id,
    changes: { title: post.title, slug: post.slug },
    ipAddress: req.ip,
  });
  return ok(res, null, "Blog post deleted.");
};

export const adminCommentList = async (req, res) => {
  const { page, limit, offset } = paging(req);
  const status = String(req.query.status || "");
  const where = {
    ...(req.query.blogPostId ? { blogPostId: String(req.query.blogPostId) } : {}),
    ...(["pending", "approved", "rejected"].includes(status) ? { status } : {}),
  };
  const { rows, count } = await BlogComment.findAndCountAll({
    where,
    include: [{ model: BlogPost, as: "post", attributes: ["id", "title", "slug"] }],
    limit,
    offset,
    order: [["createdAt", "DESC"]],
    distinct: true,
  });
  return ok(res, rows, "Blog comments loaded.", {
    totalRecords: count,
    totalPages: Math.ceil(count / limit),
    currentPage: page,
  });
};

export const moderateBlogComment = async (req, res) => {
  const comment = await BlogComment.findByPk(req.params.id);
  if (!comment) return fail(res, 404, "Blog comment not found.");
  const status = String(req.body.status || "");
  if (!["approved", "rejected", "pending"].includes(status))
    return fail(res, 400, "Status must be approved, rejected, or pending.");
  await comment.update({ status });
  await AuditLog.create({
    actorUserId: req.user.id,
    action: `blog_comment.${status}`,
    resourceType: "blog_comment",
    resourceId: comment.id,
    changes: { status },
    ipAddress: req.ip,
  });
  return ok(res, comment, "Blog comment moderated.");
};
