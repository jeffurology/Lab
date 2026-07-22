'use strict';

// Twilio inbound SMS webhook. When a patient replies with missing info, map it
// onto the most recent case awaiting that patient and advance the workflow.
//
// NOTE: configure this URL as the messaging webhook on your Twilio number:
//   <PUBLIC_BASE_URL>/webhooks/twilio/inbound

const express = require('express');
const store = require('../store');
const twilio = require('../twilio');
const { log } = require('../phi');

const router = express.Router();

// Twilio posts application/x-www-form-urlencoded.
router.post('/twilio/inbound', express.urlencoded({ extended: false }), (req, res) => {
  const from = req.body.From;
  const body = String(req.body.Body || '');

  const twiml = (msg) => {
    res.set('Content-Type', 'text/xml');
    res.send(`<?xml version="1.0" encoding="UTF-8"?><Response>${msg ? `<Message>${msg}</Message>` : ''}</Response>`);
  };

  // Find the newest un-purged case for this phone number.
  const target = findCaseByPhone(from);
  if (!target) return twiml('');

  if (twilio.isStop(body)) {
    target.consent = { ...(target.consent || {}), granted: false, revokedAt: Date.now() };
    store.event(target.id, 'consent-revoked-sms');
    return twiml('You have been opted out. We will not text you again about this request.');
  }

  const parsed = twilio.parseInboundReply(body);
  if (parsed.dob) target.patient.dob = parsed.dob;
  if (parsed.memberId) target.patient.memberId = parsed.memberId;
  if (parsed.pharmacy) target.pharmacy.name = parsed.pharmacy;
  store.update(target.id, {});
  store.event(target.id, 'patient-reply-parsed', { fields: Object.keys(parsed) });
  log('inbound reply parsed', { case: target.id, fields: Object.keys(parsed) });

  const stillMissing = store.missingFields(target)
    .filter((m) => ['pharmacy', 'DOB', 'insurance member ID'].includes(m));
  if (stillMissing.length) {
    return twiml(`Thanks! We still need: ${stillMissing.join(', ')}. Please reply with those.`);
  }
  return twiml('Thank you — we have what we need and will submit your prior authorization.');
});

// Delivery-status callback (optional).
router.post('/twilio/status', express.urlencoded({ extended: false }), (req, res) => {
  log('sms status', { sid: req.body.MessageSid, status: req.body.MessageStatus });
  res.sendStatus(204);
});

function findCaseByPhone(phone) {
  if (!phone) return null;
  const norm = String(phone).replace(/\D/g, '').slice(-10);
  let best = null;
  for (const id of iterateIds()) {
    const c = store.get(id);
    if (!c?.patient?.phone) continue;
    if (String(c.patient.phone).replace(/\D/g, '').slice(-10) === norm) {
      if (!best || c.updatedAt > best.updatedAt) best = c;
    }
  }
  return best;
}

// store doesn't expose ids publicly; walk via a lightweight accessor.
function* iterateIds() {
  yield* store._ids ? store._ids() : [];
}

module.exports = router;
