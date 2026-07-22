'use strict';

const express = require('express');
const store = require('../store');
const consent = require('../consent');
const justification = require('../justification');
const twilio = require('../twilio');
const portal = require('../covermymeds/portal');

const router = express.Router();

// Wrap async handlers so thrown errors (with optional .status) become responses.
const h = (fn) => (req, res) => Promise.resolve(fn(req, res)).catch((e) => {
  res.status(e.status || 500).json({ error: e.message });
});

// Create a case from an intake payload.
router.post('/', h((req, res) => {
  const { patient = {}, medication = {}, clinical = {}, pharmacy = {} } = req.body || {};
  const c = store.create({ patient, medication, clinical, pharmacy });
  res.status(201).json(store.safeSummary(c.id));
}));

// Read a PHI-free status summary.
router.get('/:id', h((req, res) => {
  const s = store.safeSummary(req.params.id);
  if (!s) return res.status(404).json({ error: 'case not found or purged' });
  res.json(s);
}));

// Patch case fields (patient/medication/clinical/pharmacy).
router.patch('/:id', h((req, res) => {
  const c = store.get(req.params.id);
  if (!c) return res.status(404).json({ error: 'case not found' });
  for (const k of ['patient', 'medication', 'clinical', 'pharmacy']) {
    if (req.body?.[k]) Object.assign(c[k], req.body[k]);
  }
  store.update(c.id, {});
  res.json(store.safeSummary(c.id));
}));

// Record patient consent. Gate for all downstream actions.
router.post('/:id/consent', h((req, res) => {
  const c = store.get(req.params.id);
  if (!c) return res.status(404).json({ error: 'case not found' });
  c.consent = consent.record({
    grantedBy: req.body?.grantedBy,
    method: req.body?.method,
    ip: req.ip,
  });
  store.event(c.id, 'consent-granted', { method: c.consent.method });
  res.json(store.safeSummary(c.id));
}));

// Text the patient for whatever is still missing (needs consent + Twilio).
router.post('/:id/text-patient', h(async (req, res) => {
  const c = store.get(req.params.id);
  if (!c) return res.status(404).json({ error: 'case not found' });
  consent.requireConsent(c);
  const missing = store.missingFields(c);
  const asked = missing.filter((m) => ['pharmacy', 'DOB', 'insurance member ID'].includes(m));
  if (!asked.length) return res.json({ asked: [], note: 'Nothing missing that the patient can supply.' });
  const r = await twilio.sendMissingInfoRequest(c, asked);
  store.update(c.id, { status: 'awaiting_patient' });
  store.event(c.id, 'patient-texted', { asked });
  res.json({ asked, sid: r.sid });
}));

// Draft (or redraft) the medical-necessity justification. Prescriber edits it.
router.post('/:id/draft', h(async (req, res) => {
  const c = store.get(req.params.id);
  if (!c) return res.status(404).json({ error: 'case not found' });
  const text = await justification.build(c, { polish: req.body?.polish !== false });
  store.update(c.id, { justification: text });
  store.event(c.id, 'justification-drafted');
  res.json({ justification: text });
}));

// Prescriber saves the final, reviewed justification text.
router.put('/:id/justification', h((req, res) => {
  const c = store.get(req.params.id);
  if (!c) return res.status(404).json({ error: 'case not found' });
  c.justification = String(req.body?.justification || '');
  store.update(c.id, {});
  res.json({ justification: c.justification });
}));

// Start driving the portal: fills the whole PA, then pauses at final Submit.
router.post('/:id/submit', h(async (req, res) => {
  const c = store.get(req.params.id);
  if (!c) return res.status(404).json({ error: 'case not found' });
  consent.requireConsent(c);
  if (!c.justification) return res.status(428).json({ error: 'Draft & review the justification first.' });
  const summary = await portal.fill(c.id);
  res.json(summary);
}));

// Human confirm: click the real Submit on the paused portal session.
router.post('/:id/confirm', h(async (req, res) => {
  const c = store.get(req.params.id);
  if (!c) return res.status(404).json({ error: 'case not found' });
  if (c.status !== 'awaiting_confirm') {
    return res.status(409).json({ error: `Case is "${c.status}", not awaiting confirmation.` });
  }
  const summary = await portal.confirmSubmit(c.id);
  res.json(summary);
}));

// Abort a paused portal session without submitting.
router.post('/:id/cancel', h(async (req, res) => {
  await portal.close(req.params.id);
  store.update(req.params.id, { status: 'cancelled' });
  res.json(store.safeSummary(req.params.id) || { ok: true });
}));

// Purge PHI immediately.
router.delete('/:id', h(async (req, res) => {
  await portal.close(req.params.id);
  res.json({ purged: store.purge(req.params.id, 'manual') });
}));

module.exports = router;
