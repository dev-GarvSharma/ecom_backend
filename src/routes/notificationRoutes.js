import { Router } from "express";
import { asyncHandler } from "../utils/http.js";
import { authenticate } from "../middleware/security.js";
import * as notifications from "../controllers/notificationController.js";
const router = Router();
router.get("/", authenticate, asyncHandler(notifications.myNotifications));
router.patch("/:id/read", authenticate, asyncHandler(notifications.notificationRead));
export default router;
