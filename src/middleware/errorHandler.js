import { fail } from "../utils/http.js";

export default function errorHandler(error, _req, res, _next) {
  if (error.type === "entity.too.large") return fail(res, 413, "Request too large.");
  if (error.code === "LIMIT_FILE_SIZE") return fail(res, 413, "Image exceeds upload limit.");
  if (error.code === "LIMIT_UNEXPECTED_FILE")
    return fail(res, 400, "Use the 'images' or 'image' field for up to 8 image files.");
  if (error.message === "Unsupported image type.")
    return fail(res, 400, "Use JPEG, PNG, WebP, or AVIF image files.");
  if (error.message === "CORS origin denied") return fail(res, 403, "Origin not allowed.");

  process.stderr.write(`${error.stack || error}\n`);
  return fail(res, error.status || 500, error.status ? error.message : "Unexpected server error.");
}
