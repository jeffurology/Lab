'use strict';

const $ = (id) => document.getElementById(id);
let caseId = null;
let cfg = {};

async function api(method, path, body) {
  const res = await fetch(path, {
    method,
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

// ---- Safety posture banner ----
async function loadConfig() {
  cfg = await api('GET', '/api/config');
  $('consentText').textContent = cfg.consentText;
  const pill = (label, on) => `<span class="pill ${on ? 'on' : 'off'}">${label}: ${on ? 'on' : 'off'}</span>`;
  $('posture').innerHTML =
    pill('DRY_RUN', cfg.dryRun) +
    pill('AUTO_SUBMIT', cfg.autoSubmit) +
    pill('Twilio', cfg.twilioEnabled) +
    pill('Claude polish', cfg.anthropicEnabled) +
    `<span class="pill">PHI TTL: ${cfg.caseTtlMinutes}m</span>`;
}

// ---- Step therapy rows ----
function addStepRow(v = {}) {
  const wrap = document.createElement('div');
  wrap.className = 'stepRow';
  wrap.innerHTML = `
    <input placeholder="drug" value="${v.drug || ''}" data-k="drug" />
    <input placeholder="duration" value="${v.duration || ''}" data-k="duration" />
    <select data-k="outcome">
      ${['failure', 'intolerance', 'contraindication', 'allergy', 'inadequate']
        .map((o) => `<option ${v.outcome === o ? 'selected' : ''}>${o}</option>`).join('')}
    </select>
    <button type="button" class="mini" onclick="this.parentElement.remove()">×</button>`;
  $('stepTherapy').appendChild(wrap);
}
function collectSteps() {
  return [...document.querySelectorAll('#stepTherapy .stepRow')].map((row) => {
    const o = {};
    row.querySelectorAll('[data-k]').forEach((el) => (o[el.dataset.k] = el.value));
    return o;
  }).filter((s) => s.drug);
}

// ---- Build payload from the form ----
function intakePayload() {
  return {
    patient: {
      firstName: $('p_first').value, lastName: $('p_last').value, dob: $('p_dob').value,
      sex: $('p_sex').value, phone: $('p_phone').value, memberId: $('p_member').value,
    },
    medication: {
      drug: $('m_drug').value, strength: $('m_strength').value, sig: $('m_sig').value,
      indication: $('m_indication').value, icd10: $('m_icd10').value,
    },
    pharmacy: { name: $('ph_name').value, ncpdp: $('ph_ncpdp').value },
    clinical: {
      diagnosis: $('c_diagnosis').value, severity: $('c_severity').value, duration: $('c_duration').value,
      symptoms: $('c_symptoms').value, labs: $('c_labs').value, stepTherapy: collectSteps(),
      contraindicationsToAlternatives: $('c_contra').value, rationale: $('c_rationale').value,
      guideline: $('c_guideline').value,
    },
  };
}

// ---- Status rendering ----
function render(s) {
  if (!s) return;
  $('workspace').hidden = false;
  $('caseId').textContent = s.id;
  $('status').innerHTML = `<span class="st">${s.status}</span> · consent: ${s.hasConsent ? 'yes' : 'no'} · ${s.medication.drug || ''}`;
  $('missing').textContent = s.missing.length ? `Missing: ${s.missing.join(', ')}` : 'Nothing missing.';
  $('confirmBtn').hidden = s.status !== 'awaiting_confirm';
  $('cancelBtn').hidden = s.status !== 'awaiting_confirm';
  const steps = (s.portalSteps || []).map((p) => `${p.step}: ${p.status}${p.note ? ' — ' + p.note : ''}`);
  const events = (s.events || []).map((e) => new Date(e.t).toLocaleTimeString() + ' ' + e.type);
  $('log').innerHTML = [...events, '── portal ──', ...steps].map((l) => `<div>${l}</div>`).join('');
}

async function refresh() {
  if (!caseId) return;
  try { render(await api('GET', `/api/cases/${caseId}`)); } catch {}
}

// ---- Wire up ----
$('addStep').onclick = () => addStepRow();

$('createBtn').onclick = async () => {
  try {
    if (!$('consentBox').checked) return alert('Consent is required before creating a case.');
    const s = await api('POST', '/api/cases', intakePayload());
    caseId = s.id;
    await api('POST', `/api/cases/${caseId}/consent`, { method: $('consentMethod').value, grantedBy: 'patient' });
    render(await api('GET', `/api/cases/${caseId}`));
  } catch (e) { alert(e.message); }
};

$('textBtn').onclick = async () => {
  try {
    const r = await api('POST', `/api/cases/${caseId}/text-patient`);
    alert(r.asked?.length ? `Texted patient for: ${r.asked.join(', ')}` : (r.note || 'Nothing to ask.'));
    refresh();
  } catch (e) { alert(e.message); }
};

$('draftBtn').onclick = async () => {
  try {
    $('draftBtn').textContent = 'Drafting…';
    const r = await api('POST', `/api/cases/${caseId}/draft`, { polish: cfg.anthropicEnabled });
    $('justification').value = r.justification;
    refresh();
  } catch (e) { alert(e.message); }
  finally { $('draftBtn').textContent = 'Draft medical-necessity justification'; }
};

$('saveJustBtn').onclick = async () => {
  try {
    await api('PUT', `/api/cases/${caseId}/justification`, { justification: $('justification').value });
    alert('Saved.');
  } catch (e) { alert(e.message); }
};

$('submitBtn').onclick = async () => {
  if (!$('justification').value.trim()) return alert('Draft & review the justification first.');
  await api('PUT', `/api/cases/${caseId}/justification`, { justification: $('justification').value }).catch(() => {});
  $('submitBtn').textContent = 'Filling portal…';
  try {
    render(await api('POST', `/api/cases/${caseId}/submit`));
  } catch (e) { alert(e.message); refresh(); }
  finally { $('submitBtn').textContent = 'Fill CoverMyMeds (stops before Submit)'; }
};

$('confirmBtn').onclick = async () => {
  if (!confirm('Submit this prior authorization to CoverMyMeds now? You are attesting to medical necessity.')) return;
  try { render(await api('POST', `/api/cases/${caseId}/confirm`)); } catch (e) { alert(e.message); refresh(); }
};

$('cancelBtn').onclick = async () => {
  try { render(await api('POST', `/api/cases/${caseId}/cancel`)); } catch (e) { alert(e.message); }
};

$('purgeBtn').onclick = async () => {
  if (!confirm('Purge all PHI for this case now?')) return;
  try { await api('DELETE', `/api/cases/${caseId}`); caseId = null; $('workspace').hidden = true; }
  catch (e) { alert(e.message); }
};

setInterval(refresh, 4000);
addStepRow();
loadConfig();
