'use strict';
const router = require('express').Router();
const db = require('../db');

const SELECT = `SELECT c.*, l.code AS location_code, l.name AS location_name
                FROM couriers c JOIN locations l ON l.id = c.location_id`;

router.get('/', (req, res) => {
  const where = [];
  const params = {};
  if (req.query.date) { where.push('c.pickup_date=@date'); params.date = req.query.date; }
  if (req.query.location_id) { where.push('c.location_id=@location_id'); params.location_id = req.query.location_id; }
  const sql = SELECT + (where.length ? ' WHERE ' + where.join(' AND ') : '') +
    ' ORDER BY c.pickup_date DESC, c.id DESC LIMIT 300';
  res.json(db.prepare(sql).all(params));
});

router.post('/', (req, res) => {
  const {
    location_id, pickup_date, pickup_time = null, received_at = null,
    specimen_count = 0, courier_name = null, temp_ok = 1, temp_c = null, notes = null,
  } = req.body;
  if (!location_id || !pickup_date)
    return res.status(400).json({ error: 'location_id and pickup_date required' });
  const info = db.prepare(`
    INSERT INTO couriers (location_id, pickup_date, pickup_time, received_at, specimen_count, courier_name, temp_ok, temp_c, notes)
    VALUES (?,?,?,?,?,?,?,?,?)`
  ).run(location_id, pickup_date, pickup_time, received_at, specimen_count, courier_name, temp_ok ? 1 : 0, temp_c, notes);
  res.status(201).json(db.prepare(SELECT + ' WHERE c.id=?').get(info.lastInsertRowid));
});

module.exports = router;
