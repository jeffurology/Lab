'use strict';

// Playwright driver for the CoverMyMeds provider portal.
//
// Design principles:
//  1. Fails SOFT. If a selector isn't calibrated / not found, it screenshots and
//     records "needs_calibration" for that step instead of throwing — so a half-
//     working calibration still shows you exactly where it got stuck.
//  2. HUMAN-CONFIRM by default. It fills everything, then PAUSES at the final
//     Submit button until confirmSubmit(caseId) is called from the UI. Only when
//     AUTO_SUBMIT=true and DRY_RUN=false will it submit unattended.
//  3. Uses the prescriber's OWN credentials, entered by them (or supplied in .env).
//     This automates the prescriber's own authorized workflow — nothing more.

const path = require('path');
const fs = require('fs');
const config = require('../config');
const S = require('./selectors');
const store = require('../store');
const { log } = require('../phi');

const SHOTS = path.join(__dirname, '..', '..', 'screenshots');
fs.mkdirSync(SHOTS, { recursive: true });

// Live browser sessions, keyed by caseId (a case can be paused mid-fill).
const sessions = new Map(); // caseId -> { browser, context, page }

async function launch() {
  const { chromium } = require('playwright');
  const browser = await chromium.launch({ headless: !config.headful });
  const context = await browser.newContext();
  const page = await context.newPage();
  return { browser, context, page };
}

async function shot(caseId, page, name) {
  const file = path.join(SHOTS, `${caseId}-${Date.now()}-${name}.png`);
  try {
    await page.screenshot({ path: file, fullPage: true });
    store.get(caseId)?.portal.screenshots.push(path.basename(file));
  } catch { /* ignore */ }
  return file;
}

function recordStep(caseId, step, status, note) {
  store.get(caseId)?.portal.steps.push({ step, status, note: note || null, t: Date.now() });
  store.event(caseId, `portal:${step}`, { status });
}

// Fill a field defensively. Returns true if it worked.
async function tryFill(caseId, page, sel, value, step) {
  if (!sel || value == null || value === '') {
    recordStep(caseId, step, 'skipped', !sel ? 'no selector (needs calibration)' : 'no value');
    return false;
  }
  try {
    await page.locator(sel).first().fill(String(value), { timeout: 8000 });
    recordStep(caseId, step, 'ok');
    return true;
  } catch (e) {
    recordStep(caseId, step, 'needs_calibration', e.message.split('\n')[0]);
    await shot(caseId, page, `${step}-FAILED`);
    return false;
  }
}

async function tryClick(caseId, page, sel, step) {
  if (!sel) { recordStep(caseId, step, 'skipped', 'no selector'); return false; }
  try {
    await page.locator(sel).first().click({ timeout: 8000 });
    recordStep(caseId, step, 'ok');
    return true;
  } catch (e) {
    recordStep(caseId, step, 'needs_calibration', e.message.split('\n')[0]);
    await shot(caseId, page, `${step}-FAILED`);
    return false;
  }
}

async function login(caseId, page) {
  await page.goto(config.cmm.loginUrl, { waitUntil: 'domcontentloaded' });
  if (config.cmm.username && config.cmm.password) {
    await tryFill(caseId, page, S.login.usernameInput, config.cmm.username, 'login-username');
    await tryFill(caseId, page, S.login.passwordInput, config.cmm.password, 'login-password');
    await tryClick(caseId, page, S.login.submitButton, 'login-submit');
  } else {
    // Manual login: pause for the prescriber to log in by hand in the headed window.
    recordStep(caseId, 'login', 'awaiting_manual_login', 'Log in by hand in the browser window.');
    log(`case ${caseId}: waiting for manual login…`);
  }
  try {
    await page.locator(S.login.loggedInMarker).first().waitFor({ timeout: 120000 });
    recordStep(caseId, 'login', 'ok');
  } catch {
    recordStep(caseId, 'login', 'needs_calibration', 'Never saw logged-in marker.');
    await shot(caseId, page, 'login-check');
  }
}

