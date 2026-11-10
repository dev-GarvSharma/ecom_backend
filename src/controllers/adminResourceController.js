import { Op } from "sequelize";
import {
  User,
  Category,
  Cart,
  CartItem,
  Order,
  OrderItem,
  Coupon,
  Notification,
  Address,
  Campaign,
  Setting,
  Role,
  Permission,
  AuditLog,
  CartSession,
  Promotion,
  ProductVariant,
  CampaignDelivery,
  sequelize,
} from "../database/models/index.js";
import { ok, fail } from "../utils/http.js";
import { clearCache } from "../middleware/cache.js";
const paging = (req) => {
  const requestedPage = Number.parseInt(req.query.page || "1", 10);
  const requestedLimit = Number.parseInt(req.query.recordPerPage || "20", 10);
  const page = Number.isFinite(requestedPage) ? Math.max(1, requestedPage) : 1;
  const limit = Number.isFinite(requestedLimit) ? Math.min(100, Math.max(1, requestedLimit)) : 20;
  return { page, limit, offset: (page - 1) * limit };
};
const clean = (body) => {
  const values = { ...body };
  for (const key of ["id", "createdAt", "updatedAt", "password", "refreshTokenHash"])
    delete values[key];
  return values;
};
const map = {
  categories: Category,
  orders: Order,
  customers: User,
  coupons: Coupon,
  campaigns: Campaign,
  promotions: Promotion,
};

export const adminList = async (req, res) => {
  const resource = req.params.resource,
    M = map[resource];
  if (!M) return fail(res, 404, "Resource not found.");
  const { page, limit, offset } = paging(req);
  let where = resource === "customers" ? { role: "user" } : {};
  if (resource === "customers") {
    const search = String(req.query.search || "")
      .trim()
      .slice(0, 100);
    if (search)
      where = {
        ...where,
        [Op.or]: [
          { name: { [Op.like]: `%${search}%` } },
          { email: { [Op.like]: `%${search}%` } },
          { phone: { [Op.like]: `%${search}%` } },
        ],
      };
  }
  if (resource === "campaigns") {
    const search = String(req.query.search || "")
      .trim()
      .slice(0, 100);
    const status = String(req.query.status || "").trim();
    if (search) {
      where = {
        ...where,
        [Op.or]: [
          { name: { [Op.like]: `%${search}%` } },
          { subject: { [Op.like]: `%${search}%` } },
          { channel: { [Op.like]: `%${search}%` } },
          { audience: { [Op.like]: `%${search}%` } },
        ],
      };
    }
    if (["Draft", "Scheduled", "Active", "Sending", "Sent", "Paused", "Failed"].includes(status))
      where.status = status;
  }
  if (resource === "orders") {
    const mode = req.query.razorpayMode || req.query.mode;
    if (["live", "test"].includes(mode)) where.razorpayMode = mode;
    if (["Pending", "Processing", "Shipped", "Delivered", "Cancelled"].includes(req.query.status))
      where.status = req.query.status;
    if (["Pending", "Paid", "Failed", "Refunded"].includes(req.query.paymentStatus))
      where.paymentStatus = req.query.paymentStatus;
  }
  const inc =
    resource === "orders"
      ? [
          { model: User, as: "customer", attributes: ["name", "email"] },
          { model: OrderItem, as: "items" },
        ]
      : resource === "customers"
        ? [{ model: Role, as: "primaryRole", attributes: ["id", "name"] }]
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
      phone: u.phone,
      isVerified: u.isVerified,
      marketingEmailSubscribed: u.marketingEmailSubscribed,
      primaryRole: u.primaryRole?.name || null,
      location: u.location || "",
      orders: 0,
      spent: 0,
      joined: u.createdAt,
      segment: "New",
      status: u.status,
    }));
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

export const adminTestOrders = (req, res) =>
  adminList({ params: { resource: "orders" }, query: { ...req.query, mode: "test" } }, res);

