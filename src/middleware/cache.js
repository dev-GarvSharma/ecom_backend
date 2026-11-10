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
    // Redis owns the cache lifetime. Do not let browsers or intermediary
    // caches keep a stale catalog response after an admin update invalidates it.
    res.set("Cache-Control", "no-store");
    const key = "http:" + req.originalUrl;
    if (!redis) {
      res.set("X-Cache", "BYPASS");
      return next();
    }
    redis
      ?.get(key)
      .then((v) => {
        if (v) {
          res.set("X-Cache", "HIT").type("json").send(v);
        } else {
          res.set("X-Cache", "MISS");
          const send = res.send.bind(res);
          res.send = (body) => {
            if (res.statusCode === 200 && typeof body === "string")
              redis?.set(key, body, "EX", seconds).catch(() => {});
            return send(body);
          };
          next();
        }
      })
      .catch(() => {
        res.set("X-Cache", "BYPASS");
        next();
      });
  };
export const clearCache = async () => {
  try {
    const k = await redis?.keys("http:*");
    if (k?.length) await redis.del(...k);
  } catch {}
};
