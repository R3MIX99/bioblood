/* Redis store for pending email verifications during registration.
   TTL: 15 min. Max 3 wrong attempts before invalidation. */

const redis = require("./redis");

const TTL_SEC      = 15 * 60;
const MAX_ATTEMPTS = 3;
const PREFIX       = "bb:pending:";

function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

async function set(email, { nombre, passwordHash }) {
  const code = generateCode();
  await redis.setex(
    PREFIX + email.toLowerCase(),
    TTL_SEC,
    JSON.stringify({ nombre, passwordHash, code, attempts: 0 })
  );
  return code;
}

async function get(email) {
  const raw = await redis.get(PREFIX + email.toLowerCase());
  return raw ? JSON.parse(raw) : null;
}

async function verify(email, code) {
  const key = PREFIX + email.toLowerCase();
  const raw = await redis.get(key);
  if (!raw) return { ok: false, reason: "expired" };

  const entry = JSON.parse(raw);
  if (entry.attempts >= MAX_ATTEMPTS) {
    await redis.del(key);
    return { ok: false, reason: "locked" };
  }

  entry.attempts++;
  if (entry.code !== String(code)) {
    const ttl = await redis.ttl(key);
    if (ttl > 0) await redis.setex(key, ttl, JSON.stringify(entry));
    return { ok: false, reason: "invalid" };
  }

  const data = { nombre: entry.nombre, passwordHash: entry.passwordHash };
  await redis.del(key);
  return { ok: true, data };
}

async function invalidate(email) {
  await redis.del(PREFIX + email.toLowerCase());
}

module.exports = { set, get, verify, invalidate };
