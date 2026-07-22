'use strict';

// Consent gate. No PA work — no patient texting, no portal automation — happens
// for a case until an explicit, timestamped consent record exists.

const CONSENT_TEXT =
  'I authorize this practice to use my clinical and insurance information to ' +
  'request prior authorization for my prescribed medication, and to contact me ' +
  'by text message about this request. Standard message/data rates may apply. ' +
  'Reply STOP to opt out of texts at any time.';

function record({ grantedBy, method, ip }) {
  return {
    granted: true,
    grantedAt: Date.now(),
    grantedBy: grantedBy || 'patient',   // 'patient' | 'verbal-documented-by-<staff>'
    method: method || 'web-form',        // 'web-form' | 'sms-reply' | 'verbal'
    text: CONSENT_TEXT,
    ip: ip || null,
  };
}

function requireConsent(caseRecord) {
  if (!caseRecord?.consent?.granted) {
    const err = new Error('Consent required before any PA action for this patient.');
    err.status = 428; // Precondition Required
    throw err;
  }
}

module.exports = { CONSENT_TEXT, record, requireConsent };
