/* BioBlood — Cache en memoria con TTL */

const _store = new Map(); // key → { value, expiresAt }

/**
 * Devuelve el valor cacheado si sigue vigente;
 * si no, llama a fn(), guarda el resultado y lo devuelve.
 * @param {string}   key    - Clave única (incluye doctorId y params relevantes)
 * @param {number}   ttlMs  - Tiempo de vida en milisegundos
 * @param {Function} fn     - Función async que produce el valor
 */
async function withCache(key, ttlMs, fn) {
  const now = Date.now();
  const hit = _store.get(key);
  if (hit && now < hit.expiresAt) return hit.value;
  const value = await fn();
  _store.set(key, { value, expiresAt: now + ttlMs });
  return value;
}

/**
 * Invalida una entrada del cache por clave exacta.
 */
function invalidate(key) {
  _store.delete(key);
}

/**
 * Invalida todas las entradas cuya clave empieza con el prefijo.
 */
function invalidatePrefix(prefix) {
  for (const key of _store.keys()) {
    if (key.startsWith(prefix)) _store.delete(key);
  }
}

module.exports = { withCache, invalidate, invalidatePrefix };
