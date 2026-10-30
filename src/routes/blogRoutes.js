import { Router } from "express";
import rateLimit from "express-rate-limit";
import { asyncHandler, fail } from "../utils/http.js";
import { blogDetails, blogList, submitBlogComment } from "../controllers/blogController.js";

const router = Router();
const commentLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => fail(res, 429, "Too many comments. Please try again later."),
});

router.get("/", asyncHandler(blogList));
router.get("/:slug", asyncHandler(blogDetails));
router.post("/:slug/comments", commentLimit, asyncHandler(submitBlogComment));

export default router;
