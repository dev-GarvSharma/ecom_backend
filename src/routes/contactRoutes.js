import { Router } from "express";
import rateLimit from "express-rate-limit";
import { asyncHandler, fail } from "../utils/http.js";
import { createContactMessage } from "../controllers/contactController.js";

const router = Router();
const contactLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => fail(res, 429, "Too many messages. Please try again later."),
});

router.post("/", contactLimit, asyncHandler(createContactMessage));

export default router;