export const razorpayMode = async (_req, res) => {
  const setting = await Setting.findByPk("razorpay_mode");
  return ok(
    res,
    {
      mode: setting?.value === "test" ? "test" : "live",
      testConfigured: Boolean(
        process.env.RAZORPAY_TEST_KEY_ID && process.env.RAZORPAY_TEST_KEY_SECRET,
      ),
      liveConfigured: Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET),
    },
    "Razorpay mode loaded.",
  );
};

export const setRazorpayMode = async (req, res) => {
  const mode = req.body.mode;
  if (!["test", "live"].includes(mode)) return fail(res, 400, "Mode must be test or live.");
  const configured =
    mode === "test"
      ? process.env.RAZORPAY_TEST_KEY_ID && process.env.RAZORPAY_TEST_KEY_SECRET
      : process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET;
  if (!configured)
    return fail(
      res,
      503,
      `${mode === "test" ? "Test" : "Live"} Razorpay credentials are not configured.`,
    );
  const [setting] = await Setting.findOrCreate({
    where: { key: "razorpay_mode" },
    defaults: { value: mode },
  });
  if (setting.value !== mode) await setting.update({ value: mode });
  return ok(
    res,
    {
      mode,
      testConfigured: Boolean(
        process.env.RAZORPAY_TEST_KEY_ID && process.env.RAZORPAY_TEST_KEY_SECRET,
      ),
      liveConfigured: Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET),
    },
    `Razorpay ${mode} mode enabled.`,
  );
};

