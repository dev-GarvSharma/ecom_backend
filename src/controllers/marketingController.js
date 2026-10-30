import jwt from "jsonwebtoken";
import { Op } from "sequelize";
import {
  AuditLog,
  Campaign,
  CampaignDelivery,
  User,
} from "../database/models/index.js";
import { fail, ok } from "../utils/http.js";
import { sendGridConfig, sendGridMail } from "../services/sendgrid.js";

const eligibleWhere = {
  role: "user",
  status: "active",
  isVerified: true,
  marketingEmailSubscribed: true,
  email: { [Op.ne]: null },
};
const plainText = (html) => html
  .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
  .replace(/<\/(p|div|li|h[1-6]|tr)>/gi, "\n")
  .replace(/<br\s*\/?\s*>/gi, "\n")
  .replace(/<[^>]+>/g, " ")
  .replace(/&nbsp;/gi, " ")
  .replace(/&amp;/gi, "&")
  .replace(/&lt;/gi, "<")
  .replace(/&gt;/gi, ">")
  .replace(/&quot;/gi, '"')
  .replace(/&#39;/gi, "'")
  .replace(/[ \t]+/g, " ")
  .replace(/\n\s*\n+/g, "\n\n")
  .trim();
export const signedUnsubscribeToken = (userId) => jwt.sign(
  { sub: userId, scope: "marketing-email-unsubscribe" },
  process.env.JWT_ACCESS_SECRET,
  { algorithm: "HS256", expiresIn: "2y", issuer: "ecom-api", audience: "ecom-marketing" },
);
export const campaignUnsubscribeUrl = (req, token) => {
  let base = process.env.API_PUBLIC_URL;
  if (!base && process.env.NODE_ENV !== "production") base = `${req.protocol}://${req.get("host")}`;
  if (!base) throw Object.assign(new Error("Set API_PUBLIC_URL to enable campaign unsubscribe links."), { status: 503 });
  const url = new URL("/api/v1/marketing/unsubscribe", base);
  if (process.env.NODE_ENV === "production" && url.protocol !== "https:")
    throw Object.assign(new Error("API_PUBLIC_URL must use HTTPS in production."), { status: 503 });
  url.searchParams.set("token", token);
  return url.toString();
};

export const sendCampaign = async (req, res) => {
  const campaign = await Campaign.findByPk(req.params.id);
  if (!campaign) return fail(res, 404, "Campaign not found.");
  if (campaign.channel !== "email") return fail(res, 400, "SendGrid can send email campaigns only.");
  if (!["Draft", "Scheduled", "Active", "Paused"].includes(campaign.status))
    return fail(res, 409, "This campaign has already been sent or is currently being sent.");
  const subject = String(campaign.subject || campaign.name || "").trim();
  const html = String(campaign.content || "").trim();
  if (!subject || !html) return fail(res, 400, "Add an email subject and message content before sending.");

  let sendGrid;
  try {
    sendGrid = sendGridConfig();
    campaignUnsubscribeUrl(req, "configuration-check");
  } catch (error) {
    return fail(res, error.status || 503, error.message);
  }

  const recipientCount = await User.count({ where: eligibleWhere });
  if (!recipientCount)
    return fail(res, 409, "There are no active, verified email subscribers for this campaign.");

  const [claimed] = await Campaign.update(
    { status: "Sending" },
    { where: { id: campaign.id, status: { [Op.in]: ["Draft", "Scheduled", "Active", "Paused"] } } },
  );
  if (!claimed) return fail(res, 409, "Another request has already started this campaign.");

  let accepted = 0;
  let skipped = 0;
  let failed = 0;
  let fatalError = null;
  try {
    const recipients = await User.findAll({
      where: eligibleWhere,
      attributes: ["id", "name", "email"],
      order: [["id", "ASC"]],
    });
    for (let offset = 0; offset < recipients.length; offset += 1000) {
      const snapshot = recipients.slice(offset, offset + 1000);
      await CampaignDelivery.bulkCreate(snapshot.map((user) => ({
        campaignId: campaign.id,
        userId: user.id,
        email: user.email,
        status: "queued",
      })));
    }

    while (true) {
      const pending = await CampaignDelivery.findAll({
        where: { campaignId: campaign.id, status: "queued" },
        include: [{ model: User, as: "recipient", attributes: ["id", "name", "email", "status", "isVerified", "marketingEmailSubscribed"] }],
        order: [["createdAt", "ASC"], ["id", "ASC"]],
        limit: 1000,
      });
      if (!pending.length) break;

      const eligible = pending.filter((delivery) =>
        delivery.recipient?.status === "active" &&
        delivery.recipient?.isVerified &&
        delivery.recipient?.marketingEmailSubscribed &&
        delivery.recipient?.email,
      );
      const excluded = pending.filter((delivery) => !eligible.includes(delivery));
      if (excluded.length) {
        await CampaignDelivery.update(
          { status: "skipped", error: "Recipient no longer has an active email subscription." },
          { where: { id: { [Op.in]: excluded.map((delivery) => delivery.id) } } },
        );
        skipped += excluded.length;
      }
      if (!eligible.length) continue;

      const personalizations = eligible.map((delivery) => {
        const user = delivery.recipient;
        const url = campaignUnsubscribeUrl(req, signedUnsubscribeToken(user.id));
        return {
          to: [{ email: user.email, ...(user.name ? { name: user.name } : {}) }],
          substitutions: { "-unsubscribe_url-": url },
          headers: {
            "List-Unsubscribe": `<${url}>`,
            "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
          },
          custom_args: { campaign_id: campaign.id },
        };
      });
      const footer = `<div style="font:12px/1.5 Arial,sans-serif;color:#777;margin-top:32px;padding-top:16px;border-top:1px solid #ddd"><a href="-unsubscribe_url-">Unsubscribe from marketing emails</a></div>`;
      const messageHtml = /<\/body\s*>/i.test(html)
        ? html.replace(/<\/body\s*>/i, `${footer}</body>`)
        : `${html}${footer}`;
      try {
        const providerMessageId = await sendGridMail({
          personalizations,
          from: sendGrid.from,
          ...(process.env.SENDGRID_REPLY_TO_EMAIL ? { reply_to: { email: process.env.SENDGRID_REPLY_TO_EMAIL } } : {}),
          subject,
          content: [
            { type: "text/plain", value: `${plainText(html)}\n\nUnsubscribe: -unsubscribe_url-` },
            { type: "text/html", value: messageHtml },
          ],
          categories: ["perfume-campaign"],
          custom_args: { campaign_id: campaign.id },
        });
        const now = new Date();
        await CampaignDelivery.update(
          { status: "accepted", acceptedAt: now, providerMessageId },
          { where: { id: { [Op.in]: eligible.map((delivery) => delivery.id) } } },
        );
        accepted += eligible.length;
      } catch (error) {
        fatalError = error;
        await CampaignDelivery.update(
          { status: "failed", error: "SendGrid did not accept this recipient batch." },
          { where: { id: { [Op.in]: eligible.map((delivery) => delivery.id) } } },
        );
        failed += eligible.length;
        break;
      }
    }

    if (fatalError) {
      await CampaignDelivery.update(
        { status: "failed", error: "Not sent because an earlier batch failed." },
        { where: { campaignId: campaign.id, status: "queued" } },
      );
      failed = await CampaignDelivery.count({ where: { campaignId: campaign.id, status: "failed" } });
    }
    const status = failed ? "Failed" : accepted ? "Sent" : "Failed";
    await campaign.update({ status });
    await AuditLog.create({
      actorUserId: req.user.id,
      action: "campaign.send",
      resourceType: "campaign",
      resourceId: campaign.id,
      changes: { status, accepted, skipped, failed },
      ipAddress: req.ip,
    });
    return ok(res, { campaignId: campaign.id, status, accepted, skipped, failed },
      status === "Sent" ? "SendGrid accepted the campaign emails." : "Campaign sending finished with errors.");
  } catch (error) {
    await campaign.update({ status: "Failed" });
    throw error;
  }
};

export const marketingSubscribers = async (req, res) => {
  const page = Math.max(1, Number.parseInt(req.query.page || "1", 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.recordPerPage || "20", 10) || 20));
  const search = String(req.query.search || "").trim().slice(0, 100);
  const where = { ...eligibleWhere };
  if (search)
    where[Op.and] = [{ [Op.or]: [
      { name: { [Op.like]: `%${search}%` } },
      { email: { [Op.like]: `%${search}%` } },
    ] }];
  const { rows, count } = await User.findAndCountAll({
    where,
    attributes: ["id", "name", "email", "marketingEmailSubscribedAt"],
    limit,
    offset: (page - 1) * limit,
    order: [["marketingEmailSubscribedAt", "DESC"]],
  });
  return ok(res, rows, "Email subscribers loaded.", {
    totalRecords: count,
    totalPages: Math.ceil(count / limit),
    currentPage: page,
  });
};

