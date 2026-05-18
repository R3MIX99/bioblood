const jwt = require("jsonwebtoken");

/**
 * Middleware que valida el JWT en la cookie bb_token.
 * - Verifica firma y expiración.
 * - Si el payload contiene tokenVersion, lo valida contra Airtable
 *   usando el cache (TTL 60 s) para no martillar la API en cada request.
 * - Inyecta req.doctor = { id, email, nombre }.
 */
async function requireAuth(req, res, next) {
  const token = req.cookies?.bb_token;
  if (!token) return res.status(401).json({ error: "No autenticado" });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || "dev-jwt-secret");

    // Validar tokenVersion si el JWT lo incluye (JWTs anteriores lo omiten → backwards compat)
    if (payload.tokenVersion !== undefined) {
      const { withCache }    = require("../services/cache");
      const { findDoctorById } = require("../services/airtable");

      const doctor = await withCache(
        `tokenVersion:${payload.id}`,
        60_000,
        () => findDoctorById(payload.id)
      );

      if (!doctor) {
        return res.status(401).json({ error: "Sesion invalida" });
      }
      if (doctor.tokenVersion !== payload.tokenVersion) {
        return res.status(401).json({ error: "Sesion revocada" });
      }
    }

    req.doctor = { id: payload.id, email: payload.email, nombre: payload.nombre };
    next();
  } catch (err) {
    return res.status(401).json({ error: "Sesion invalida o expirada" });
  }
}

module.exports = { requireAuth };
