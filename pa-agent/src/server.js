'use strict';

const path = require('path');
const express = require('express');
const config = require('./config');
const consent = require('./consent');
const { log } = require('./phi');

const app = express();
app.use(express.json({ limit: '256kb' }));

// Webhooks first (they parse urlencoded bodies themselves).
app.use('/webhooks', require('./routes/webhooks'));
app.use('/api/cases', require('./routes/cases'));

// Expose the consent text + current safety posture to the UI.
app.get('/api/config', (req, res) => {
  res.json({
    consentText: consent.CONSENT_TEXT,
    autoSubmit: config.autoSubmit,
    dryRun: config.dryRun,
    twilioEnabled: config.twilio.enabled,
    anthropicEnabled: config.anthropic.enabled,
    caseTtlMinutes: Math.round(config.caseTtlMs / 60000),
  });
});

app.get('/healthz', (req, res) => res.json({ ok: true }));

app.use(express.static(path.join(__dirname, '..', 'public')));

app.listen(config.port, () => {
  log(`pa-agent listening on http://localhost:${config.port}`);
  log(`safety: DRY_RUN=${config.dryRun} AUTO_SUBMIT=${config.autoSubmit} HEADFUL=${config.headful}`);
  if (config.dryRun) log('DRY_RUN is on — the portal driver fills + screenshots but never submits.');
});