export const adminDetail = async (req, res) => {
  const resource = req.params.resource,
    M = map[resource];
  if (!M) return fail(res, 404, "Resource not found.");
  const include = resource === "orders" ? [{ model: OrderItem, as: "items" }] : [];
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
  if (resource === "campaigns") {
    const [accepted, failed, skipped] = await Promise.all([
      CampaignDelivery.count({ where: { campaignId: row.id, status: "accepted" } }),
      CampaignDelivery.count({ where: { campaignId: row.id, status: "failed" } }),
      CampaignDelivery.count({ where: { campaignId: row.id, status: "skipped" } }),
    ]);
    return ok(
      res,
      { ...row.toJSON(), deliverySummary: { accepted, failed, skipped } },
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
    if (resource === "coupons") {
      values.code = String(values.code || "")
        .trim()
        .toUpperCase();
      values.startsAt = values.startsAt || null;
      values.expiresAt = values.expiresAt || null;
      for (const key of ["startsAt", "expiresAt"]) {
        if (values[key] !== null) {
          const date = new Date(values[key]);
          if (Number.isNaN(date.getTime())) return fail(res, 400, `Coupon ${key} date is invalid.`);
          values[key] = date;
        }
      }
      if (values.startsAt && values.expiresAt && values.startsAt >= values.expiresAt)
        return fail(res, 400, "Coupon end date must be after its start date.");
      for (const key of ["usageLimit", "perUserLimit"]) {
        if (values[key] === "" || values[key] === null) values[key] = null;
        else if (values[key] !== undefined) {
          values[key] = Number(values[key]);
          if (!Number.isInteger(values[key]) || values[key] < 1)
            return fail(res, 400, `Coupon ${key} must be a positive whole number.`);
        }
      }
    }
    if (resource === "promotions") {
      values.code = String(values.code || "")
        .trim()
        .toUpperCase();
      if (values.type !== "free_product" || !values.promotionalVariantId)
        return fail(
          res,
          400,
          "Only free-product promotions with a configured variant are currently supported.",
        );
      if (!(await ProductVariant.findByPk(values.promotionalVariantId)))
        return fail(res, 400, "Promotional variant does not exist.");
    }
    if (resource === "campaigns") {
      values.name = String(values.name || "").trim();
      values.subject = String(values.subject || values.name || "").trim();
      values.channel = String(values.channel || "email")
        .trim()
        .toLowerCase();
      values.audience = String(values.audience || "").trim();
      values.status = String(values.status || "Draft");
      values.content = String(values.content || "");
      if (values.name.length < 2 || values.name.length > 180)
        return fail(res, 400, "Campaign name must be between 2 and 180 characters.");
      if (!values.subject || values.subject.length > 200)
        return fail(res, 400, "Campaign subject is required and cannot exceed 200 characters.");
      if (!["email", "sms"].includes(values.channel))
        return fail(res, 400, "Campaign channel must be email or sms.");
      if (!values.audience || values.audience.length > 120)
        return fail(res, 400, "Campaign audience is required and cannot exceed 120 characters.");
      if (!["Draft", "Scheduled", "Active", "Paused"].includes(values.status))
        return fail(
          res,
          400,
          "Campaign status is invalid. Sent campaigns can only be created by a delivery workflow.",
        );
      if (values.content.length > 50000)
        return fail(res, 400, "Campaign content cannot exceed 50,000 characters.");
      if (values.scheduledAt) {
        const scheduledAt = new Date(values.scheduledAt);
        if (Number.isNaN(scheduledAt.getTime()))
          return fail(res, 400, "Campaign schedule date is invalid.");
        if (scheduledAt <= new Date())
          return fail(res, 400, "Campaign schedule date must be in the future.");
        values.scheduledAt = scheduledAt;
      } else {
        values.scheduledAt = null;
      }
      if (values.status === "Scheduled" && !values.scheduledAt)
        return fail(res, 400, "Choose a schedule date for a scheduled campaign.");
    }
    if (resource === "categories") {
      if (typeof values.image === "string" && values.image.startsWith("data:"))
        return fail(res, 400, "Upload the category image as a multipart file in the image field.");
      if (req.files?.image?.[0]) values.image = `/uploads/${req.files.image[0].filename}`;
      values.metaTitle = values.meta_title;
      values.metaDescription = values.meta_description;
      values.robotsMetaTag = values.robots_meta_tag;
      values.showOnHomePage = values.show_on_home_page;
      for (const k of ["meta_title", "meta_description", "robots_meta_tag", "show_on_home_page"])
        delete values[k];
    }
    const row = await M.create(values);
    if (resource === "products") {
      if (paths.length)
        await ProductImage.bulkCreate(paths.map((path) => ({ productId: row.id, path })));
      await row.reload({ include: [{ model: ProductImage, as: "images" }] });
    }
    await clearCache();
    await AuditLog.create({
      actorUserId: req.user.id,
      action: `${resource}.create`,
      resourceType: resource,
      resourceId: row.id,
      changes: values,
      ipAddress: req.ip,
    });
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
  if (resource === "coupons") {
    const allowed = new Set([
      "code",
      "type",
      "value",
      "minOrder",
      "maxDiscount",
      "usageLimit",
      "perUserLimit",
      "startsAt",
      "expiresAt",
      "active",
    ]);
    if (Object.keys(values).some((key) => !allowed.has(key)))
      return fail(res, 400, "Coupon updates contain unsupported fields.");
    if (values.code !== undefined) values.code = String(values.code).trim().toUpperCase();
    for (const key of ["startsAt", "expiresAt"]) {
      if (values[key] === "" || values[key] === null) values[key] = null;
      else if (values[key] !== undefined) {
        const date = new Date(values[key]);
        if (Number.isNaN(date.getTime())) return fail(res, 400, `Coupon ${key} date is invalid.`);
        values[key] = date;
      }
    }
    const startsAt = values.startsAt === undefined ? row.startsAt : values.startsAt;
    const expiresAt = values.expiresAt === undefined ? row.expiresAt : values.expiresAt;
    if (startsAt && expiresAt && new Date(startsAt) >= new Date(expiresAt))
      return fail(res, 400, "Coupon end date must be after its start date.");
    for (const key of ["usageLimit", "perUserLimit"]) {
      if (values[key] === "" || values[key] === null) values[key] = null;
      else if (values[key] !== undefined) {
        values[key] = Number(values[key]);
        if (!Number.isInteger(values[key]) || values[key] < 1)
          return fail(res, 400, `Coupon ${key} must be a positive whole number.`);
      }
    }
  }
  if (resource === "campaigns") {
    if (["Sent", "Sending", "Failed"].includes(row.status))
      return fail(res, 409, "This campaign cannot be edited in its current status.");
    const allowed = new Set([
      "name",
      "subject",
      "channel",
      "audience",
      "status",
      "scheduledAt",
      "content",
    ]);
    if (Object.keys(values).some((key) => !allowed.has(key)))
      return fail(res, 400, "Campaign updates contain unsupported fields.");
    if (values.name !== undefined) {
      values.name = String(values.name).trim();
      if (values.name.length < 2 || values.name.length > 180)
        return fail(res, 400, "Campaign name must be between 2 and 180 characters.");
    }
    if (values.subject !== undefined) {
      values.subject = String(values.subject).trim();
      if (!values.subject || values.subject.length > 200)
        return fail(res, 400, "Campaign subject is required and cannot exceed 200 characters.");
    }
    if (values.channel !== undefined) {
      values.channel = String(values.channel).trim().toLowerCase();
      if (!["email", "sms"].includes(values.channel))
        return fail(res, 400, "Campaign channel must be email or sms.");
    }
    if (values.audience !== undefined) {
      values.audience = String(values.audience).trim();
      if (!values.audience || values.audience.length > 120)
        return fail(res, 400, "Campaign audience is required and cannot exceed 120 characters.");
    }
    if (values.content !== undefined) {
      values.content = String(values.content);
      if (values.content.length > 50000)
        return fail(res, 400, "Campaign content cannot exceed 50,000 characters.");
    }
    if (
      values.status !== undefined &&
      !["Draft", "Scheduled", "Active", "Paused"].includes(values.status)
    )
      return fail(
        res,
        400,
        "Campaign status is invalid. Sent campaigns can only be set by a delivery workflow.",
      );
    if (
      values.scheduledAt !== undefined &&
      values.scheduledAt !== null &&
      values.scheduledAt !== ""
    ) {
      const scheduledAt = new Date(values.scheduledAt);
      if (Number.isNaN(scheduledAt.getTime()))
        return fail(res, 400, "Campaign schedule date is invalid.");
      if (scheduledAt <= new Date())
        return fail(res, 400, "Campaign schedule date must be in the future.");
      values.scheduledAt = scheduledAt;
    }
    if (values.status === "Scheduled" && !(values.scheduledAt || row.scheduledAt))
      return fail(res, 400, "Choose a schedule date for a scheduled campaign.");
    const effectiveSchedule =
      values.scheduledAt === undefined ? row.scheduledAt : values.scheduledAt;
    if (
      values.status === "Scheduled" &&
      effectiveSchedule &&
      new Date(effectiveSchedule) <= new Date()
    )
      return fail(res, 400, "Campaign schedule date must be in the future.");
    if (values.status && values.status !== "Scheduled" && values.scheduledAt === undefined)
      values.scheduledAt = null;
  }
  if (resource === "customers") {
    const allowed = new Set(["name", "email", "location", "status"]);
    if (Object.keys(values).some((key) => !allowed.has(key)))
      return fail(res, 400, "Customer updates support only name, email, location, and status.");
    if (values.name !== undefined && String(values.name).trim().length < 2)
      return fail(res, 400, "Name must contain at least 2 characters.");
    if (values.email !== undefined) {
      values.email = values.email ? String(values.email).trim().toLowerCase() : null;
      if (values.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email))
        return fail(res, 400, "Email address is invalid.");
    }
    if (values.status !== undefined && !["active", "suspended"].includes(values.status))
      return fail(res, 400, "Status must be active or suspended.");
  }
  if (resource === "promotions") {
    if (values.code !== undefined) values.code = String(values.code).trim().toUpperCase();
    if (
      (values.type && values.type !== "free_product") ||
      (values.type === "free_product" && !values.promotionalVariantId && !row.promotionalVariantId)
    )
      return fail(
        res,
        400,
        "Only free-product promotions with a configured variant are currently supported.",
      );
  }
  if (resource === "categories") {
    if (typeof values.image === "string" && values.image.startsWith("data:"))
      return fail(res, 400, "Upload the category image as a multipart file in the image field.");
    if (req.files?.image?.[0]) values.image = `/uploads/${req.files.image[0].filename}`;
    values.metaTitle = values.meta_title;
    values.metaDescription = values.meta_description;
    values.robotsMetaTag = values.robots_meta_tag;
    values.showOnHomePage = values.show_on_home_page;
    for (const k of ["meta_title", "meta_description", "robots_meta_tag", "show_on_home_page"])
      delete values[k];
  }
  if (resource === "orders" && !Object.keys(values).every((k) => k === "status"))
    return fail(res, 400, "Only order status can be updated.");
  await row.update(values);
  if (resource === "customers" && values.status === "suspended")
    await row.update({ refreshTokenHash: null });
  await clearCache();
  await AuditLog.create({
    actorUserId: req.user.id,
    action: `${resource}.update`,
    resourceType: resource,
    resourceId: row.id,
    changes: values,
    ipAddress: req.ip,
  });
  return ok(res, row, "Record updated.");
};

export const adminDelete = async (req, res) => {
  const M = map[req.params.resource];
  if (!M) return fail(res, 404, "Resource not found.");
  const row = await M.findByPk(req.params.id);
  if (!row) return fail(res, 404, "Record not found.");
  if (req.params.resource === "campaigns" && !["Draft", "Paused"].includes(row.status))
    return fail(res, 409, "Only draft or paused campaigns can be deleted.");
  if (req.params.resource === "customers")
    await row.update({ status: "suspended", refreshTokenHash: null });
  else await row.destroy();
  await clearCache();
  await AuditLog.create({
    actorUserId: req.user.id,
    action: `${req.params.resource}.delete`,
    resourceType: req.params.resource,
    resourceId: row.id,
    changes: {},
    ipAddress: req.ip,
  });
  return ok(res, null, "Record removed.");
};

export const adminPermissions = async (_req, res) =>
  ok(res, await Permission.findAll({ order: [["code", "ASC"]] }), "Permissions loaded.");
export const adminRoles = async (_req, res) =>
  ok(
    res,
    await Role.findAll({
      include: [{ model: Permission, as: "permissions", through: { attributes: [] } }],
      order: [["name", "ASC"]],
    }),
    "Roles loaded.",
  );

export const adminRoleCreate = async (req, res) => {
  const name = String(req.body.name || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "");
  const codes = Array.isArray(req.body.permissions) ? req.body.permissions : [];
  if (!/^[a-z][a-z0-9_-]{1,79}$/.test(name))
    return fail(
      res,
      400,
      "Role name must be 2 to 80 lowercase letters, numbers, underscores or hyphens.",
    );
  const permissions = await Permission.findAll({ where: { code: { [Op.in]: codes } } });
  if (permissions.length !== new Set(codes).size)
    return fail(res, 400, "One or more permissions are unknown.");
  try {
    const role = await Role.create({
      name,
      description: String(req.body.description || "").slice(0, 255),
    });
    await role.setPermissions(permissions);
    await AuditLog.create({
      actorUserId: req.user.id,
      action: "role.create",
      resourceType: "role",
      resourceId: role.id,
      changes: { name, permissions: codes },
      ipAddress: req.ip,
    });
    return ok(res, role, "Role created.", null, 201);
  } catch (error) {
    if (error.name === "SequelizeUniqueConstraintError")
      return fail(res, 409, "Role name already exists.");
    throw error;
  }
};

export const adminRoleUpdate = async (req, res) => {
  const role = await Role.findByPk(req.params.roleId);
  if (!role) return fail(res, 404, "Role not found.");
  if (role.name === "admin")
    return fail(res, 403, "The built-in administrator role cannot be edited.");
  const permissions = await Permission.findAll({
    where: { code: { [Op.in]: Array.isArray(req.body.permissions) ? req.body.permissions : [] } },
  });
  if (permissions.length !== new Set(req.body.permissions || []).size)
    return fail(res, 400, "One or more permissions are unknown.");
  if (req.body.description !== undefined)
    await role.update({ description: String(req.body.description).slice(0, 255) });
  await role.setPermissions(permissions);
  await AuditLog.create({
    actorUserId: req.user.id,
    action: "role.permissions.update",
    resourceType: "role",
    resourceId: role.id,
    changes: { permissions: permissions.map((p) => p.code) },
    ipAddress: req.ip,
  });
  return ok(
    res,
    await Role.findByPk(role.id, {
      include: [{ model: Permission, as: "permissions", through: { attributes: [] } }],
    }),
    "Role updated.",
  );
};

export const adminAssignRoles = async (req, res) => {
  const user = await User.findByPk(req.params.userId);
  if (!user) return fail(res, 404, "User not found.");
  const roles = await Role.findAll({
    where: { id: { [Op.in]: Array.isArray(req.body.roleIds) ? req.body.roleIds : [] } },
  });
  if (!roles.length || roles.length !== new Set(req.body.roleIds || []).size)
    return fail(res, 400, "Select one or more valid roles.");
  if (roles.some((role) => role.name === "admin") && req.user.role !== "admin")
    return fail(res, 403, "Only an administrator can grant administrator access.");
  await user.setRoles(roles);
  const primaryRole = roles.find((role) => role.name === "admin") || roles[0];
  await user.update({
    roleId: primaryRole.id,
    role: roles.some((role) => role.name === "admin") ? "admin" : "user",
  });
  await AuditLog.create({
    actorUserId: req.user.id,
    action: "user.roles.update",
    resourceType: "user",
    resourceId: user.id,
    changes: { roles: roles.map((role) => role.name) },
    ipAddress: req.ip,
  });
  return ok(
    res,
    { id: user.id, roles: roles.map((role) => ({ id: role.id, name: role.name })) },
    "User roles updated.",
  );
};

export const adminUsers = async (req, res) => {
  const { page, limit, offset } = paging(req);
  const { rows, count } = await User.findAndCountAll({
    include: [{ model: Role, as: "primaryRole", attributes: ["id", "name"] }],
    limit,
    offset,
    order: [["createdAt", "DESC"]],
    distinct: true,
  });
  return ok(
    res,
    rows.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      isVerified: user.isVerified,
      status: user.status,
      role: user.role,
      primaryRoleId: user.roleId,
      primaryRole: user.primaryRole?.name || null,
      createdAt: user.createdAt,
    })),
    "Users loaded.",
    {
      totalRecords: count,
      totalPages: Math.ceil(count / limit),
      currentPage: page,
    },
  );
};