// Fill the whole PA up to (but not including) the final submit.
async function fill(caseId) {
  const c = store.get(caseId);
  if (!c) throw new Error('case not found');
  store.update(caseId, { status: 'filling' });

  const s = await launch();
  sessions.set(caseId, s);
  const { page } = s;

  try {
    await login(caseId, page);

    // Start a new request + pick the drug.
    await tryClick(caseId, page, S.newRequest.startButton, 'new-request');
    if (await tryFill(caseId, page, S.newRequest.drugSearchInput, c.medication.drug, 'drug-search')) {
      await tryClick(caseId, page, S.newRequest.drugFirstResult, 'drug-select');
    }

    // Patient demographics + insurance.
    await tryFill(caseId, page, S.patient.firstName, c.patient.firstName, 'patient-first');
    await tryFill(caseId, page, S.patient.lastName, c.patient.lastName, 'patient-last');
    await tryFill(caseId, page, S.patient.dob, c.patient.dob, 'patient-dob');
    await tryFill(caseId, page, S.patient.memberId, c.patient.memberId, 'patient-member');
    await tryFill(caseId, page, S.patient.phone, c.patient.phone, 'patient-phone');
    await tryClick(caseId, page, S.patient.continueButton, 'patient-continue');

    // Pharmacy.
    if (c.pharmacy.ncpdp) {
      await tryFill(caseId, page, S.pharmacy.ncpdpInput, c.pharmacy.ncpdp, 'pharmacy-ncpdp');
    } else if (c.pharmacy.name) {
      if (await tryFill(caseId, page, S.pharmacy.searchInput, c.pharmacy.name, 'pharmacy-search')) {
        await tryClick(caseId, page, S.pharmacy.firstResult, 'pharmacy-select');
      }
    }
    await tryClick(caseId, page, S.pharmacy.continueButton, 'pharmacy-continue');

    // Clinical: ICD-10 + the medical-necessity justification.
    await tryFill(caseId, page, S.clinical.icd10Input, c.medication.icd10, 'clinical-icd10');
    await tryFill(caseId, page, S.clinical.justificationTextarea, c.justification, 'clinical-justification');
    await answerQuestionSet(caseId, page, c);
    await tryClick(caseId, page, S.clinical.continueButton, 'clinical-continue');

    await shot(caseId, page, 'review');
    store.update(caseId, { status: 'awaiting_confirm' });
    recordStep(caseId, 'review', 'awaiting_confirm', 'Filled up to final submit. Review the screenshot, then confirm.');

    // Unattended submit only when explicitly allowed.
    if (config.autoSubmit && !config.dryRun) {
      return await confirmSubmit(caseId);
    }
    return store.safeSummary(caseId);
  } catch (e) {
    recordStep(caseId, 'fill', 'error', e.message);
    store.update(caseId, { status: 'error' });
    await shot(caseId, page, 'error');
    throw e;
  }
}

// Best-effort pass over the dynamic payer question set. Highly payer-specific,
// so for anything it can't confidently answer it screenshots and leaves it for
// the prescriber to complete in the paused window.
async function answerQuestionSet(caseId, page, c) {
  try {
    const containers = page.locator(S.clinical.questionContainer);
    const n = await containers.count();
    recordStep(caseId, 'question-set', n ? 'found' : 'none', `${n} question block(s)`);
    if (n) await shot(caseId, page, 'question-set');
    // Intentionally conservative: we do not auto-answer clinical yes/no questions,
    // because a wrong answer can wrongly deny or misrepresent. The prescriber
    // answers these in the paused window before confirming.
  } catch { /* ignore */ }
}

// Click the real Submit. Called by the /confirm route (human-in-the-loop) or,
// when AUTO_SUBMIT is on, directly by fill().
async function confirmSubmit(caseId) {
  const s = sessions.get(caseId);
  if (!s) throw new Error('No live portal session for this case (it may have timed out).');
  const { page } = s;

  if (config.dryRun) {
    recordStep(caseId, 'submit', 'dry_run', 'DRY_RUN=true — not clicking Submit.');
    store.update(caseId, { status: 'ready' });
    await shot(caseId, page, 'dry-run-final');
    await close(caseId);
    return store.safeSummary(caseId);
  }

  const clicked = await tryClick(caseId, page, S.review.submitButton, 'submit');
  if (!clicked) {
    store.update(caseId, { status: 'error' });
    throw new Error('Could not find the Submit button — calibrate review.submitButton.');
  }
  try {
    await page.locator(S.review.confirmationMarker).first().waitFor({ timeout: 30000 });
    let ref = null;
    try { ref = (await page.locator(S.review.referenceNumber).first().innerText()).trim(); } catch {}
    recordStep(caseId, 'submit', 'ok', ref ? `reference ${ref}` : 'submitted');
    store.update(caseId, { status: 'submitted', reference: ref });
    await shot(caseId, page, 'confirmation');
  } catch {
    recordStep(caseId, 'submit', 'unconfirmed', 'Clicked Submit but never saw confirmation.');
    store.update(caseId, { status: 'submitted_unconfirmed' });
    await shot(caseId, page, 'post-submit');
  }
  await close(caseId);
  return store.safeSummary(caseId);
}

async function close(caseId) {
  const s = sessions.get(caseId);
  if (!s) return;
  try { await s.browser.close(); } catch {}
  sessions.delete(caseId);
}

module.exports = { fill, confirmSubmit, close, sessions };
