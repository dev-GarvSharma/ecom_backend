import { fail } from "../utils/http.js";

export default function errorHandler(error, _req, res, _next) {
  if (error.type === "entity.too.large") return fail(res, 413, "Request too large.");
  if (error.code === "LIMIT_FILE_SIZE") return fail(res, 413, "Image exceeds upload limit.");
  if (error.code === "LIMIT_UNEXPECTED_FILE" || error.code === "LIMIT_FILE_COUNT")
    return fail(res, 400, "This request contains an unsupported image field or too many image files.");
  if (error.message === "Unsupported image type.")
    return fail(res, 400, "Use JPEG, PNG, WebP, or AVIF image files.");
  if (error.message === "CORS origin denied") return fail(res, 403, "Origin not allowed.");

  process.stderr.write(`${error.stack || error}\n`);
  return fail(res, error.status || 500, error.status ? error.message : "Unexpected server error.");
}
