'use strict';
const router = require('express').Router();
const db = require('../db');

router.get('/', (req, res) => {
  const where = [];
  const params = {};
  if (req.query.test_type) { where.push('test_type=@test_type'); params.test_type = req.query.test_type; }
  if (req.query.from) { where.push('qc_date >= @from'); params.from = req.query.from; }
  if (req.query.to) { where.push('qc_date <= @to'); params.to = req.query.to; }
  const sql = 'SELECT * FROM qc_log' + (where.length ? ' WHERE ' + where.join(' AND ') : '') +
    ' ORDER BY qc_date DESC, id DESC LIMIT 365';
  res.json(db.prepare(sql).all(params));
});

router.post('/', (req, res) => {
  const {
    qc_date, test_type, level, instrument = 'cobas', lot = null,
    target = null, sd = null, observed = null, operator = null, notes = null,
  } = req.body;
  if (!qc_date || !test_type || !level)
    return res.status(400).json({ error: 'qc_date, test_type, level required' });

  // Auto-evaluate against Westgard 1-2s warning / 1-3s fail when target & sd given
  let result = 'pass';
  if (target != null && sd != null && observed != null && sd > 0) {
    const z = Math.abs((observed - target) / sd);
    if (z > 3) result = 'fail';
    else if (z > 2) result = 'warning';
  } else if (req.body.result) {
    result = req.body.result;
  }

  const info = db.prepare(`
    INSERT INTO qc_log (qc_date, test_type, level, instrument, lot, target, sd, observed, result, operator, notes)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)`
  ).run(qc_date, test_type, level, instrument, lot, target, sd, observed, result, operator, notes);
  res.status(201).json(db.prepare('SELECT * FROM qc_log WHERE id=?').get(info.lastInsertRowid));
});

module.exports = router;
