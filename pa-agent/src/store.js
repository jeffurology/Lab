'use strict';

// Ephemeral, in-memory case store. PHI NEVER touches disk.
// Each case auto-purges after config.caseTtlMs, or immediately on request.

const crypto = require('crypto');
const config = require('./config');
const { log } = require('./phi');

const cases = new Map(); // id -> { case, timer }

function newId() {
  return crypto.randomBytes(9).toString('base64url');
}

function create(initial = {}) {
  const id = newId();
  const now = Date.now();
  const record = {
    id,
    status: 'intake', // intake -> awaiting_patient -> ready -> filling -> awaiting_confirm -> submitted | error
    createdAt: now,
    updatedAt: now,
    consent: null,
    patient: {},      // demographics + insurance (PHI)
    medication: {},   // drug, strength, indication, ICD-10
    clinical: {},      // step therapy, diagnoses, labs, rationale inputs
    pharmacy: {},      // name, NCPDP/phone
    justification: '', // drafted narrative
    portal: { steps: [], screenshots: [] },
    events: [],
    ...initial,
  };
  const timer = setTimeout(() => purge(id, 'ttl'), config.caseTtlMs);
  timer.unref?.();
  cases.set(id, { record, timer });
  event(id, 'created');
  return record;
}

function get(id) {
  return cases.get(id)?.record || null;
}

function update(id, patch) {
  const entry = cases.get(id);
  if (!entry) return null;
  Object.assign(entry.record, patch, { updatedAt: Date.now() });
  return entry.record;
}

function event(id, type, detail) {
  const rec = get(id);
  if (!rec) return;
  rec.events.push({ t: Date.now(), type, detail });
  log(`case ${id}: ${type}`, detail ? { detail } : '');
}

function purge(id, reason = 'manual') {
  const entry = cases.get(id);
  if (!entry) return false;
  clearTimeout(entry.timer);
  // Best-effort scrub of PHI fields before dropping the reference.
  const r = entry.record;
  r.patient = {}; r.clinical = {}; r.pharmacy = {}; r.justification = '';
  cases.delete(id);
  log(`case ${id}: purged (${reason})`);
  return true;
}

// A PHI-free summary safe to send to the browser status view.
function safeSummary(id) {
  const r = get(id);
  if (!r) return null;
  return {
    id: r.id,
    status: r.status,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    hasConsent: Boolean(r.consent?.granted),
    medication: { drug: r.medication.drug, indication: r.medication.indication },
    missing: missingFields(r),
    portalSteps: r.portal.steps,
    events: r.events.map((e) => ({ t: e.t, type: e.type })),
  };
}

function missingFields(r) {
  const missing = [];
  if (!r.patient.firstName || !r.patient.lastName) missing.push('patient name');
  if (!r.patient.dob) missing.push('DOB');
  if (!r.patient.memberId) missing.push('insurance member ID');
  if (!r.pharmacy.name && !r.pharmacy.ncpdp) missing.push('pharmacy');
  if (!r.medication.drug) missing.push('medication');
  if (!r.medication.icd10) missing.push('ICD-10 diagnosis');
  return missing;
}

// Iterate live case ids (used by the Twilio inbound webhook to match a reply).
function _ids() {
  return cases.keys();
}

module.exports = { create, get, update, event, purge, safeSummary, missingFields, _ids };
