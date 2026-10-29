# Perfume store backend

Express, Sequelize, and MySQL API mounted at `/api/v1`. This repository uses account-based carts: the storefront may keep a cart in local storage before sign-in, then send its variant IDs and quantities to `PUT /api/v1/cart` after sign-in. The server rechecks product visibility and stock and replaces the account cart with the submitted lines. There is no guest-cart database flow.

## Fresh development setup

1. Create an empty MySQL 8 database and a least-privileged database user. Put its credentials in `.env` based on `.env.example`.
2. Set distinct random JWT secrets of at least 32 characters. In development, OTP codes are included in auth API responses. Never expose OTPs in production.
3. Run `npm install`, then `npm run db:migrate`, then `npm run db:seed`.
4. Start with `npm run dev`. The API is at `http://localhost:4000/api/v1` by default. Development seed accounts use phone numbers starting with `+91990000`; request an OTP from `/auth/login`. Seed data is disabled when `NODE_ENV=production`.

The migration set is a fresh baseline with one table per migration file. The runner refuses to apply it to databases containing legacy migration history or application tables. Create a new empty database before running migrations; this schema intentionally does not migrate existing jewelry or order data.

## Main data model

- `products` stores shared perfume details: brand, concentration, fragrance family, top/heart/base notes, copy, category, and images.
- `product_variants` stores each sellable size separately. Use options such as `{ "volumeMl": 50 }` and `{ "volumeMl": 100 }`; each size has its own SKU, price, compare-at price, stock, and active flag.
- `carts` and `cart_items` belong to a registered user. Local-storage sync accepts `{ "items": [{ "variantId": "...", "quantity": 1 }] }`; send the full desired list to `PUT /cart` after login.
- `promotions` currently supports free-product promotions. `POST /cart/promotions` with a promotion `code` adds its configured variant as a zero-priced line after minimum-spend and stock checks. Checkout checks eligibility and stock again. Coupon discounts remain separate.
- `orders` and `order_items` retain payment and fulfillment status separately and snapshot product/variant information and purchased prices. UPI and card use Razorpay. COD is off by default; enable later with `ENABLE_COD=true` after defining operational handling for unpaid and cancelled COD orders.
- `roles`, `permissions`, `role_permissions`, `user_roles`, and `user_permissions` provide module/action authorization. Built-in roles include admin, catalog manager, inventory manager, order manager, support, marketing manager, and customer. Migration 000 creates the fresh-store marker; 001 creates and seeds roles; 002 creates users with a required `role_id` foreign key to their primary role; 003 through 005 create permissions and role grants; 024 adds permissions granted directly to an individual user. `user_roles` supports additional roles beyond the primary role. Effective permissions are the union of role permissions and direct user permissions.
- `verification_challenges` stores hashed, expiring SMS codes. `user_interaction_events` stores account activity and `audit_logs` stores administrative changes.
- `cart_sessions` tracks checkout start, conversion, or abandonment. A server job marks carts with items as abandoned after 24 hours without activity. The customer can submit a reason (`price`, `shipping_cost`, `payment_issue`, `changed_mind`, `other`) and optional comment to `POST /cart/abandon`; admins can review `GET /admin/abandoned-carts`.

## Sign-in and account setup

- `POST /auth/register` accepts `{ "name", "phone", "email?" }`. Phone is required and must use international form such as `+919876543210`; email is optional and is not used for authentication. It sends a six-digit SMS code and does not issue a session until the mobile number is verified.
- Registration can include `marketingEmailSubscribed: true` for explicit promotional email consent. Customers can review/change consent through authenticated `GET/PUT /auth/me/marketing-preferences`; campaign emails contain a confirmation page and one-click unsubscribe endpoint.
- `POST /auth/verification/confirm` accepts `{ "phone", "purpose": "register", "code" }`. Successful verification sets `is_verified=true` and issues the access token and HttpOnly refresh cookie.
- Returning users call `POST /auth/login` with `{ "phone" }` to request an SMS code, then confirm it with purpose `login`. The `POST /auth/verification/request` route is an alias for requesting a code.
- In non-production, auth responses include the generated OTP. Production startup requires HTTPS `OTP_DELIVERY_URL` and `OTP_DELIVERY_TOKEN`; the delivery service receives `{ "channel": "sms", "destination", "code" }`. OTPs are not returned in production.

