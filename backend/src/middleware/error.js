/* BioBlood — Middleware de error global */

const isProd = process.env.NODE_ENV === "production";

function errorHandler(err, _req, res, _next) {
  const status  = err.statusCode || err.status || 500;
  const message = err.message    || "Error interno del servidor";

  console.error(`[${status}] ${message}${isProd ? "" : "\n" + err.stack}`);

  const body = { error: message };
  if (!isProd && err.stack) body.stack = err.stack;

  res.status(status).json(body);
}

module.exports = errorHandler;
