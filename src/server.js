import "dotenv/config";
import express from "express";
import helmet from "helmet";
import cors from "cors";
import compression from "compression";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import path from "node:path";
import routes from "./routes/indexRoutes.js";
import sequelize from "./config/database.js";
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
  ["JWT_ACCESS_SECRET", "JWT_REFRESH_SECRET"].some(
    (k) => process.env[k].length < 32,
  )
)
  throw new Error(
    "Production JWT secrets must each contain at least 32 characters.",
  );
const app = express();
if (Number(process.env.TRUST_PROXY))
  app.set("trust proxy", Number(process.env.TRUST_PROXY));
app.disable("x-powered-by");
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
  }),
);
app.use(apiPrefix, routes);
app.use((_q, s) => fail(s, 404, "Route not found."));
app.use((e, _q, s, _n) => {
  if (e.type === "entity.too.large") return fail(s, 413, "Request too large.");
  if (e.code === "LIMIT_FILE_SIZE")
    return fail(s, 413, "Image exceeds upload limit.");
  if (e.code === "LIMIT_UNEXPECTED_FILE")
    return fail(s, 400, "Use the 'images' or 'image' field for up to 8 image files.");
  if (e.message === "Unsupported image type.")
    return fail(s, 400, "Use JPEG, PNG, WebP, or AVIF image files.");
  if (e.message === "CORS origin denied")
    return fail(s, 403, "Origin not allowed.");
  process.stderr.write(`${e.stack || e}\n`);
  return fail(
    s,
    e.status || 500,
    e.status ? e.message : "Unexpected server error.",
  );
});
const start = async () => {
  await sequelize.authenticate();
  const port = Number(process.env.PORT || 4000);
  app.listen(port, () =>
    process.stdout.write(`Ecom API listening on ${port}\n`),
  );
};
if (process.env.NODE_ENV !== "test")
  start().catch((e) => {
    process.stderr.write(`Startup failed: ${e.message}\n`);
    process.exit(1);
  });
export default app;
