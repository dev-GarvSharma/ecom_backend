import { Router } from "express";
import { asyncHandler } from "../utils/http.js";
import { authenticate, requireAdmin } from "../middleware/security.js";
import { uploadImages } from "../middleware/uploads.js";
import * as resources from "../controllers/adminResourceController.js";
import * as dashboard from "../controllers/adminDashboardController.js";
import * as notifications from "../controllers/notificationController.js";

const router = Router();
router.use(authenticate, requireAdmin);
router.get("/dashboard", asyncHandler(dashboard.dashboard));
router.post("/dashboard/export", asyncHandler(dashboard.exportData));
router.get("/analytics", asyncHandler(dashboard.analytics));
router.post("/analytics/export", asyncHandler(dashboard.exportData));
router.get("/marketing", asyncHandler(dashboard.marketing));
router.get("/marketing/campaigns", asyncHandler(dashboard.campaignList));
router.post(
  "/marketing/campaigns",
  (req, _res, next) => {
    req.params.resource = "campaigns";
    next();
  },
  asyncHandler(resources.adminCreate),
);
router.get(
  "/marketing/campaigns/:id",
  (req, _res, next) => {
    req.params.resource = "campaigns";
    next();
  },
  asyncHandler(resources.adminDetail),
);
router.put(
  "/marketing/campaigns/:id",
  (req, _res, next) => {
    req.params.resource = "campaigns";
    next();
  },
  asyncHandler(resources.adminUpdate),
);
router.get(
  "/marketing/subscribers",
  (req, _res, next) => {
    req.params.resource = "customers";
    next();
  },
  asyncHandler(resources.adminList),
);
router.get("/notifications", asyncHandler(notifications.notificationsAdmin));
router.patch("/notifications/read", asyncHandler(notifications.readAll));
router.get("/settings", asyncHandler(dashboard.settings));
router.put("/settings", asyncHandler(dashboard.settings));
router.post("/settings/password-reset", (_req, res) =>
  res.json({ success: true, message: "Change password through the authenticated account flow." }),
);
for (const resource of ["products", "categories", "orders", "customers", "coupons"]) {
  const resourceImageUpload =
    resource === "products"
      ? uploadImages.fields([
          { name: "images", maxCount: 8 },
          { name: "image", maxCount: 1 },
        ])
      : resource === "categories"
        ? uploadImages.fields([{ name: "image", maxCount: 1 }])
        : (_req, _res, next) => next();
  router.get(
    `/${resource}`,
    (req, _res, next) => {
      req.params.resource = resource;
      next();
    },
    asyncHandler(resources.adminList),
  );
  router.post(
    `/${resource}/export`,
    (req, _res, next) => {
      req.params.resource = resource;
      next();
    },
    asyncHandler(dashboard.exportData),
  );
  router.get(
    `/${resource}/:id`,
    (req, _res, next) => {
      req.params.resource = resource;
      next();
    },
    asyncHandler(resources.adminDetail),
  );
  router.post(
    `/${resource}`,
    (req, _res, next) => {
      req.params.resource = resource;
      next();
    },
    resourceImageUpload,
    asyncHandler(resources.adminCreate),
  );
  router.put(
    `/${resource}/:id`,
    (req, _res, next) => {
      req.params.resource = resource;
      next();
    },
    resourceImageUpload,
    asyncHandler(resources.adminUpdate),
  );
  router.delete(
    `/${resource}/:id`,
    (req, _res, next) => {
      req.params.resource = resource;
      next();
    },
    asyncHandler(resources.adminDelete),
  );
}
router.patch("/products/visibility", asyncHandler(resources.visibility));
router.get(
  "/inventory",
  (req, _res, next) => {
    req.params.resource = "products";
    next();
  },
  asyncHandler(resources.adminList),
);
router.patch("/inventory/:id", asyncHandler(resources.stock));
router.post(
  "/inventory/:id/restock",
  asyncHandler(async (req, res) => {
    const { Product } = await import("../database/models/index.js");
    const product = await Product.findByPk(req.params.id);
    if (!product) return res.status(404).json({ success: false, message: "Product not found" });
    const quantity = Number(req.body.quantity);
    if (!Number.isInteger(quantity) || quantity < 1)
      return res.status(400).json({ success: false, message: "Quantity must be positive" });
    await product.increment("stock", { by: quantity });
    await product.reload();
    return res.json({ success: true, data: product });
  }),
);
router.post(
  "/inventory/export",
  (req, _res, next) => {
    req.params.resource = "products";
    next();
  },
  asyncHandler(dashboard.exportData),
);
router.get(
  "/customers/:id/orders",
  asyncHandler(async (req, res) => {
    const { Order, OrderItem } = await import("../database/models/index.js");
    return res.json({
      statusCode: 200,
      success: true,
      message: "Orders loaded",
      data: await Order.findAll({
        where: { userId: req.params.id },
        include: [{ model: OrderItem, as: "items" }],
      }),
    });
  }),
);
router.patch(
  "/orders/:id/status",
  (req, _res, next) => {
    req.params.resource = "orders";
    next();
  },
  asyncHandler(resources.adminUpdate),
);
export default router;
