let redis;
try {
  const { default: Redis } = await import("ioredis");
  if (process.env.REDIS_URL) {
    redis = new Redis(process.env.REDIS_URL, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
    });
    redis.on("error", () => {});
    await redis.connect().catch(() => {});
  }
} catch {}
export const cachePublic =
  (seconds = 60) =>
  (req, res, next) => {
    if (req.method !== "GET" || req.user) return next();
    const key = "http:" + req.originalUrl;
    redis
      ?.get(key)
      .then((v) => {
        if (v) {
          res.set("X-Cache", "HIT").type("json").send(v);
        } else {
          const send = res.send.bind(res);
          res.send = (body) => {
            if (res.statusCode === 200 && typeof body === "string")
              redis?.set(key, body, "EX", seconds).catch(() => {});
            res
              .set(
                "Cache-Control",
                `public, max-age=${seconds}, stale-while-revalidate=30`,
              )
              .set("X-Cache", "MISS");
            return send(body);
          };
          next();
        }
      })
      .catch(() => next());
  };
export const clearCache = async () => {
  try {
    const k = await redis?.keys("http:*");
    if (k?.length) await redis.del(...k);
  } catch {}
};
