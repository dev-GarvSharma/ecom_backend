import { Router } from "express";
import { asyncHandler } from "../utils/http.js";
import { cachePublic } from "../middleware/cache.js";
import * as catalog from "../controllers/catalogController.js";
const router = Router();
router.get("/products", cachePublic(60), asyncHandler(catalog.catalog));
router.get("/categories", cachePublic(300), asyncHandler(catalog.categories));
export default router;
