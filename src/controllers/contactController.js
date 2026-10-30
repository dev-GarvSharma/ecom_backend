import {
  AuditLog,
  Cart,
  CartItem,
  CartSession,
  ContactMessage,
  Product,
  ProductVariant,
  User,
} from "../database/models/index.js";
import { fail, ok } from "../utils/http.js";
import { sendGridConfig, sendGridMail } from "../services/sendgrid.js";
import { campaignUnsubscribeUrl, signedUnsubscribeToken } from "./marketingController.js";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const paging = (req) => {
  const page = Math.max(1, Number.parseInt(req.query.page || "1", 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.recordPerPage || "20", 10) || 20));
  return { page, limit, offset: (page - 1) * limit };
};

export const createContactMessage = async (req, res) => {
  // Silently accept bot submissions that fill the hidden honeypot field.
  if (req.body.website) return ok(res, null, "Your message has been received.", null, 201);

  const name = String(req.body.name || "").trim();
  const email = String(req.body.email || "").trim().toLowerCase();
  const phone = String(req.body.phone || "").trim();
  const subject = String(req.body.subject || "").trim();
  const message = String(req.body.message || "").trim();
  if (name.length < 2 || name.length > 120)
    return fail(res, 400, "Name must be between 2 and 120 characters.");
  if (email.length > 254 || !emailPattern.test(email))
    return fail(res, 400, "Enter a valid email address.");
  const phoneDigits = phone.match(/\d/g) || [];
  if (
    !phone ||
    phone.length > 30 ||
    !/^[+()\d\s.-]+$/.test(phone) ||
    phoneDigits.length < 7 ||
    phoneDigits.length > 15
  )
    return fail(res, 400, "Enter a valid phone number with 7 to 15 digits.");
  if (subject.length < 2 || subject.length > 180)
    return fail(res, 400, "Issue must be between 2 and 180 characters.");
  if (message.length < 10 || message.length > 10000)
    return fail(res, 400, "Message must be between 10 and 10,000 characters.");

  const record = await ContactMessage.create({
    name,
    email,
    phone,
    subject,
    message,
  });
  return ok(res, { id: record.id }, "Your message has been received.", null, 201);
};

export const adminContactMessages = async (req, res) => {
  const { page, limit, offset } = paging(req);
  const status = String(req.query.status || "");
  const where = ["new", "in_progress", "resolved"].includes(status) ? { status } : {};
  const { rows, count } = await ContactMessage.findAndCountAll({
    where,
    limit,
    offset,
    order: [["createdAt", "DESC"]],
  });
  return ok(res, rows, "Contact messages loaded.", {
    totalRecords: count,
    totalPages: Math.ceil(count / limit),
    currentPage: page,
  });
};

export const updateContactMessage = async (req, res) => {
  const message = await ContactMessage.findByPk(req.params.id);
  if (!message) return fail(res, 404, "Contact message not found.");

  const values = {};
  if (req.body.status !== undefined) {
    if (!["new", "in_progress", "resolved"].includes(req.body.status))
      return fail(res, 400, "Status must be new, in_progress, or resolved.");
    values.status = req.body.status;
  }
  if (req.body.adminNote !== undefined) {
    if (typeof req.body.adminNote !== "string" || req.body.adminNote.length > 5000)
      return fail(res, 400, "Admin note must be text up to 5,000 characters.");
    values.adminNote = req.body.adminNote.trim() || null;
  }
  if (!Object.keys(values).length) return fail(res, 400, "Provide a status or admin note to update.");

  await message.update(values);
  await AuditLog.create({
    actorUserId: req.user.id,
    action: "contact_message.update",
    resourceType: "contact_message",
    resourceId: message.id,
    changes: values,
    ipAddress: req.ip,
  });
  return ok(res, message, "Contact message updated.");
};

const escapeHtml = (value) =>
  String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]);

