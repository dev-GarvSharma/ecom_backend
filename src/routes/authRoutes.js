import { Router } from "express";
import rateLimit from "express-rate-limit";
import { asyncHandler } from "../utils/http.js";
import { authenticate } from "../middleware/security.js";
import * as auth from "../controllers/authController.js";

const router = Router();
const authLimit = rateLimit({ windowMs: 900000, limit: 10, standardHeaders: true, legacyHeaders: false });
router.post("/register", authLimit, asyncHandler(auth.register));
router.post("/login", authLimit, asyncHandler(auth.login));
router.post("/refresh", authLimit, asyncHandler(auth.refreshToken));
router.post("/logout", asyncHandler(auth.logout));
router.get("/me", authenticate, asyncHandler(auth.me));
router.patch("/password", authenticate, asyncHandler(auth.password));
export default router;
