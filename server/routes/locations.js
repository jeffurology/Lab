'use strict';
const router = require('express').Router();
const db = require('../db');

router.get('/', (_req, res) => {
  res.json(db.prepare('SELECT * FROM locations ORDER BY active DESC, name').all());
});

router.post('/', (req, res) => {
  const { code, name, address = '', contact = '', active = 1 } = req.body;
  if (!code || !name) return res.status(400).json({ error: 'code and name are required' });
  const info = db.prepare(
    'INSERT INTO locations (code, name, address, contact, active) VALUES (?,?,?,?,?)'
  ).run(code.trim().toUpperCase(), name, address, contact, active ? 1 : 0);
  res.status(201).json(db.prepare('SELECT * FROM locations WHERE id=?').get(info.lastInsertRowid));
});

router.put('/:id', (req, res) => {
  const { name, address, contact, active } = req.body;
  const existing = db.prepare('SELECT * FROM locations WHERE id=?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'not found' });
  db.prepare('UPDATE locations SET name=?, address=?, contact=?, active=? WHERE id=?').run(
    name ?? existing.name,
    address ?? existing.address,
    contact ?? existing.contact,
    active === undefined ? existing.active : (active ? 1 : 0),
    req.params.id
  );
  res.json(db.prepare('SELECT * FROM locations WHERE id=?').get(req.params.id));
});

module.exports = router;
