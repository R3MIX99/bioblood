/* In-memory store for password-reset codes.
   Each entry: { code, expiresAt, attempts }
   TTL: 15 minutes. Max 3 wrong attempts before invalidation. */

const store = new Map(); // email → { code, expiresAt, attempts }

const TTL_MS      = 15 * 60 * 1000; // 15 min
const MAX_ATTEMPTS = 3;

function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000)); // 6-digit
}

function set(email) {
  const code = generateCode();
  store.set(email.toLowerCase(), {
    code,
    expiresAt: Date.now() + TTL_MS,
    attempts:  0,
  });
  return code;
}

/** Returns true if the code is valid for this email. Mutates attempt counter. */
function verify(email, code) {
  const key   = email.toLowerCase();
  const entry = store.get(key);
  if (!entry)                        return { ok: false, reason: "expired" };
  if (Date.now() > entry.expiresAt)  { store.delete(key); return { ok: false, reason: "expired" }; }
  if (entry.attempts >= MAX_ATTEMPTS){ store.delete(key); return { ok: false, reason: "locked" }; }

  entry.attempts++;
  if (entry.code !== String(code))   return { ok: false, reason: "invalid" };

  store.delete(key); // single-use
  return { ok: true };
}

function invalidate(email) {
  store.delete(email.toLowerCase());
}

module.exports = { set, verify, invalidate };
