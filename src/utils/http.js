export const ok = (res, data, message = "Success", meta = null, status = 200) =>
  res
    .status(status)
    .json({
      statusCode: status,
      success: true,
      message,
      data,
      error: null,
      meta,
    });
export const fail = (res, status, message) =>
  res
    .status(status)
    .json({
      statusCode: status,
      success: false,
      message,
      data: null,
      error: null,
    });
export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
