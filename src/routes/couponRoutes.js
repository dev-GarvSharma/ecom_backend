import { Router } from "express";
import { asyncHandler } from "../utils/http.js";
import { authenticate } from "../middleware/security.js";
import * as coupons from "../controllers/couponController.js";
const router = Router();
router.post("/validate", authenticate, asyncHandler(coupons.validateCoupon));
export default router;
