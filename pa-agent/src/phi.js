'use strict';

// PHI-safe logging. Never let names, DOB, MRN, phone, member IDs reach logs
// or screenshots' filenames. Redact aggressively.

const PHONE = /\b\+?1?[\s.-]?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/g;
const DOB = /\b(0?[1-9]|1[0-2])[\/-](0?[1-9]|[12]\d|3[01])[\/-](19|20)\d\d\b/g;
const SSN = /\b\d{3}-\d{2}-\d{4}\b/g;
const EMAIL = /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g;

function redact(str) {
  if (str == null) return str;
  return String(str)
    .replace(SSN, '[ssn]')
    .replace(PHONE, '[phone]')
    .replace(DOB, '[dob]')
    .replace(EMAIL, '[email]');
}

// Redact known PHI fields from an object for logging.
const PHI_KEYS = new Set([
  'firstName', 'lastName', 'name', 'dob', 'dateOfBirth', 'phone', 'mobile',
  'ssn', 'memberId', 'mrn', 'address', 'email', 'subscriberId',
]);

function scrub(obj) {
  if (obj == null || typeof obj !== 'object') return redact(obj);
  if (Array.isArray(obj)) return obj.map(scrub);
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    out[k] = PHI_KEYS.has(k) ? '[redacted]' : scrub(v);
  }
  return out;
}

function log(...args) {
  console.log('[pa-agent]', ...args.map((a) => (typeof a === 'object' ? JSON.stringify(scrub(a)) : redact(a))));
}

module.exports = { redact, scrub, log };
