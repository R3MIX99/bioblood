/* BioBlood — Cache con Redis + TTL
   Drop-in replacement del cache en memoria anterior.
   API idéntica: withCache, invalidate, invalidatePrefix */

const redis  = require("./redis");
const PREFIX = "bb:cache:";

async function withCache(key, ttlMs, fn) {
  const rkey = PREFIX + key;
  const hit  = await redis.get(rkey);
  if (hit) return JSON.parse(hit);

  const value  = await fn();
  const ttlSec = Math.max(1, Math.ceil(ttlMs / 1000));
  await redis.setex(rkey, ttlSec, JSON.stringify(value));
  return value;
}

async function invalidate(key) {
  await redis.del(PREFIX + key);
}

async function invalidatePrefix(prefix) {
  const fullPrefix = PREFIX + prefix;
  let cursor = "0";
  do {
    const [next, keys] = await redis.scan(cursor, "MATCH", `${fullPrefix}*`, "COUNT", 100);
    if (keys.length) await redis.del(...keys);
    cursor = next;
  } while (cursor !== "0");
}

module.exports = { withCache, invalidate, invalidatePrefix };