const storefrontCartUrl = () => {
  const origin = String(process.env.WEB_PUBLIC_URL || process.env.WEB_ORIGINS || "")
    .split(",")[0]
    .trim();
  if (!origin) throw Object.assign(new Error("Set WEB_PUBLIC_URL for cart recovery emails."), { status: 503 });
  let base;
  try {
    base = new URL(origin);
  } catch {
    throw Object.assign(new Error("WEB_PUBLIC_URL must be a valid storefront URL."), { status: 503 });
  }
  if (process.env.NODE_ENV === "production" && base.protocol !== "https:")
    throw Object.assign(new Error("WEB_PUBLIC_URL must use HTTPS in production."), { status: 503 });
  return new URL("/cart", base).toString();
};

export const sendAbandonedCartRecovery = async (req, res) => {
  const session = await CartSession.findOne({
    where: { id: req.params.id, status: "abandoned" },
    include: [
      {
        model: Cart,
        include: [
          { model: User, as: "user", attributes: ["id", "name", "email", "status", "isVerified", "marketingEmailSubscribed"] },
          {
            model: CartItem,
            as: "items",
            include: [
              {
                model: ProductVariant,
                as: "variant",
                include: [{ model: Product, as: "product", attributes: ["name"] }],
              },
            ],
          },
        ],
      },
    ],
  });
  if (!session) return fail(res, 404, "Abandoned cart not found.");
  if (session.recoverySentAt) return fail(res, 409, "A recovery email has already been sent for this cart.");

  const customer = session.Cart?.user;
  const items = session.Cart?.items || [];
  if (!customer?.email || customer.status !== "active" || !customer.isVerified)
    return fail(res, 409, "This customer has no active, verified email address.");
  if (!customer.marketingEmailSubscribed)
    return fail(res, 409, "This customer has not subscribed to marketing email.");
  if (!items.length) return fail(res, 409, "This cart no longer contains items.");

  let sendGrid;
  let cartUrl;
  let unsubscribeUrl;
  try {
    sendGrid = sendGridConfig();
    cartUrl = storefrontCartUrl();
    unsubscribeUrl = campaignUnsubscribeUrl(req, signedUnsubscribeToken(customer.id));
  } catch (error) {
    return fail(res, error.status || 503, error.message);
  }

  const productLines = items
    .map((item) => `${item.variant?.product?.name || "Item"} × ${item.quantity}`)
    .map(escapeHtml);
  const text = `Hi ${customer.name || "there"},\n\nYou left items in your cart:\n${productLines.join("\n")}\n\nContinue shopping: ${cartUrl}\n\nUnsubscribe from marketing emails: ${unsubscribeUrl}`;
  const html = `<p>Hi ${escapeHtml(customer.name || "there")},</p><p>You left these items in your cart:</p><ul>${productLines.map((line) => `<li>${line}</li>`).join("")}</ul><p><a href="${escapeHtml(cartUrl)}">Return to your cart</a></p><hr><p style="font:12px Arial,sans-serif;color:#777"><a href="${escapeHtml(unsubscribeUrl)}">Unsubscribe from marketing emails</a></p>`;

  try {
    await sendGridMail({
      personalizations: [{
        to: [{ email: customer.email, ...(customer.name ? { name: customer.name } : {}) }],
        headers: {
          "List-Unsubscribe": `<${unsubscribeUrl}>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
      }],
      from: sendGrid.from,
      ...(process.env.SENDGRID_REPLY_TO_EMAIL ? { reply_to: { email: process.env.SENDGRID_REPLY_TO_EMAIL } } : {}),
      subject: "Your cart is waiting",
      content: [
        { type: "text/plain", value: text },
        { type: "text/html", value: html },
      ],
      categories: ["abandoned-cart-recovery"],
    });
  } catch (error) {
    return fail(res, error.status || 502, error.message);
  }

  const sentAt = new Date();
  await session.update({ recoverySentAt: sentAt });
  await AuditLog.create({
    actorUserId: req.user.id,
    action: "cart.recovery_email.send",
    resourceType: "cart_session",
    resourceId: session.id,
    changes: { email: customer.email, recoverySentAt: sentAt },
    ipAddress: req.ip,
  });
  return ok(res, { recoverySentAt: sentAt }, "Cart recovery email accepted by SendGrid.");
};
