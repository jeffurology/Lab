# Snellville Lab Tracker

Operations-tracking web app for the Snellville (1555 Janmar Rd) **PSA / IsoPSA**
laboratory: specimen accessioning, courier logistics, **cobas** run batches, daily QC,
results & turnaround, plus a built-in **CLIA launch checklist**.

> Regulatory / operational launch guidance lives in **[PLANNING.md](./PLANNING.md)**.
> Start there for the CLIA, Georgia, personnel, billing, and IsoPSA decisions.

## What it does

| Tab | Purpose |
|---|---|
| **Dashboard** | Daily PSA/IsoPSA volume vs targets (100 / 20), utilization, pending count, 7-day turnaround, 14-day trend, by-location volume, recent QC issues. |
| **Accessioning** | Receive specimens (unique accession #, origin clinic, test, STAT), enter results, auto-flag PSA > 4 ng/mL. |
| **Runs** | Group received specimens into cobas runs, record QC pass, complete the run. |
| **QC** | Log daily QC; auto-evaluates **Westgard 1-2s (warning) / 1-3s (fail)** from target + SD. |
| **Couriers** | Log daily pickups from each clinic with count, courier, and temperature. |
| **Locations** | Manage clinics that send specimens to Snellville. |
| **CLIA Checklist** | The PLANNING.md roadmap as a trackable, status-able checklist (seeded with 26 tasks). |

## Tech

- **Backend:** Node.js + Express + SQLite (`better-sqlite3`). No external services.
- **Frontend:** plain HTML/CSS/JS — **no build step**.
- **Data:** single SQLite file at `data/lab.db` (git-ignored).

## Run it

```bash
npm install      # install dependencies
npm run seed     # load sample locations + the CLIA checklist (safe to re-run)
npm start        # serve at http://localhost:3000
```

Dev mode with auto-reload: `npm run dev`.
Change the port with `PORT=8080 npm start`; change the DB path with `LAB_DB_PATH=...`.

## API (JSON)

```
GET    /api/health
GET    /api/analytics/dashboard?date=YYYY-MM-DD
CRUD   /api/locations
GET    /api/specimens?date=&status=&location_id=&test_type=
POST   /api/specimens            PATCH /api/specimens/:id
POST   /api/specimens/:id/results
CRUD   /api/batches              POST /api/batches/:id/assign
GET    /api/qc                   POST /api/qc        (auto Westgard eval)
GET    /api/couriers             POST /api/couriers
GET    /api/compliance           POST/PATCH/DELETE /api/compliance/:id
```

## ⚠️ PHI & HIPAA — read before real use

This app is an **internal operations tracker**, not a certified LIS or result-reporting
system, and it ships **without authentication**. Before storing any patient-identifiable
information:

- Deploy on **HIPAA-compliant infrastructure** with a signed **BAA**.
- Add **authentication / access control**, **audit logging**, and **encryption** in
  transit and at rest.
- Until then, keep the **patient reference** field **de-identified** (use accession
  numbers, not names/MRNs). The app shows a persistent warning banner to this effect.

## Roadmap ideas

- User authentication + role-based access and audit trail.
- cobas/middleware result interface (replace manual entry).
- Levey–Jennings QC charts, PT tracking, instrument maintenance log.
- CSV/PDF export and printable accession labels with barcodes.
