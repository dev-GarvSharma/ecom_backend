import "dotenv/config";
import express from "express";
import helmet from "helmet";
import cors from "cors";
import compression from "compression";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import path from "node:path";
import { Op } from "sequelize";
import routes from "./routes/indexRoutes.js";
import sequelize from "./config/database.js";
import { CartSession, CartItem, UserInteractionEvent, Campaign, CampaignDelivery } from "./database/models/index.js";
import "./database/models/index.js";
import { asyncHandler, fail } from "./utils/http.js";
import { razorpayWebhook } from "./controllers/razorpayWebhookController.js";
for (const k of [
  "MYSQL_DATABASE",
  "MYSQL_USER",
  "MYSQL_PASSWORD",
  "JWT_ACCESS_SECRET",
  "JWT_REFRESH_SECRET",
])
  if (!process.env[k]) throw new Error(`${k} is required`);
if (
  process.env.NODE_ENV === "production" &&
  ["JWT_ACCESS_SECRET", "JWT_REFRESH_SECRET"].some((k) => process.env[k].length < 32)
)
  throw new Error("Production JWT secrets must each contain at least 32 characters.");
if (process.env.NODE_ENV === "production" && process.env.COOKIE_SECURE !== "true")
  throw new Error("COOKIE_SECURE=true is required in production.");
if (
  process.env.NODE_ENV === "production" &&
  (!process.env.OTP_DELIVERY_URL || !process.env.OTP_DELIVERY_TOKEN)
)
  throw new Error(
    "OTP_DELIVERY_URL and OTP_DELIVERY_TOKEN are required in production for verified sign-in.",
  );
if (
  process.env.NODE_ENV === "production" &&
  ["RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET", "RAZORPAY_WEBHOOK_SECRET"].some(
    (key) => !process.env[key],
  )
)
  throw new Error("Razorpay API and webhook secrets are required for prepaid production checkout.");
const app = express();
if (Number(process.env.TRUST_PROXY)) app.set("trust proxy", Number(process.env.TRUST_PROXY));
app.disable("x-powered-by");
app.use((req, res, next) => {
  const startedAt = Date.now();
  res.once("finish", () => {
    process.stdout.write(
      `[api] ${req.method} ${req.path} ${res.statusCode} ${Date.now() - startedAt}ms\n`,
    );
  });
  next();
});
app.use(helmet());
const origins = (process.env.WEB_ORIGINS || "http://localhost:5173")
  .split(",")
  .map((x) => x.trim());
app.use(
  cors({
    origin(o, cb) {
      if (!o || origins.includes(o)) return cb(null, true);
      cb(new Error("CORS origin denied"));
    },
    credentials: true,
  }),
);
app.use(compression());
app.use(
  rateLimit({
    windowMs: 60000,
    limit: 240,
    standardHeaders: true,
    legacyHeaders: false,
  }),
);
const apiPrefix = (process.env.API_PREFIX || "/api/v1").replace(/\/$/, "");
app.post(
  `${apiPrefix}/webhooks/razorpay`,
  express.raw({ type: "application/json", limit: "1mb" }),
  asyncHandler(razorpayWebhook),
);
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: false, limit: "1mb" }));
app.use(cookieParser());
app.use(
  "/uploads",
  express.static(path.resolve(process.env.UPLOAD_DIR || "storage/uploads"), {
    dotfiles: "deny",
    index: false,
    maxAge: "1d",
    setHeaders(res) {
      res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    },
  }),
);
app.use(apiPrefix, routes);
app.use((_q, s) => fail(s, 404, "Route not found."));
app.use((e, _q, s, _n) => {
  if (e.type === "entity.too.large") return fail(s, 413, "Request too large.");
  if (e.code === "LIMIT_FILE_SIZE") return fail(s, 413, "Image exceeds upload limit.");
  if (e.code === "LIMIT_UNEXPECTED_FILE")
    return fail(s, 400, "Use the 'images' or 'image' field for up to 8 image files.");
  if (e.message === "Unsupported image type.")
    return fail(s, 400, "Use JPEG, PNG, WebP, or AVIF image files.");
  if (e.message === "CORS origin denied") return fail(s, 403, "Origin not allowed.");
  process.stderr.write(`${e.stack || e}\n`);
  return fail(s, e.status || 500, e.status ? e.message : "Unexpected server error.");
});
const start = async () => {
  await sequelize.authenticate();
  const interruptedCampaigns = await Campaign.findAll({ where: { status: "Sending" }, attributes: ["id"] });
  for (const campaign of interruptedCampaigns) {
    await CampaignDelivery.update(
      { status: "failed", error: "Sending process stopped before completion; review provider activity before retrying." },
      { where: { campaignId: campaign.id, status: "queued" } },
    );
    await campaign.update({ status: "Failed" });
  }
  const expireStaleCarts = async () => {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const stale = await CartSession.findAll({
      where: { status: "active", lastActivityAt: { [Op.lt]: cutoff } },
      limit: 500,
    });
    for (const session of stale) {
      if (!(await CartItem.count({ where: { cartId: session.cartId } }))) continue;
      const [changed] = await CartSession.update(
        { status: "abandoned", abandonedAt: new Date() },
        { where: { id: session.id, status: "active" } },
      );
      if (changed)
        await UserInteractionEvent.create({
          cartId: session.cartId,
          eventType: "cart.auto_abandoned",
          details: { idleHours: 24 },
        });
    }
  };
  await expireStaleCarts().catch((error) =>
    process.stderr.write(`Abandoned cart job failed: ${error.message}\n`),
  );
  setInterval(
    () =>
      expireStaleCarts().catch((error) =>
        process.stderr.write(`Abandoned cart job failed: ${error.message}\n`),
      ),
    15 * 60 * 1000,
  ).unref();
  const port = Number(process.env.PORT || 4000);
  app.listen(port, () => process.stdout.write(`Ecom API listening on ${port}\n`));
};
if (process.env.NODE_ENV !== "test")
  start().catch((e) => {
    process.stderr.write(`Startup failed: ${e.message}\n`);
    process.exit(1);
  });
export default app;
