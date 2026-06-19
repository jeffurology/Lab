# Snellville Lab — PSA & IsoPSA Launch Plan

**Site:** 1555 Janmar Rd, Snellville, GA (existing clinical office; convert the large
exam room with sink to a dedicated specimen-processing / testing space)
**Model:** Central lab receives specimens couriered daily from all clinic locations,
runs on a Roche **cobas** analyzer.
**Projected volume:** ~100 PSA + ~20 IsoPSA per day (~120 specimens/day).

> ⚠️ **This is an operational planning aid, not legal, regulatory, or billing advice.**
> CLIA, Georgia, FDA, Stark, and payor rules change and have site-specific nuances.
> Confirm everything below with the **Georgia state survey agency (Healthcare Facility
> Regulation Division)**, **CMS**, a **lab-licensing/healthcare attorney**, and your
> **Roche/IVD and PT vendors** before relying on it. The in-app **CLIA Checklist** tab
> mirrors these steps so you can track them.

---

## 0. The single most important decision: how you handle **IsoPSA**

IsoPSA is **not a standard Roche cobas reagent**. It is a proprietary,
structure-based blood test (developed by **Cleveland Diagnostics**) reported as a
risk/probability for high-grade prostate cancer — not a ng/mL immunoassay you load on
cobas like total PSA. This drives your entire regulatory path. Pick one:

| Option | What it means | Regulatory impact |
|---|---|---|
| **A. Send-out** (recommended to start) | You draw/accession IsoPSA locally and ship to Cleveland Diagnostics' reference lab; they run & report. | Your lab only needs CLIA for the **PSA** you run in-house. IsoPSA = logistics + result tracking only. Fastest path to "start ASAP." |
| **B. In-house / licensed** | You perform IsoPSA on-site under license/tech transfer. | Almost certainly **high-complexity** testing ⇒ stricter personnel (pathologist/doctoral director), full method validation, and likely Certificate of **Compliance** or **Accreditation**. Months longer. |

**Recommendation:** Launch PSA in-house on cobas + **send IsoPSA out** (Option A).
You can revisit in-house IsoPSA later. The rest of this plan assumes PSA in-house;
in-house IsoPSA tasks are flagged.

---

## 1. CLIA certificate — what kind & how

Every site testing human specimens for health assessment needs a **CLIA certificate**.

- **PSA total** on cobas (FDA-cleared) = **moderate complexity**.
- **IsoPSA in-house** = **high complexity** (Option B only).