export const adminUserPermissions = async (req, res) => {
  if (req.user.role !== "admin")
    return fail(res, 403, "Only an administrator can manage individual user permissions.");
  const user = await User.findByPk(req.params.userId, {
    include: [
      { model: Permission, as: "directPermissions", through: { attributes: [] } },
      {
        model: Role,
        as: "roles",
        through: { attributes: [] },
        include: [{ model: Permission, as: "permissions", through: { attributes: [] } }],
      },
    ],
  });
  if (!user) return fail(res, 404, "User not found.");

  if (req.method === "PUT") {
    const codes = req.body.permissions;
    if (!Array.isArray(codes) || codes.some((code) => typeof code !== "string"))
      return fail(res, 400, "Permissions must be an array of permission codes.");
    const uniqueCodes = [...new Set(codes)];
    const permissions = await Permission.findAll({ where: { code: { [Op.in]: uniqueCodes } } });
    if (permissions.length !== uniqueCodes.length)
      return fail(res, 400, "One or more permissions are unknown.");

    const previous = user.directPermissions.map((permission) => permission.code);
    await sequelize.transaction(async (transaction) => {
      await user.setDirectPermissions(permissions, { transaction });
      await AuditLog.create(
        {
          actorUserId: req.user.id,
          action: "user.permissions.update",
          resourceType: "user",
          resourceId: user.id,
          changes: { previous, permissions: uniqueCodes },
          ipAddress: req.ip,
        },
        { transaction },
      );
    });
    user.directPermissions = permissions;
  }

  const rolePermissions = [
    ...new Set(user.roles.flatMap((role) => role.permissions.map((permission) => permission.code))),
  ];
  const directPermissions = user.directPermissions.map((permission) => permission.code);
  return ok(
    res,
    {
      userId: user.id,
      primaryRoleId: user.roleId,
      roles: user.roles.map((role) => ({ id: role.id, name: role.name })),
      rolePermissions,
      directPermissions,
      effectivePermissions: [...new Set([...rolePermissions, ...directPermissions])].sort(),
    },
    req.method === "PUT" ? "User permissions updated." : "User permissions loaded.",
  );
};

