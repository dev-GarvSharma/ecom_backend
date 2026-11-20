import { Op } from "sequelize";
import { Order, OrderItem, User } from "../database/models/index.js";
import { sendGridConfig, sendGridMail } from "./sendgrid.js";

const escapeHtml = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character],
  );

const money = (amount, currency) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency }).format(Number(amount));

const sendOrderConfirmationEmailUnsafe = async (orderId) => {
  const staleSendingBefore = new Date(Date.now() - 10 * 60 * 1000);
  const [claimed] = await Order.update(
    { confirmationEmailStatus: "sending" },
    {
      where: {
        id: orderId,
        paymentStatus: "Paid",
        [Op.or]: [
          { confirmationEmailStatus: { [Op.in]: ["pending", "failed"] } },
          { confirmationEmailStatus: "sending", updatedAt: { [Op.lt]: staleSendingBefore } },
        ],
      },
    },
  );
  if (!claimed) return false;

  try {
    const order = await Order.findByPk(orderId, {
      include: [
        { model: User, as: "customer", attributes: ["name", "email"] },
        {
          model: OrderItem,
          as: "items",
          attributes: ["name", "sku", "variantOptions", "quantity", "unitPrice"],
        },
      ],
    });
    if (!order?.customer?.email) throw new Error("Order customer has no email address.");
    const { from } = sendGridConfig();
    const customer = order.customer;
    const address = order.shippingAddress || {};
    const itemRows = order.items.map((item) => {
      const options =
        item.variantOptions && typeof item.variantOptions === "object"
          ? Object.values(item.variantOptions).filter(Boolean).join(" / ")
          : "";
      const title = [item.name, options].filter(Boolean).join(" — ");
      return {
        label: `${title} × ${item.quantity}`,
        lineTotal: money(Number(item.unitPrice) * item.quantity, order.currency),
      };
    });
    const addressLines = [
      address.recipient,
      address.line1,
      address.line2,
      [address.city, address.state, address.postalCode].filter(Boolean).join(", "),
      address.country,
      address.phone,
    ].filter(Boolean);
    const totals = [
      ["Subtotal", order.subtotal],
      ...(Number(order.discount) ? [["Discount", -Number(order.discount)]] : []),
      ["Shipping", order.shipping],
      ["Total paid", order.total],
    ];
    const text = [
      `Hi ${customer.name || "there"},`,
      "",
      "Thank you for your order. Your payment has been confirmed and we’re preparing your items.",
      `Order: ${order.orderNumber}`,
      `Payment: Paid${order.paymentId ? ` (reference ${order.paymentId})` : ""}`,
      "",
      "Items:",
      ...itemRows.map((item) => `${item.label} — ${item.lineTotal}`),
      "",
      ...totals.map(([label, amount]) => `${label}: ${money(amount, order.currency)}`),
      "",
      "Shipping address:",
      ...addressLines,
      "",
      "If you need help with your order, reply to this email.",
    ].join("\n");
    const html = `<div style="max-width:600px;margin:auto;font-family:Arial,sans-serif;color:#222;line-height:1.6"><h1 style="font-size:24px">Order confirmed</h1><p>Hi ${escapeHtml(customer.name || "there")},</p><p>Thank you for your order. Your payment has been confirmed and we’re preparing your items.</p><p><strong>Order:</strong> ${escapeHtml(order.orderNumber)}<br><strong>Payment:</strong> Paid${order.paymentId ? ` (${escapeHtml(order.paymentId)})` : ""}</p><h2 style="font-size:18px">Order details</h2><table style="width:100%;border-collapse:collapse"><tbody>${itemRows.map((item) => `<tr><td style="padding:8px 0;border-bottom:1px solid #eee">${escapeHtml(item.label)}</td><td style="padding:8px 0;border-bottom:1px solid #eee;text-align:right">${escapeHtml(item.lineTotal)}</td></tr>`).join("")}${totals.map(([label, amount]) => `<tr><td style="padding:6px 0">${escapeHtml(label)}</td><td style="padding:6px 0;text-align:right"><strong>${escapeHtml(money(amount, order.currency))}</strong></td></tr>`).join("")}</tbody></table><h2 style="font-size:18px">Shipping address</h2><p>${addressLines.map(escapeHtml).join("<br>")}</p><p>If you need help with your order, reply to this email.</p></div>`;
    await sendGridMail({
      personalizations: [
        { to: [{ email: customer.email, ...(customer.name ? { name: customer.name } : {}) }] },
      ],
      from,
      ...(process.env.SENDGRID_REPLY_TO_EMAIL
        ? { reply_to: { email: process.env.SENDGRID_REPLY_TO_EMAIL } }
        : {}),
      subject: `Order confirmed: ${order.orderNumber}`,
      content: [
        { type: "text/plain", value: text },
        { type: "text/html", value: html },
      ],
      categories: ["order-confirmation"],
    });
    await Order.update(
      { confirmationEmailStatus: "sent" },
      { where: { id: orderId, confirmationEmailStatus: "sending" } },
    );
    return true;
  } catch (error) {
    console.error(`Order confirmation email failed for ${orderId}:`, error.message);
    await Order.update(
      { confirmationEmailStatus: "failed" },
      { where: { id: orderId, confirmationEmailStatus: "sending" } },
    );
    return false;
  }
};

export const sendOrderConfirmationEmail = async (orderId) => {
  try {
    return await sendOrderConfirmationEmailUnsafe(orderId);
  } catch (error) {
    console.error(`Order confirmation email could not be processed for ${orderId}:`, error.message);
    return false;
  }
};
