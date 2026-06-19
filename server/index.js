'use strict';

const path = require('path');
const express = require('express');

const app = express();
app.use(express.json());

// Tiny request logger
app.use((req, _res, next) => {
  if (req.path.startsWith('/api')) {
    console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  }
  next();
});

// API routes
app.use('/api/locations', require('./routes/locations'));
app.use('/api/specimens', require('./routes/specimens'));
app.use('/api/batches', require('./routes/batches'));
app.use('/api/qc', require('./routes/qc'));
app.use('/api/couriers', require('./routes/couriers'));
app.use('/api/compliance', require('./routes/compliance'));
app.use('/api/analytics', require('./routes/analytics'));

app.get('/api/health', (_req, res) => res.json({ ok: true, time: new Date().toISOString() }));

// Static frontend
app.use(express.static(path.join(__dirname, '..', 'public')));

// JSON error handler
app.use((err, _req, res, _next) => {
  console.error(err);
  const status = err.status || (/UNIQUE|CHECK|FOREIGN KEY/.test(err.message) ? 400 : 500);
  res.status(status).json({ error: err.message });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Snellville Lab Tracker running → http://localhost:${PORT}`);
});
