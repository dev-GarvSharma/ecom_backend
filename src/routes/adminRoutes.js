import { Router } from "express";
import { asyncHandler } from "../utils/http.js";
import { authenticate, authorizeAdminRoute } from "../middleware/security.js";
import { uploadImages } from "../middleware/uploads.js";
import * as resources from "../controllers/adminResourceController.js";
import * as catalog from "../controllers/adminCatalogController.js";
import * as dashboard from "../controllers/adminDashboardController.js";
import * as notifications from "../controllers/notificationController.js";
import { sendCampaign, marketingSubscribers } from "../controllers/marketingController.js";
import {
  adminContactMessages,
  updateContactMessage,
  sendAbandonedCartRecovery,
} from "../controllers/contactController.js";
import {
  adminBlogList,
  adminBlogDetail,
  createBlogPost,
  updateBlogPost,
  deleteBlogPost,
  adminCommentList,
  moderateBlogComment,
} from "../controllers/blogController.js";
import {
  adminRoles,
  adminPermissions,
  adminRoleCreate,
  adminRoleUpdate,
  adminAssignRoles,
  adminUsers,
  adminUserPermissions,
  adminAbandonedCarts,
  adminCreateCustomer,
  adminAuditLog,
} from "../controllers/adminResourceController.js";

const router = Router();
router.use(authenticate, authorizeAdminRoute);
router.get("/roles", asyncHandler(adminRoles));
router.get("/permissions", asyncHandler(adminPermissions));
router.post("/roles", asyncHandler(adminRoleCreate));
router.put("/roles/:roleId", asyncHandler(adminRoleUpdate));
router.put("/users/:userId/roles", asyncHandler(adminAssignRoles));
router.get("/users", asyncHandler(adminUsers));
router.get("/users/:userId/permissions", asyncHandler(adminUserPermissions));
router.put("/users/:userId/permissions", asyncHandler(adminUserPermissions));
router.get("/abandoned-carts", asyncHandler(adminAbandonedCarts));
router.post("/abandoned-carts/:id/recover", asyncHandler(sendAbandonedCartRecovery));
router.get("/contact-messages", asyncHandler(adminContactMessages));
router.patch("/contact-messages/:id", asyncHandler(updateContactMessage));
router.get("/blogs", asyncHandler(adminBlogList));
router.get("/blogs/:id", asyncHandler(adminBlogDetail));
router.post("/blogs", uploadImages.single("bannerImage"), asyncHandler(createBlogPost));
router.put("/blogs/:id", uploadImages.single("bannerImage"), asyncHandler(updateBlogPost));
router.delete("/blogs/:id", asyncHandler(deleteBlogPost));
router.get("/blog-comments", asyncHandler(adminCommentList));
router.patch("/blog-comments/:id", asyncHandler(moderateBlogComment));
router.get("/audit-log", asyncHandler(adminAuditLog));
router.post("/customers", asyncHandler(adminCreateCustomer));
router.get("/dashboard", asyncHandler(dashboard.dashboard));
router.post("/dashboard/export", asyncHandler(dashboard.exportData));
router.get("/analytics", asyncHandler(dashboard.analytics));
router.post("/analytics/export", asyncHandler(dashboard.exportData));
router.get("/marketing", asyncHandler(dashboard.marketing));
router.get("/marketing/campaigns", asyncHandler(dashboard.campaignList));
router.post("/marketing/campaigns/:id/send", asyncHandler(sendCampaign));
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
router.delete(
  "/marketing/campaigns/:id",
  (req, _res, next) => {
    req.params.resource = "campaigns";
    next();
  },
  asyncHandler(resources.adminDelete),
);
router.get(
  "/marketing/subscribers",
  asyncHandler(marketingSubscribers),
);
router.get("/notifications", asyncHandler(notifications.notificationsAdmin));
router.patch("/notifications/read", asyncHandler(notifications.readAll));
router.get("/settings", asyncHandler(dashboard.settings));
router.put("/settings", asyncHandler(dashboard.settings));
for (const resource of ["categories", "orders", "customers", "coupons", "promotions"]) {
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
const productImageUpload = uploadImages.any();
router.get("/products", asyncHandler(catalog.listProducts));
router.get("/products/:id", asyncHandler(catalog.productDetail));
router.post("/products", productImageUpload, asyncHandler(catalog.createProduct));
router.put("/products/:id", productImageUpload, asyncHandler(catalog.updateProduct));
router.delete("/products/:id", asyncHandler(catalog.deleteProduct));
router.patch("/products/visibility", asyncHandler(catalog.setVisibility));
router.post("/products/export", asyncHandler(catalog.listProducts));
router.get("/inventory", asyncHandler(catalog.inventory));
router.patch("/inventory/:id", asyncHandler(catalog.updateInventory));
router.post("/inventory/:id/restock", asyncHandler(catalog.restockInventory));
router.post("/inventory/export", asyncHandler(catalog.inventory));
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
