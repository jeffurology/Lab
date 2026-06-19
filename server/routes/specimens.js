'use strict';
const router = require('express').Router();
const db = require('../db');

const SELECT = `
  SELECT s.*, l.code AS location_code, l.name AS location_name,
         (SELECT json_group_array(json_object(
             'id', r.id, 'test_type', r.test_type, 'value', r.value,
             'unit', r.unit, 'flag', r.flag, 'resulted_at', r.resulted_at))
          FROM results r WHERE r.specimen_id = s.id) AS results_json
  FROM specimens s JOIN locations l ON l.id = s.location_id`;

function hydrate(row) {
  if (!row) return row;
  row.results = JSON.parse(row.results_json || '[]');
  delete row.results_json;
  return row;
}

// List with optional filters: ?status=&location_id=&test_type=&date=YYYY-MM-DD
router.get('/', (req, res) => {
  const where = [];
  const params = {};
  for (const key of ['status', 'location_id', 'test_type']) {
    if (req.query[key]) { where.push(`s.${key} = @${key}`); params[key] = req.query[key]; }
  }
  if (req.query.date) { where.push(`date(s.received_at) = @date`); params.date = req.query.date; }
  const sql = SELECT + (where.length ? ' WHERE ' + where.join(' AND ') : '') +
    ' ORDER BY s.created_at DESC LIMIT 500';
  res.json(db.prepare(sql).all(params).map(hydrate));
});

router.get('/:id', (req, res) => {
  const row = hydrate(db.prepare(SELECT + ' WHERE s.id=?').get(req.params.id));
  if (!row) return res.status(404).json({ error: 'not found' });
  res.json(row);
});

router.post('/', (req, res) => {
  const {
    accession, location_id, patient_ref = null, test_type,
    priority = 'routine', collected_at = null, received_at = null,
    status = 'received', notes = null,
  } = req.body;
  if (!accession || !location_id || !test_type)
    return res.status(400).json({ error: 'accession, location_id, test_type required' });
  const info = db.prepare(`
    INSERT INTO specimens (accession, location_id, patient_ref, test_type, priority, collected_at, received_at, status, notes)
    VALUES (?,?,?,?,?,?,?,?,?)`
  ).run(accession.trim(), location_id, patient_ref, test_type, priority, collected_at, received_at, status, notes);
  res.status(201).json(hydrate(db.prepare(SELECT + ' WHERE s.id=?').get(info.lastInsertRowid)));
});

// Update status / fields
router.patch('/:id', (req, res) => {
  const s = db.prepare('SELECT * FROM specimens WHERE id=?').get(req.params.id);
  if (!s) return res.status(404).json({ error: 'not found' });
  const fields = ['status', 'received_at', 'collected_at', 'batch_id', 'reject_reason', 'notes', 'priority', 'patient_ref'];
  const sets = [];
  const vals = [];
  for (const f of fields) if (f in req.body) { sets.push(`${f}=?`); vals.push(req.body[f]); }
  if (!sets.length) return res.json(s);
  sets.push(`updated_at=datetime('now')`);
  vals.push(req.params.id);
  db.prepare(`UPDATE specimens SET ${sets.join(', ')} WHERE id=?`).run(...vals);
  res.json(hydrate(db.prepare(SELECT + ' WHERE s.id=?').get(req.params.id)));
});

// Add a result and mark specimen resulted
router.post('/:id/results', (req, res) => {
  const s = db.prepare('SELECT * FROM specimens WHERE id=?').get(req.params.id);
  if (!s) return res.status(404).json({ error: 'not found' });
  const { test_type, value, unit = 'ng/mL', flag = 'normal', instrument = 'cobas' } = req.body;
  if (test_type === undefined || value === undefined)
    return res.status(400).json({ error: 'test_type and value required' });
  const tx = db.transaction(() => {
    db.prepare(`INSERT INTO results (specimen_id, test_type, value, unit, flag, instrument)
                VALUES (?,?,?,?,?,?)`).run(s.id, test_type, value, unit, flag, instrument);
    db.prepare(`UPDATE specimens SET status='resulted', updated_at=datetime('now') WHERE id=?`).run(s.id);
  });
  tx();
  res.status(201).json(hydrate(db.prepare(SELECT + ' WHERE s.id=?').get(s.id)));
});

module.exports = router;
