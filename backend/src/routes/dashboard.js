/* BioBlood — Rutas del Dashboard (Fase 9) */

const router = require("express").Router();
const {
  getStats,
  getActivity,
  getRecentPatients,
  getRecentStudies,
  getAlerts,
  getTopComponents,
} = require("../services/dashboard");

// Todos los handlers delegan a dashboard.js y devuelven JSON crudo.

// GET /dashboard/stats
router.get("/stats", async (req, res, next) => {
  try {
    res.json(await getStats(req.doctor.id));
  } catch (e) { next(e); }
});

// GET /dashboard/activity?months=12
router.get("/activity", async (req, res, next) => {
  try {
    const months = Math.min(Math.max(parseInt(req.query.months) || 12, 1), 24);
    res.json(await getActivity(req.doctor.id, months));
  } catch (e) { next(e); }
});

// GET /dashboard/recent-patients?limit=5
router.get("/recent-patients", async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 5, 20);
    res.json(await getRecentPatients(req.doctor.id, limit));
  } catch (e) { next(e); }
});

// GET /dashboard/recent-studies?limit=5
router.get("/recent-studies", async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 5, 20);
    res.json(await getRecentStudies(req.doctor.id, limit));
  } catch (e) { next(e); }
});

// GET /dashboard/alerts?limit=10
router.get("/alerts", async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 10, 50);
    res.json(await getAlerts(req.doctor.id, limit));
  } catch (e) { next(e); }
});

// GET /dashboard/top-components?days=30&limit=6
router.get("/top-components", async (req, res, next) => {
  try {
    const days  = Math.min(parseInt(req.query.days)  || 30, 365);
    const limit = Math.min(parseInt(req.query.limit) || 6,  20);
    res.json(await getTopComponents(req.doctor.id, days, limit));
  } catch (e) { next(e); }
});

module.exports = router;
