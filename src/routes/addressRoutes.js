import { Router } from "express";
import { asyncHandler } from "../utils/http.js";
import { authenticate } from "../middleware/security.js";
import * as addresses from "../controllers/addressController.js";
const router = Router();
router.get("/", authenticate, asyncHandler(addresses.addresses));
router.post("/", authenticate, asyncHandler(addresses.addressAdd));
export default router;
