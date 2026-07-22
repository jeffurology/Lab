'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// CALIBRATION FILE — the ONE place to fix things when CoverMyMeds changes its UI.
//
// These selectors are placeholders based on typical portal structure. They MUST
// be calibrated against the live site once, using `npm run calibrate` (opens a
// headed browser so you can log in and inspect real elements).
//
// Each entry accepts a Playwright selector string. Prefer role/text selectors
// (e.g. "getByRole") expressed as CSS/text where possible — they survive redesigns
// better than brittle class names. Use `null` to mark a step as not-yet-calibrated;
// the driver will screenshot and pause instead of guessing.
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  login: {
    usernameInput: '#email, input[name="email"], input[type="email"]',
    passwordInput: '#password, input[name="password"], input[type="password"]',
    submitButton: 'button[type="submit"], button:has-text("Log In")',
    loggedInMarker: 'text=/dashboard|new request|requests/i', // proves login worked
  },

  newRequest: {
    startButton: 'a:has-text("New Request"), button:has-text("New Request")',
    // Drug + prescriber + patient are usually entered on a "start a request" form.
    drugSearchInput: 'input[placeholder*="medication" i], input[name*="drug" i]',
    drugFirstResult: '[role="option"]:first-of-type, li[role="option"]:first-child',
  },

  patient: {
    firstName: 'input[name*="firstName" i], input[name*="first_name" i]',
    lastName: 'input[name*="lastName" i], input[name*="last_name" i]',
    dob: 'input[name*="dob" i], input[name*="birth" i]',
    sex: 'select[name*="sex" i], select[name*="gender" i]',
    memberId: 'input[name*="member" i], input[name*="subscriber" i]',
    phone: 'input[name*="phone" i]',
    continueButton: 'button:has-text("Continue"), button:has-text("Next")',
  },

  pharmacy: {
    searchInput: 'input[placeholder*="pharmacy" i], input[name*="pharmacy" i]',
    ncpdpInput: 'input[name*="ncpdp" i]',
    firstResult: '[role="option"]:first-of-type',
    continueButton: 'button:has-text("Continue"), button:has-text("Next")',
  },

  clinical: {
    // The dynamic payer question set. These are highly variable; the driver
    // treats them generically (see portal.js answerQuestionSet).
    icd10Input: 'input[name*="icd" i], input[name*="diagnosis" i]',
    justificationTextarea: 'textarea[name*="justification" i], textarea[name*="clinical" i], textarea[name*="notes" i]',
    questionContainer: '[data-question], .question, fieldset',
    continueButton: 'button:has-text("Continue"), button:has-text("Next"), button:has-text("Review")',
  },

  review: {
    // The FINAL submit. The driver stops here unless AUTO_SUBMIT is on.
    submitButton: 'button:has-text("Submit"), button:has-text("Send Request")',
    confirmationMarker: 'text=/submitted|reference|confirmation|success/i',
    referenceNumber: '[data-reference], .reference-number',
  },
};