## Admin access

Every `/admin` route checks its permission at request time, so role changes take effect without waiting for a long-lived token to expire. Useful endpoints:

- `GET /admin/permissions`, `GET/POST /admin/roles`, `PUT /admin/roles/:roleId` manage role definitions.
- `POST /admin/customers` creates an account with one or more `roleIds`; the new user must verify their mobile number before signing in.
- `PUT /admin/users/:userId/roles` assigns roles. Only a caller whose legacy account role is `admin` may grant the built-in admin role.
- `GET/PUT /admin/users/:userId/permissions` reads or replaces that user's direct permission grants. Send `PUT` JSON such as `{ "permissions": ["catalog.read", "orders.read"] }`; an empty array clears direct grants. Only an administrator can use this endpoint. Direct grants add to role grants, so role-derived permissions should be removed by changing that user's roles. `GET /auth/me` and successful sign-in responses include role names and effective permission codes for the frontend.
- Public catalog reads are available at `GET /catalog/products`, `GET /catalog/products/:id`, and `GET /catalog/categories`. Admin catalog APIs are under `/admin/products`, inventory under `/admin/inventory`, orders under `/admin/orders`, and free-product offer setup under `/admin/promotions`.
- Email campaigns use SendGrid's v3 Mail Send API. Configure `SENDGRID_API_KEY`, `SENDGRID_FROM_EMAIL` (a verified SendGrid sender), optional `SENDGRID_FROM_NAME` and `SENDGRID_REPLY_TO_EMAIL`, and `API_PUBLIC_URL` with the public HTTPS API origin. Keep the API key on the backend, never in frontend variables. After migrations, an authorized admin with `marketing.manage` can use `POST /admin/marketing/campaigns/:id/send` or the Campaigns page. Sends target active, mobile-verified users who explicitly opted in, batch at SendGrid's 1,000-personalization request limit, add unsubscribe links, and record accepted/failed/skipped recipients. SendGrid's `202` response means accepted by SendGrid, not confirmed delivered. Sending is manual; Scheduled campaign records do not send automatically.

Create and verify the first administrator account through the OTP flow, then grant it access through a protected operational database session; public registration cannot grant privileged roles. After migration, set the user's legacy `role` to `admin`, set `role_id` to the built-in admin role ID, and insert the user/admin pair into `user_roles`. The development seed creates an admin and grants it the built-in permissions.

## Payment and production setup

For Razorpay set `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, and `RAZORPAY_WEBHOOK_SECRET`, and register `/api/v1/webhooks/razorpay` for captured, failed, paid, and refund events. Checkout currently enables prepaid UPI/card only unless `ENABLE_COD=true`. Never store card data.

Production requires TLS, `COOKIE_SECURE=true`, strong separate JWT secrets, a precise `TRUST_PROXY` setting, MySQL TLS, backups, monitoring, and an HTTPS OTP delivery endpoint. Store uploads in durable object storage for multi-instance deployments. Set a strict `WEB_ORIGINS` allowlist. Keep secrets out of source control.

## API flow example

1. Register and confirm OTP; retain the Bearer access token and browser refresh cookie.
2. Read the catalog. Choose a product variant by its volume/SKU and keep `{variantId, quantity}` locally.
3. After sign-in, call `PUT /cart` with the local lines, then use `GET /cart` as the server-authoritative state.
4. Optionally apply a free-product promotion with `POST /cart/promotions`.
5. Create an order with `POST /orders` and address plus `paymentMode: "UPI"` or `"CARD"`; complete Razorpay and call `/orders/:id/payment/verify`.
6. Call `POST /cart/abandon` if the customer leaves without ordering and has chosen to give feedback. Cart activity and orders also appear in account/admin history.
