'use strict';
const router = require('express').Router();
const db = require('../db');

const withCounts = `
  SELECT b.*, (SELECT COUNT(*) FROM specimens s WHERE s.batch_id = b.id) AS specimen_count
  FROM batches b`;

router.get('/', (req, res) => {
  const where = [];
  const params = {};
  if (req.query.date) { where.push('b.run_date = @date'); params.date = req.query.date; }
  if (req.query.status) { where.push('b.status = @status'); params.status = req.query.status; }
  const sql = withCounts + (where.length ? ' WHERE ' + where.join(' AND ') : '') +
    ' ORDER BY b.run_date DESC, b.id DESC LIMIT 200';
  res.json(db.prepare(sql).all(params));
});

router.get('/:id', (req, res) => {
  const batch = db.prepare(withCounts + ' WHERE b.id=?').get(req.params.id);
  if (!batch) return res.status(404).json({ error: 'not found' });
  batch.specimens = db.prepare(
    'SELECT id, accession, test_type, status FROM specimens WHERE batch_id=?'
  ).all(batch.id);
  res.json(batch);
});

router.post('/', (req, res) => {
  const { run_date, instrument = 'cobas', test_type, operator = null, notes = null } = req.body;
  if (!run_date || !test_type) return res.status(400).json({ error: 'run_date and test_type required' });
  const info = db.prepare(
    'INSERT INTO batches (run_date, instrument, test_type, operator, notes) VALUES (?,?,?,?,?)'
  ).run(run_date, instrument, test_type, operator, notes);
  res.status(201).json(db.prepare(withCounts + ' WHERE b.id=?').get(info.lastInsertRowid));
});

// Update batch status / qc; assign specimens
router.patch('/:id', (req, res) => {
  const b = db.prepare('SELECT * FROM batches WHERE id=?').get(req.params.id);
  if (!b) return res.status(404).json({ error: 'not found' });
  const fields = ['status', 'qc_status', 'started_at', 'completed_at', 'operator', 'notes'];
  const sets = [];
  const vals = [];
  for (const f of fields) if (f in req.body) { sets.push(`${f}=?`); vals.push(req.body[f]); }
  if (sets.length) {
    vals.push(req.params.id);
    db.prepare(`UPDATE batches SET ${sets.join(', ')} WHERE id=?`).run(...vals);
  }
  res.json(db.prepare(withCounts + ' WHERE b.id=?').get(req.params.id));
});

// Assign a list of specimen ids to this batch and mark them in_run
router.post('/:id/assign', (req, res) => {
  const b = db.prepare('SELECT * FROM batches WHERE id=?').get(req.params.id);
  if (!b) return res.status(404).json({ error: 'not found' });
  const ids = Array.isArray(req.body.specimen_ids) ? req.body.specimen_ids : [];
  const tx = db.transaction(() => {
    const stmt = db.prepare(`UPDATE specimens SET batch_id=?, status='in_run', updated_at=datetime('now') WHERE id=?`);
    for (const id of ids) stmt.run(b.id, id);
  });
  tx();
  res.json(db.prepare(withCounts + ' WHERE b.id=?').get(b.id));
});

module.exports = router;
