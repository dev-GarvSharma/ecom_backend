# E-commerce backend (MySQL)

Express and Sequelize API in a sibling folder to the frontend. Routes use `/api/v1` and admin endpoints align with `src/admin/pages/*/api.js`.

## Start

- Install Node.js 20+ and MySQL 8+. Create a database and least-privileged app user.
- Copy `.env.example` to `.env`; configure MySQL, frontend origins, and two independent random JWT secrets (32+ characters).
- For Razorpay, configure `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, and `RAZORPAY_WEBHOOK_SECRET` from the Razorpay Dashboard. Register `https://<your-domain>/api/v1/webhooks/razorpay` and subscribe to `payment.captured`, `payment.failed`, `order.paid`, and `refund.processed`.
- Run `npm install`, then `npm run db:migrate` once to create or update the database. Start the API with `npm run dev` or `npm start`; server startup does not run migrations.
- Run `npm run db:seed` to add repeatable development fixtures for the admin, customers, categories, products, coupons, orders, notifications, addresses, carts, campaigns, and settings. Test admin login: `admin@gmail.com` / `Admin@123`. Seed customer password: `TestUser@123`. The seed command refuses to run when `NODE_ENV=production`.
- Register a customer and promote the first administrator through a protected operational SQL session: `UPDATE users SET role='admin' WHERE email='...';`. Admin signup is intentionally unavailable.
- Set the frontend API base URL to `http://localhost:4000/api/v1`; send access tokens as Bearer tokens. Refresh credentials use an HttpOnly cookie.

## Project layout

- `src/database/models/` contains one Sequelize model per file and a model association module.
- `src/database/migrations/` contains one migration per table and the migration runner. `npm run db:migrate` applies pending migrations and records them in `schema_migrations`.
- `src/controllers/` contains controllers split by API area.
- `src/routes/` contains route modules split by API area. `indexRoutes.js` mounts the route modules.
- `postman/` contains an endpoint collection organized into API folders and a local environment.

Use `npm run format` to format JavaScript and Postman JSON with Prettier. Use `npm run format:check` to check formatting.

Includes auth, customers, catalog, categories, cart, checkout/order creation, addresses, coupons, notifications, and admin products/categories/orders/customers/inventory/analytics/settings/marketing/campaign APIs. Admin responses include the frontend compatible `data`, `success`, `message`, `statusCode`, and `meta` fields.

Helmet, allowlist CORS, body limits, rate limits, bcrypt, short lived JWT access tokens, hashed rotating refresh tokens, role checks, transactional stock decrement at checkout, parameterized Sequelize access, optional Redis public catalog caching, Razorpay order creation, payment signature verification, webhook signature verification, and a MIME/size limited Multer image middleware are included. Admin product create/update accepts multipart image files in the `images` or `image` field and stores each `/uploads/...` path in `product_images`. Category create/update accepts an optional multipart `image` file and stores its path in `categories.image`. Base64 data URIs must be sent as files using `multipart/form-data`. Checkout accepts `paymentMode: "COD"`, `"UPI"`, or `"CARD"`. COD orders are placed without Razorpay; online checkout returns the Razorpay key/order/amount details, and the frontend must open Razorpay Checkout and post its success fields to `POST /api/v1/orders/:id/payment/verify`. Webhooks reconcile captured, failed, paid, and refunded statuses. Connect uploads to object storage before a multi-instance production deployment.

For production, use TLS, `COOKIE_SECURE=true`, a precise trusted proxy count, MySQL TLS, secrets management, backups, and monitoring. Use live Razorpay credentials only in the server environment and configure the matching webhook secret in the Razorpay Dashboard. Password reset delivery, email/SMS delivery and queue workers require provider setup. Do not store card data.
