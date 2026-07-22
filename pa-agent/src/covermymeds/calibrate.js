'use strict';

// One-time calibration helper.
//
//   npm run calibrate
//
// Opens a headed browser at the CoverMyMeds login page and pauses with the
// Playwright Inspector so you can:
//   1. Log in with your real credentials.
//   2. Start a New Request and click through each step.
//   3. Right-click elements → "Copy selector", or use the Inspector's pick tool,
//      to read the true selectors for each field.
//   4. Paste those into src/covermymeds/selectors.js.
//
// Nothing here submits anything or stores PHI. It's purely for reading the DOM.

const config = require('../config');

(async () => {
  const { chromium } = require('playwright');
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(config.cmm.loginUrl, { waitUntil: 'domcontentloaded' });

  console.log('\n─────────────────────────────────────────────────────────────');
  console.log(' CoverMyMeds calibration — the browser is open.');
  console.log(' Log in, walk through a New Request, and read the real selectors.');
  console.log(' Use the Inspector\'s pick tool (top-left) to identify elements.');
  console.log(' Paste findings into src/covermymeds/selectors.js.');
  console.log(' Close the browser window when done.');
  console.log('─────────────────────────────────────────────────────────────\n');

  // Opens the Playwright Inspector and blocks until you resume/close.
  await page.pause();
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
