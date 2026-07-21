const Redis = require("ioredis");

const url = process.env.REDIS_URL || "redis://localhost:6379";

const redis = new Redis(url, {
  maxRetriesPerRequest: 3,
  retryDelayOnFailover: 100,
  // Upstash y otros proveedores cloud usan rediss:// (TLS obligatorio)
  ...(url.startsWith("rediss://") ? { tls: { rejectUnauthorized: false } } : {}),
});

redis.on("error",   (err) => console.error("❌ Redis:", err.message));
redis.on("connect", ()    => console.log("✅ Redis conectado"));

module.exports = redis;
