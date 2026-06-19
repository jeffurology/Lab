'use strict';

/**
 * Seeds reference data: clinic locations and the CLIA / launch compliance
 * checklist. Safe to re-run: it only inserts rows that don't already exist.
 *
 * Run with:  npm run seed
 */
const db = require('./db');

const locations = [
  { code: 'SNV', name: 'Snellville Lab — 1555 Janmar Rd', address: '1555 Janmar Rd, Snellville, GA', contact: '' },
  { code: 'LOC2', name: 'Satellite Clinic 2', address: '', contact: '' },
  { code: 'LOC3', name: 'Satellite Clinic 3', address: '', contact: '' },
];

const insertLoc = db.prepare(
  `INSERT OR IGNORE INTO locations (code, name, address, contact) VALUES (@code, @name, @address, @contact)`
);
for (const l of locations) insertLoc.run(l);

// CLIA / launch roadmap. status defaults to not_started; user updates in the UI.
const tasks = [
  // ---- Entity & site ----
  ['Entity & Facility', 'Confirm lab business entity & ownership', 'Decide whether the lab operates under the existing practice TIN or a new entity. Confirm CLIA applicant/owner and lab director of record.', 10],
  ['Entity & Facility', 'Build-out exam room → blood-draw / testing space', 'Convert the large exam room with sink at 1555 Janmar Rd: dedicated bench for the cobas analyzer, hand-wash sink, biohazard/sharps disposal, refrigeration for reagents/specimens, eyewash, adequate counter space and power/UPS.', 20],
  ['Entity & Facility', 'Verify zoning / landlord approval for lab use', 'Confirm the clinical office lease permits a moderate/high-complexity lab and any required tenant improvements.', 30],

  // ---- CLIA certificate ----
  ['CLIA', 'Determine CLIA certificate type', 'PSA on cobas is moderate complexity. IsoPSA, if performed in-house as a lab-developed/proprietary assay, is typically high complexity → drives Certificate of Compliance (CMS-surveyed) or Certificate of Accreditation (CAP/COLA). Confirm complexity per the FDA/CMS test categorization for each assay.', 40],
  ['CLIA', 'Submit CMS Form CMS-116 (CLIA application)', 'Complete and submit CMS-116 to the Georgia state survey agency (Healthcare Facility Regulation). Indicate certificate type, specialties (Chemistry / Immunology), and projected test volume.', 50],
  ['CLIA', 'Obtain CLIA number & pay certificate fee', 'CMS issues a CLIA number after the state agency processes CMS-116. Pay the certificate fee invoice from CMS. A registration/PPM cert can let limited testing begin while compliance survey is pending — confirm with the state.', 60],
  ['CLIA', 'Schedule initial CLIA survey / accreditation inspection', 'For Certificate of Compliance: state agency biennial survey. For Certificate of Accreditation: CAP or COLA inspection. Prepare the lab for the on-site visit.', 70],

  // ---- Georgia state ----
  ['Georgia State', 'Georgia clinical lab requirements', 'Georgia does not issue a separate state lab license beyond CLIA for most labs, but confirm current GA Dept. of Community Health / Healthcare Facility Regulation requirements and any drinking-water/biohazard permits.', 80],
  ['Georgia State', 'Georgia state-controlled / reporting registrations', 'Register for any required state lab reporting (e.g., reportable results) and confirm courier transport of specimens complies with state and DOT rules.', 90],

  // ---- Lab director & personnel ----
  ['Personnel', 'Appoint CLIA Laboratory Director', 'Moderate complexity: MD/DO or qualified doctoral scientist meeting CLIA director qualifications. High complexity (IsoPSA in-house): board-certified pathologist or doctoral scientist with required experience. One director may direct up to 5 labs.', 100],
  ['Personnel', 'Appoint Technical Consultant / Technical Supervisor', 'Moderate complexity needs a Technical Consultant & Clinical Consultant; high complexity needs a Technical Supervisor, Clinical Consultant, and General Supervisor. Document qualifications.', 110],
  ['Personnel', 'Hire / assign testing personnel & document competency', 'Testing personnel must meet CLIA education/experience requirements. Establish initial training + 6-month and annual competency assessment (6 CLIA elements).', 120],

  // ---- Instrument & methods ----
  ['Instrument & Methods', 'Procure & install Roche cobas analyzer', 'Order cobas (e, c, or cobas pure/cobas pro per volume). ~120 specimens/day (100 PSA + 20 IsoPSA) is modest — confirm throughput, sample type (serum), and reagent cold-chain. Schedule Roche IQ/OQ install.', 130],
  ['Instrument & Methods', 'Establish LIS / connectivity or manual result entry', 'Decide on a Laboratory Information System or middleware to interface the cobas, or define a validated manual result-entry workflow. Plan EHR result interface to ordering clinics.', 140],
  ['Instrument & Methods', 'Validate / verify PSA assay performance', 'For FDA-cleared cobas Total PSA: perform method verification (accuracy, precision, reportable range, reference interval verification) per CLIA §493.1253 before reporting patient results.', 150],
  ['Instrument & Methods', 'Resolve IsoPSA pathway', 'IsoPSA is a proprietary structure-based assay (Cleveland Diagnostics) — it is NOT a standard cobas reagent. Decide: (a) license/perform per vendor protocol as a high-complexity LDT with full validation, or (b) send-out to the reference lab and track logistics only. This decision changes certificate type, validation burden, and timeline.', 160],
  ['Instrument & Methods', 'Define reference ranges & critical/abnormal flags', 'Set PSA reference interval (e.g., age-adjusted) and define abnormal/critical thresholds and reflex rules. Configure in the tracker.', 170],

  // ---- Quality system ----
  ['Quality System', 'Write Quality Management / SOP manual', 'Author SOPs: specimen collection/handling, courier transport & temperature, accessioning, rejection criteria, testing, QC, result reporting, instrument maintenance, safety, and document control.', 180],
  ['Quality System', 'Enroll in Proficiency Testing (PT)', 'Enroll with an approved PT provider (e.g., CAP, API) for PSA (and IsoPSA if in-house). PT is required and must be tested like patient samples; failures are reportable.', 190],
  ['Quality System', 'Establish daily QC program', 'Define QC levels, frequency, target/SD, Westgard rules, and corrective action. Log QC in the tracker before releasing results.', 200],
  ['Quality System', 'Specimen transport & cold-chain validation', 'Validate courier routes from each clinic to Snellville: stability windows for PSA serum, packaging, temperature monitoring, and chain-of-custody. Track pickups in the tracker.', 210],

  // ---- Safety & billing ----
  ['Safety & Compliance', 'OSHA, biohazard & lab safety program', 'Bloodborne pathogen exposure plan, PPE, sharps/biohazard disposal contract, chemical hygiene, and staff safety training.', 220],
  ['Safety & Compliance', 'HIPAA / data security for results & tracker', 'Ensure any system storing PHI (LIS, EHR, this tracker if used for PHI) is on HIPAA-compliant infrastructure with access controls, audit logging, encryption, and a BAA with hosting vendors.', 230],
  ['Billing & Payor', 'Obtain billing NPI for the laboratory', 'Apply for a Type 2 (organizational) NPI for the lab if billing separately.', 240],
  ['Billing & Payor', 'Medicare / payor enrollment & test coverage', 'Enroll the lab with Medicare (CMS-855B) and commercial payors. Confirm CPT codes & coverage: PSA (84153 total / 84154 free); IsoPSA has its own coverage/PLA considerations. Review Stark/anti-markup rules for in-office reference testing.', 250],
  ['Billing & Payor', 'Confirm in-office vs reference lab billing rules', 'Validate Stark in-office ancillary services exception applicability and anti-markup rule for centralizing testing in Snellville from multiple sites.', 260],
];

const insertTask = db.prepare(
  `INSERT INTO compliance_tasks (category, title, description, sort_order)
   SELECT @category, @title, @description, @sort_order
   WHERE NOT EXISTS (SELECT 1 FROM compliance_tasks WHERE title = @title)`
);
const seedTasks = db.transaction((rows) => {
  for (const [category, title, description, sort_order] of rows) {
    insertTask.run({ category, title, description, sort_order });
  }
});
seedTasks(tasks);

console.log(`Seed complete: ${db.prepare('SELECT COUNT(*) c FROM locations').get().c} locations, ` +
  `${db.prepare('SELECT COUNT(*) c FROM compliance_tasks').get().c} compliance tasks.`);
