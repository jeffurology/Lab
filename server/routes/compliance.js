'use strict';
const router = require('express').Router();
const db = require('../db');

router.get('/', (_req, res) => {
  const rows = db.prepare(
    'SELECT * FROM compliance_tasks ORDER BY sort_order, id'
  ).all();
  // Group by category for convenient rendering, plus summary
  const byCat = {};
  for (const r of rows) (byCat[r.category] ||= []).push(r);
  const summary = db.prepare(
    `SELECT status, COUNT(*) c FROM compliance_tasks GROUP BY status`
  ).all().reduce((acc, x) => (acc[x.status] = x.c, acc), {});
  res.json({ total: rows.length, summary, categories: byCat });
});

router.post('/', (req, res) => {
  const { category, title, description = null, owner = null, due_date = null, link = null, notes = null } = req.body;
  if (!category || !title) return res.status(400).json({ error: 'category and title required' });
  const maxOrder = db.prepare('SELECT COALESCE(MAX(sort_order),0)+10 n FROM compliance_tasks').get().n;
  const info = db.prepare(`
    INSERT INTO compliance_tasks (category, title, description, owner, due_date, link, notes, sort_order)
    VALUES (?,?,?,?,?,?,?,?)`
  ).run(category, title, description, owner, due_date, link, notes, maxOrder);
  res.status(201).json(db.prepare('SELECT * FROM compliance_tasks WHERE id=?').get(info.lastInsertRowid));
});

router.patch('/:id', (req, res) => {
  const t = db.prepare('SELECT * FROM compliance_tasks WHERE id=?').get(req.params.id);
  if (!t) return res.status(404).json({ error: 'not found' });
  const fields = ['category', 'title', 'description', 'status', 'owner', 'due_date', 'link', 'notes'];
  const sets = [];
  const vals = [];
  for (const f of fields) if (f in req.body) { sets.push(`${f}=?`); vals.push(req.body[f]); }
  if (sets.length) {
    sets.push(`updated_at=datetime('now')`);
    vals.push(req.params.id);
    db.prepare(`UPDATE compliance_tasks SET ${sets.join(', ')} WHERE id=?`).run(...vals);
  }
  res.json(db.prepare('SELECT * FROM compliance_tasks WHERE id=?').get(req.params.id));
});

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM compliance_tasks WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