| Certificate | When | Oversight |
|---|---|---|
| Certificate of **Waiver** | Only waived tests — *not* applicable (PSA isn't waived). | — |
| Certificate of **Compliance (CoC)** | You run non-waived tests and are surveyed by the **state/CMS**. | CMS/GA biennial survey |
| Certificate of **Accreditation (CoA)** | Same testing, but inspected by an approved accreditor (**CAP** or **COLA**). | CAP/COLA |

**Process (CoC path — typical for a moderate-complexity in-office lab):**
1. Complete **CMS Form CMS-116** (application). Indicate certificate type, specialties
   (**Chemistry** and/or **Immunology** for PSA), and projected annual test volume.
2. Submit to the **Georgia state agency** (Healthcare Facility Regulation / GA DCH).
3. CMS issues a **CLIA number**; pay the **certificate fee** invoice.
4. A **Certificate of Registration** is issued, allowing you to begin testing while you
   await the initial **compliance survey** (confirm timing with the state).
5. Pass the on-site survey ⇒ **Certificate of Compliance** (renew every 2 years).

> "Start ASAP" reality check: the registration certificate is usually what lets you
> begin once CMS-116 is processed and fees paid — often a **few weeks to a couple of
> months**. Build-out, validation, PT enrollment, and hiring usually gate you more than
> the certificate itself.

---

## 2. Georgia state requirements

- Georgia generally relies on **CLIA** rather than a separate standalone state clinical
  lab license for most labs — **but confirm current GA DCH / Healthcare Facility
  Regulation requirements** for your specialty and volume.
- Confirm **specimen transport** between sites complies with state + **DOT/IATA**
  category-B (UN3373) packaging for the courier leg.
- Confirm any **reportable-results** obligations.

---

## 3. Personnel (CLIA-defined roles)

Moderate complexity (PSA in-house) minimum roles — one person can hold several:

| Role | Moderate complexity | High complexity (in-house IsoPSA) |
|---|---|---|
| **Laboratory Director** | MD/DO or qualified doctoral scientist meeting CLIA director criteria. May direct up to **5** labs. | Board-certified **pathologist** or doctoral scientist w/ required experience. |
| **Technical Consultant / Supervisor** | Technical Consultant | Technical Supervisor + General Supervisor |
| **Clinical Consultant** | Required | Required |
| **Testing Personnel** | Meet CLIA education/experience; documented competency | Stricter qualifications |

- Establish **competency assessment**: at hire, again at **6 months**, then **annually**,
  covering the **6 CLIA elements** (direct observation, monitoring recording/reporting,
  review of QC/records, instrument maintenance, problem solving, unknown samples).

---

## 4. Facility build-out (the exam room → lab)

Convert the large exam room with sink:
- Dedicated **bench** for the cobas with adequate power + **UPS**.
- **Hand-wash sink** (you have it) separate from any reagent water.
- **Refrigeration** for reagents and specimens (with monitored temp logs).
- **Biohazard + sharps** disposal and a contracted **medical-waste** pickup.
- **Eyewash**, PPE storage, bloodborne-pathogen signage.
- Adequate **counter space** for accessioning/sorting daily courier deliveries.
- Confirm **lease/zoning** allows lab use and any tenant improvements.

---

## 5. Instrument & methods (Roche cobas)

- **Throughput:** ~120 specimens/day is modest; most cobas e-series (e.g. cobas e 411 /
  cobas pro/pure e-modules) handle this easily. Confirm assay menu (**Total PSA**, and
  **free PSA** if you offer %fPSA), sample type (**serum**), and reagent cold-chain.
- Schedule Roche **IQ/OQ** installation and PM contract.
- **Method verification before reporting patients** (CLIA §493.1253, FDA-cleared assay):
  - **Precision** (within-run/between-day), **Accuracy** (vs comparative method / known
    samples), **Reportable range** (AMR), and **Reference interval verification**.
  - Document and have the **Director sign off** before going live.
- **Reference range:** set PSA interval (consider age-specific), define **abnormal**
  (e.g. >4 ng/mL) and any **critical** thresholds and reflex rules.
- **Connectivity:** decide on an **LIS/middleware** to interface the cobas + an **EHR
  result interface** back to ordering clinics, or a validated **manual entry** workflow.
  (This tracker is an **operations layer**, not a certified LIS/result-reporting system.)

---

## 6. Quality system

- **SOP manual / Quality Management plan:** collection & handling, courier transport &
  temperature, accessioning, **specimen rejection criteria**, testing, QC, result
  reporting, instrument maintenance, safety, document control, competency.
- **Proficiency Testing (PT):** enroll with an approved provider (**CAP**, **API**, etc.)
  for **PSA** (and IsoPSA if in-house). PT samples must be handled **like patient
  samples**; failures are reportable and tracked.
- **Daily QC:** define levels, frequency, target/SD, **Westgard rules**, and corrective
  action. (The QC tab auto-flags **1-2s warning / 1-3s fail** when you enter target+SD.)
- **Specimen stability / cold-chain validation** for each courier route into Snellville.

---

## 7. Specimen logistics (multi-site → Snellville daily)

- Define **collection windows** at each clinic and a **courier schedule** so PSA serum
  arrives within its **stability window**.
- **Packaging:** UN3373 category-B, temperature-controlled; log temperature on arrival.
- **Chain of custody / accessioning:** unique **accession #** per specimen
  (e.g. `SNV-YYYYMMDD-###`), reconcile courier manifest vs received count.
  (The **Couriers** + **Accessioning** tabs cover this.)
- Plan for **STAT** handling and **rejection/redraw** communication back to clinics.

---

## 8. Safety & data

- **OSHA** bloodborne-pathogen exposure-control plan, PPE, chemical hygiene, training.
- **Medical-waste** contract.
- **HIPAA:** any system holding **PHI** (LIS, EHR, and this tracker *if* you put PHI in
  it) must run on **HIPAA-compliant infrastructure** with access control, audit logging,
  encryption at rest/in transit, and a signed **BAA** with hosting vendors.
  → This tracker ships with a PHI warning banner; **keep patient refs de-identified**
  unless/until it is deployed on compliant infrastructure with auth added.

---

## 9. Billing & payor

- **Type 2 (organizational) NPI** for the lab if it bills separately.
- **Medicare enrollment** (**CMS-855B**); enroll commercial payors.
- **CPT/coding:** total PSA **84153**, free PSA **84154**; **IsoPSA** has its own
  coverage/PLA considerations — confirm payor coverage before offering it broadly.
- **Stark / anti-markup:** centralizing testing from multiple owned sites raises
  **in-office ancillary services exception** and **anti-markup** questions — review with
  a healthcare attorney *before* go-live.

---

## 10. Suggested sequence to "start ASAP"

1. **Decide IsoPSA = send-out** (unblocks the fastest PSA-only CLIA path).
2. Appoint **Lab Director** + consultants; confirm entity/ownership.
3. Submit **CMS-116**; pay fees; get CLIA number / registration cert.
4. In parallel: **build out the room**, order/install **cobas**, draft **SOPs**, enroll
   **PT**, set up **courier routes**, stand up this **tracker**.
5. **Verify PSA method**; Director signs off.
6. Begin **patient testing** under registration cert; **pass survey** → CoC.
7. Stand up **billing** (NPI, Medicare/commercial) and EHR result interface.
8. Phase 2 (optional): bring **IsoPSA in-house** (high-complexity upgrade).

Track all of the above live in the **CLIA Checklist** tab.