export const adminAbandonedCarts = async (req, res) => {
  const { page, limit, offset } = paging(req);
  const { rows, count } = await CartSession.findAndCountAll({
    where: { status: "abandoned" },
    include: [
      {
        model: Cart,
        include: [
          { model: User, as: "user", attributes: ["id", "name", "email", "phone"] },
          { model: CartItem, as: "items" },
        ],
      },
    ],
    limit,
    offset,
    order: [["abandonedAt", "DESC"]],
    distinct: true,
  });
  return ok(res, rows, "Abandoned carts loaded.", {
    totalRecords: count,
    totalPages: Math.ceil(count / limit),
    currentPage: page,
  });
};

export const adminAuditLog = async (req, res) => {
  const { page, limit, offset } = paging(req);
  const { rows, count } = await AuditLog.findAndCountAll({
    include: [{ model: User, as: "actor", attributes: ["id", "name", "email"] }],
    limit,
    offset,
    order: [["createdAt", "DESC"]],
    distinct: true,
  });
  return ok(res, rows, "Audit history loaded.", {
    totalRecords: count,
    totalPages: Math.ceil(count / limit),
    currentPage: page,
  });
};

export const adminCreateCustomer = async (req, res) => {
  const name = String(req.body.name || "").trim();
  const email = req.body.email ? String(req.body.email).trim().toLowerCase() : null;
  const phone = req.body.phone ? String(req.body.phone).replace(/[\s()-]/g, "") : null;
  if (name.length < 2 || !phone)
    return fail(res, 400, "Name and mobile number are required. Email is optional.");
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return fail(res, 400, "Email address is invalid.");
  if (phone && !/^\+[1-9]\d{7,14}$/.test(phone))
    return fail(res, 400, "Phone must use international format.");
  const where = { [Op.or]: [{ phone }, ...(email ? [{ email }] : [])] };
  if (await User.unscoped().findOne({ where }))
    return fail(res, 409, "Email or mobile number already belongs to an account.");
  const roleIds = Array.isArray(req.body.roleIds) ? req.body.roleIds : [];
  const roles = roleIds.length
    ? await Role.findAll({ where: { id: { [Op.in]: roleIds } } })
    : await Role.findAll({ where: { name: "customer" } });
  if (!roles.length || (roles.length !== new Set(roleIds).size && roleIds.length))
    return fail(res, 400, "Select valid role IDs.");
  if (roles.some((role) => role.name === "admin") && req.user.role !== "admin")
    return fail(res, 403, "Only an administrator can assign administrator access.");
  const primaryRole = roles.find((role) => role.name === "admin") || roles[0];
  const user = await User.create({
    name,
    email,
    phone,
    roleId: primaryRole.id,
    role: roles.some((role) => role.name === "admin") ? "admin" : "user",
    status: "active",
    isVerified: false,
  });
  await user.setRoles(roles);
  await AuditLog.create({
    actorUserId: req.user.id,
    action: "user.create",
    resourceType: "user",
    resourceId: user.id,
    changes: { email, phone, roles: roles.map((role) => role.name) },
    ipAddress: req.ip,
  });
  return ok(
    res,
    {
      id: user.id,
      name,
      email,
      phone,
      isVerified: false,
      roles: roles.map((role) => role.name),
      verificationRequired: true,
    },
    "Account created; user must verify their mobile number before signing in.",
    null,
    201,
  );
};
