import { Router } from "express";
import { asyncHandler } from "../utils/http.js";
import { authenticate } from "../middleware/security.js";
import * as orders from "../controllers/orderController.js";
const router = Router();
router.post("/", authenticate, asyncHandler(orders.checkout));
router.get("/", authenticate, asyncHandler(orders.myOrders));
router.post("/:id/payment/verify", authenticate, asyncHandler(orders.verifyPayment));
export default router;
