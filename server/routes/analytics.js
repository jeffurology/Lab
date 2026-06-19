'use strict';
const router = require('express').Router();
const db = require('../db');

// Daily targets used to compute capacity utilization on the dashboard.
const TARGETS = { PSA: 100, IsoPSA: 20 };

router.get('/dashboard', (req, res) => {
  const date = req.query.date || new Date().toISOString().slice(0, 10);

  // Volume received today by test_type
  const volume = db.prepare(`
    SELECT test_type, COUNT(*) n
    FROM specimens WHERE date(COALESCE(received_at, created_at)) = ?
    GROUP BY test_type`).all(date);

  const counts = { PSA: 0, IsoPSA: 0 };
  for (const v of volume) {
    if (v.test_type === 'PSA+IsoPSA') { counts.PSA += v.n; counts.IsoPSA += v.n; }
    else counts[v.test_type] = (counts[v.test_type] || 0) + v.n;
  }

  // Status breakdown today
  const statusBreakdown = db.prepare(`
    SELECT status, COUNT(*) n FROM specimens
    WHERE date(COALESCE(received_at, created_at)) = ? GROUP BY status`).all(date)
    .reduce((a, x) => (a[x.status] = x.n, a), {});

  // Pending (not resulted/cancelled/rejected) across all dates
  const pending = db.prepare(`
    SELECT COUNT(*) n FROM specimens
    WHERE status NOT IN ('resulted','cancelled','rejected')`).get().n;

  // Average turnaround (received -> resulted) over last 7 days, minutes
  const tat = db.prepare(`
    SELECT AVG((julianday(r.resulted_at) - julianday(s.received_at)) * 24 * 60) avg_min,
           COUNT(*) n
    FROM results r JOIN specimens s ON s.id = r.specimen_id
    WHERE s.received_at IS NOT NULL AND r.resulted_at >= datetime('now','-7 days')`).get();

  // Volume by location today
  const byLocation = db.prepare(`
    SELECT l.code, l.name, COUNT(s.id) n
    FROM locations l LEFT JOIN specimens s
      ON s.location_id = l.id AND date(COALESCE(s.received_at, s.created_at)) = ?
    WHERE l.active = 1
    GROUP BY l.id ORDER BY n DESC`).all(date);

  // 14-day trend
  const trend = db.prepare(`
    SELECT date(COALESCE(received_at, created_at)) d, COUNT(*) n
    FROM specimens
    WHERE date(COALESCE(received_at, created_at)) >= date(?, '-13 days')
      AND date(COALESCE(received_at, created_at)) <= ?
    GROUP BY d ORDER BY d`).all(date, date);

  // Recent QC failures/warnings
  const qcIssues = db.prepare(`
    SELECT * FROM qc_log WHERE result IN ('fail','warning')
    ORDER BY qc_date DESC, id DESC LIMIT 10`).all();

  res.json({
    date,
    targets: TARGETS,
    volume: counts,
    utilization: {
      PSA: +(counts.PSA / TARGETS.PSA * 100).toFixed(0),
      IsoPSA: +(counts.IsoPSA / TARGETS.IsoPSA * 100).toFixed(0),
    },
    statusBreakdown,
    pending,
    turnaround: { avg_minutes: tat.avg_min ? +tat.avg_min.toFixed(0) : null, count: tat.n },
    byLocation,
    trend,
    qcIssues,
  });
});

module.exports = router;
