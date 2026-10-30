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
import validateEnvironment from "./config/validateEnvironment.js";
import errorHandler from "./middleware/errorHandler.js";
import { runStartupMaintenance } from "./services/startupMaintenance.js";
import "./database/models/index.js";
import { asyncHandler, fail } from "./utils/http.js";
import { razorpayWebhook } from "./controllers/razorpayWebhookController.js";

// Load dotenv first, then fail fast if required runtime settings are missing or unsafe.
validateEnvironment();

const app = express();
if (Number(process.env.TRUST_PROXY)) app.set("trust proxy", Number(process.env.TRUST_PROXY));
app.disable("x-powered-by");

// Log each request's method, path, response status, and duration for basic API observability.
app.use((req, res, next) => {
  const startedAt = Date.now();
  res.once("finish", () => {
    process.stdout.write(
      `[api] ${req.method} ${req.path} ${res.statusCode} ${Date.now() - startedAt}ms\n`,
    );
  });
  next();
});

// Apply security headers and allow credentialed requests from configured storefront origins.
app.use(helmet());
const origins = (process.env.WEB_ORIGINS || "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim());
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || origins.includes(origin)) return callback(null, true);
      callback(new Error("CORS origin denied"));
    },
    credentials: true,
  }),
);

// Compress responses and cap request rates before application routes run.
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

// Keep the raw webhook body so Razorpay request signatures can be verified.
app.post(
  `${apiPrefix}/webhooks/razorpay`,
  express.raw({ type: "application/json", limit: "1mb" }),
  asyncHandler(razorpayWebhook),
);

// Parse JSON, form, and cookie data for regular application requests.
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: false, limit: "1mb" }));
app.use(cookieParser());

// Serve uploaded files without directory listings or dotfile access.
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

// Mount versioned endpoints, return a consistent 404, and format request errors centrally.
app.use(apiPrefix, routes);
app.use((_req, res) => fail(res, 404, "Route not found."));
app.use(errorHandler);

const start = async () => {
  await sequelize.authenticate();

  // Reconcile interrupted campaigns and start periodic abandoned-cart cleanup.
  await runStartupMaintenance();

  const port = Number(process.env.PORT || 4000);
  app.listen(port, () => process.stdout.write(`Ecom API listening on ${port}\n`));
};

if (process.env.NODE_ENV !== "test")
  start().catch((error) => {
    process.stderr.write(`Startup failed: ${error.message}\n`);
    process.exit(1);
  });

export default app;