const verifyUnsubscribeToken = (token) => {
  const claims = jwt.verify(token, process.env.JWT_ACCESS_SECRET, {
    algorithms: ["HS256"], issuer: "ecom-api", audience: "ecom-marketing",
  });
  if (claims.scope !== "marketing-email-unsubscribe") throw new Error("Invalid token scope.");
  return claims.sub;
};

export const unsubscribePage = (req, res) => {
  const token = String(req.query.token || "");
  try { verifyUnsubscribeToken(token); } catch {
    return res.status(400).type("html").send("<h1>Unsubscribe link is invalid or expired.</h1>");
  }
  const action = `/api/v1/marketing/unsubscribe?token=${encodeURIComponent(token)}`;
  return res.type("html").send(`<!doctype html><html><meta name="viewport" content="width=device-width,initial-scale=1"><title>Email preferences</title><body style="font:16px Arial,sans-serif;max-width:520px;margin:12vh auto;padding:24px;color:#344238"><h1>Unsubscribe from marketing emails?</h1><p>Confirm to stop receiving promotional email from this store.</p><form method="post" action="${action}"><button style="padding:12px 18px;background:#365c45;color:#fff;border:0;border-radius:5px;cursor:pointer">Unsubscribe</button></form></body></html>`);
};

export const unsubscribe = async (req, res) => {
  const token = String(req.query.token || req.body?.token || "");
  let userId;
  try {
    userId = verifyUnsubscribeToken(token);
  } catch {
    return fail(res, 400, "Unsubscribe link is invalid or expired.");
  }
  const user = await User.unscoped().findByPk(userId);
  if (user?.marketingEmailSubscribed) {
    await user.update({ marketingEmailSubscribed: false, marketingEmailUnsubscribedAt: new Date() });
    const { UserInteractionEvent } = await import("../database/models/index.js");
    await UserInteractionEvent.create({
      userId: user.id,
      eventType: "marketing.email_unsubscribed",
      details: { source: "email_link" },
    });
  }
  if (req.accepts("html"))
    return res.type("html").send("<h1>You are unsubscribed.</h1><p>You will not receive further marketing emails.</p>");
  return ok(res, { unsubscribed: true }, "Email preferences updated.");
};
