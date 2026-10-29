import { UserInteractionEvent } from "../database/models/index.js";
import { fail, ok } from "../utils/http.js";

const allowed = new Set([
  "product.viewed",
  "search.performed",
  "checkout.started",
  "payment.failed",
  "feedback.submitted",
]);
export const record = async (req, res) => {
  const eventType = String(req.body.eventType || "");
  if (!allowed.has(eventType)) return fail(res, 400, "Unsupported interaction event.");
  const details =
    req.body.details && typeof req.body.details === "object" && !Array.isArray(req.body.details)
      ? req.body.details
      : {};
  await UserInteractionEvent.create({ userId: req.user.id, eventType, details });
  return ok(res, null, "Interaction recorded.", null, 201);
};
