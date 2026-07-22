# pa-agent — free prior-authorization helper for CoverMyMeds

A provider-in-the-loop agent for a **single practice**. It takes clinical info +
demographics + the medication (with the patient's consent), texts the patient for
anything missing (pharmacy, DOB, member ID), **drafts the medical-necessity
justification**, then drives the CoverMyMeds provider portal and **fills the entire
PA — stopping at the final Submit button** so the prescriber reviews and confirms.

Built for one goal: make prior auth easy and free for patients, without cutting the
corners that matter (consent, accuracy, and who attests to medical necessity).

## How it works

```
Intake (clinical + demographics + med)
   │  patient consent captured  ← required gate
   ▼
Missing info?  ──▶ Twilio SMS to patient (pharmacy / DOB / member ID)
   │                         └─ reply parsed back onto the case
   ▼
Draft medical-necessity justification  (deterministic template; optional Claude polish)
   │  prescriber reviews & edits  ← you own the attestation
   ▼
Playwright fills CoverMyMeds with the prescriber's own login
   │  screenshots every step
   ▼
STOPS at final Submit  ──▶ prescriber clicks "Confirm & Submit"  ──▶ done
```

## Safety & compliance posture

This tool automates **the prescriber's own authorized workflow** — it does what you'd
do by hand, faster. It is deliberately built so:

- **You attest, not the AI.** The justification is a *draft*; nothing is submitted until
  you review it and click Confirm. `AUTO_SUBMIT=false` and `DRY_RUN=true` by default.
- **PHI is ephemeral.** Patient data lives only in memory, auto-purges after
  `CASE_TTL_MINUTES`, and never touches disk or git. Logs are PHI-redacted. Portal
  screenshots *can* contain PHI and are git-ignored.
- **Consent is a hard gate.** No texting and no portal automation happen for a case
  until a consent record exists.

Before going live you still owe the paperwork this code can't do for you:

- **BAAs**: sign one with **Twilio** (before texting PHI) and with **Anthropic**
  (before enabling Claude polish). Both offer them.
- **CoverMyMeds Terms of Service**: automating the portal is a grey area. You are using
  your own credentials for your own patients; confirm this is acceptable under your
  account terms. The durable alternative is CoverMyMeds' sanctioned ePA API (partner
  onboarding required) — this codebase can be pointed at that later.
- **TCPA/consent** for SMS is handled at the consent gate + STOP keyword, but review it
  against your state's rules.

## Launch it (one step, no copy-paste)

**macOS — double-click:** open the `pa-agent` folder in Finder and double-click
**`Launch pa-agent.command`**. The first run installs everything and opens the app
in your browser at http://localhost:3100; later runs just start it. (If macOS blocks
it the first time: right-click → Open → Open.)

**Any OS — one command:**

```bash
cd pa-agent
npm run launch
```

Either way the launcher installs dependencies + the browser on first run, creates
`.env` from the template (starting in safe `DRY_RUN` mode — nothing submits), starts
the server, and opens your browser. Stop it with Ctrl-C.

### Manual setup (if you prefer)

```bash
cd pa-agent
npm install
cp .env.example .env      # fill in Twilio, optional Anthropic; leave CMM creds blank to log in by hand
npm start                 # http://localhost:3100
```

### One-time CoverMyMeds calibration (required)

The portal's selectors ship as placeholders. Calibrate them once against the live site:

```bash
npm run calibrate         # opens a headed browser + Playwright Inspector
```

Log in, start a New Request, walk each step, read the real selectors (Inspector pick
tool / "Copy selector"), and paste them into `src/covermymeds/selectors.js`. The driver
**fails soft** — any un-calibrated field is screenshotted and marked
`needs_calibration` rather than crashing, so you can calibrate incrementally.

## Environment variables

See `.env.example`. Key switches:

| Var | Default | Meaning |
|---|---|---|
| `DRY_RUN` | `true` | Fill + screenshot only; never click Submit. Best while calibrating. |
| `AUTO_SUBMIT` | `false` | If `true` (and `DRY_RUN=false`), submit without waiting for a human. Leave off. |
| `HEADFUL` | `true` | Show the browser window. |
| `CMM_USERNAME`/`CMM_PASSWORD` | empty | Leave blank to log in by hand each run. |
| `CASE_TTL_MINUTES` | `120` | How long PHI is held in memory before auto-purge. |

## API (all PHI-free in responses)

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/cases` | Create a case from an intake payload |
| `POST` | `/api/cases/:id/consent` | Record patient consent (gate) |
| `POST` | `/api/cases/:id/text-patient` | SMS the patient for missing pharmacy/DOB/member ID |
| `POST` | `/api/cases/:id/draft` | Draft the medical-necessity justification |
| `PUT`  | `/api/cases/:id/justification` | Save the prescriber-edited justification |
| `POST` | `/api/cases/:id/submit` | Fill the portal, stop at final Submit |
| `POST` | `/api/cases/:id/confirm` | Click the real Submit (human confirm) |
| `DELETE` | `/api/cases/:id` | Purge PHI immediately |
| `POST` | `/webhooks/twilio/inbound` | Twilio inbound SMS (set as your number's webhook) |

## What this is **not**

- Not an unattended bot that submits PAs on its own (unless you flip `AUTO_SUBMIT`).
- Not a replacement for clinical judgment — the medical-necessity attestation is yours.
- Not a HIPAA/BAA guarantee — that's your paperwork; the code just keeps PHI ephemeral.
