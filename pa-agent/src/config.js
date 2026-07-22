'use strict';

// Load .env if present (no hard dependency on dotenv — keep deps minimal).
require('fs').existsSync(require('path').join(__dirname, '..', '.env')) &&
  loadDotEnv(require('path').join(__dirname, '..', '.env'));

function loadDotEnv(file) {
  for (const line of require('fs').readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    const [, k, v] = m;
    if (process.env[k] === undefined) {
      process.env[k] = v.replace(/^["']|["']$/g, '');
    }
  }
}

const bool = (v, def) => (v === undefined ? def : /^(1|true|yes|on)$/i.test(v));

const config = {
  port: Number(process.env.PORT || 3100),

  // Safety switches
  autoSubmit: bool(process.env.AUTO_SUBMIT, false),
  dryRun: bool(process.env.DRY_RUN, true),
  headful: bool(process.env.HEADFUL, true),

  cmm: {
    username: process.env.CMM_USERNAME || '',
    password: process.env.CMM_PASSWORD || '',
    loginUrl: process.env.CMM_LOGIN_URL || 'https://www.covermymeds.com/login/',
  },

  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID || '',
    authToken: process.env.TWILIO_AUTH_TOKEN || '',
    from: process.env.TWILIO_FROM_NUMBER || '',
    publicBaseUrl: process.env.PUBLIC_BASE_URL || '',
    get enabled() {
      return Boolean(this.accountSid && this.authToken && this.from);
    },
  },

  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY || '',
    get enabled() {
      return Boolean(this.apiKey);
    },
  },

  caseTtlMs: Number(process.env.CASE_TTL_MINUTES || 120) * 60 * 1000,
};

module.exports = config;
