const jwt = require("jsonwebtoken");

/**
 * Middleware que valida el JWT en la cookie bb_token.
 * Si es válido, inyecta req.doctor = { id, email, nombre }.
 * Si falla, devuelve 401.
 */
function requireAuth(req, res, next) {
  const token = req.cookies?.bb_token;
  if (!token) {
    return res.status(401).json({ error: "No autenticado" });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || "dev-jwt-secret");
    req.doctor = { id: payload.id, email: payload.email, nombre: payload.nombre };
    next();
  } catch (err) {
    return res.status(401).json({ error: "Sesión inválida o expirada" });
  }
}

module.exports = { requireAuth };
