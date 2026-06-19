'use strict';

/* ---------- helpers ---------- */
const $ = (sel, el = document) => el.querySelector(sel);
const main = $('#main');
const today = () => new Date().toISOString().slice(0, 10);

async function api(path, method = 'GET', body) {
  const opts = { method, headers: {} };
  if (body !== undefined) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
  const res = await fetch('/api' + path, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

function toast(msg, isError = false) {
  const t = $('#toast');
  t.textContent = msg;
  t.className = 'toast show' + (isError ? ' error' : '');
  setTimeout(() => (t.className = 'toast'), 2600);
}

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const badge = (s) => `<span class="badge ${esc(s)}">${esc(String(s).replace(/_/g, ' '))}</span>`;
const fmtDT = (s) => s ? new Date(s.replace(' ', 'T') + (s.includes('Z') ? '' : 'Z')).toLocaleString() : '—';

let LOCATIONS = [];
async function loadLocations() { LOCATIONS = await api('/locations'); return LOCATIONS; }
const locOptions = (sel) => LOCATIONS.map((l) => `<option value="${l.id}" ${sel == l.id ? 'selected' : ''}>${esc(l.code)} — ${esc(l.name)}</option>`).join('');
const workingDate = () => $('#globalDate').value || today();

/* ---------- router ---------- */
const views = {};
let currentView = 'dashboard';

function setView(name) {
  currentView = name;
  document.querySelectorAll('#tabs button').forEach((b) => b.classList.toggle('active', b.dataset.view === name));
  render();
}
async function render() {
  main.innerHTML = '<p class="empty">Loading…</p>';
  try { await views[currentView](); }
  catch (e) { main.innerHTML = `<div class="panel"><strong>Error:</strong> ${esc(e.message)}</div>`; }
}

/* ---------- Dashboard ---------- */
views.dashboard = async function () {
  const d = await api('/analytics/dashboard?date=' + workingDate());
  const util = (k) => {
    const pct = d.utilization[k] || 0;
    return `<div class="bar"><span class="${pct >= 100 ? 'over' : ''}" style="width:${Math.min(pct, 100)}%"></span></div>`;
  };
  const maxTrend = Math.max(1, ...d.trend.map((t) => t.n));
  const spark = d.trend.map((t) => `<div title="${t.d}: ${t.n}" style="height:${(t.n / maxTrend) * 100}%"></div>`).join('');

  main.innerHTML = `
    <h2>Daily Operations — ${esc(d.date)}</h2>
    <p class="subtitle">Targets: ${d.targets.PSA} PSA + ${d.targets.IsoPSA} IsoPSA per day</p>

    <div class="grid cards">
      <div class="card">
        <div class="label">PSA today</div>
        <div class="kpi">${d.volume.PSA || 0}<span class="muted" style="font-size:16px"> / ${d.targets.PSA}</span></div>
        ${util('PSA')}<div class="sub">${d.utilization.PSA || 0}% of target</div>
      </div>
      <div class="card">
        <div class="label">IsoPSA today</div>
        <div class="kpi">${d.volume.IsoPSA || 0}<span class="muted" style="font-size:16px"> / ${d.targets.IsoPSA}</span></div>
        ${util('IsoPSA')}<div class="sub">${d.utilization.IsoPSA || 0}% of target</div>
      </div>
      <div class="card">
        <div class="label">Pending (all dates)</div>
        <div class="kpi">${d.pending}</div>
        <div class="sub">not yet resulted</div>
      </div>
      <div class="card">
        <div class="label">Avg turnaround (7d)</div>
        <div class="kpi">${d.turnaround.avg_minutes != null ? d.turnaround.avg_minutes + 'm' : '—'}</div>
        <div class="sub">${d.turnaround.count} resulted</div>
      </div>
    </div>

    <div class="grid" style="grid-template-columns: 1fr 1fr; margin-top:16px">
      <div class="panel">
        <h3>14-day received volume</h3>
        <div class="sparkline">${spark || '<span class="muted">no data</span>'}</div>
      </div>
      <div class="panel">
        <h3>Today by status</h3>
        ${Object.keys(d.statusBreakdown).length
          ? Object.entries(d.statusBreakdown).map(([k, v]) => `<div style="display:flex;justify-content:space-between;padding:4px 0">${badge(k)}<strong>${v}</strong></div>`).join('')
          : '<p class="empty">No specimens received.</p>'}
      </div>
    </div>

    <div class="panel">
      <h3>Volume by location (today)</h3>
      <table><thead><tr><th>Location</th><th>Received</th></tr></thead><tbody>
        ${d.byLocation.map((l) => `<tr><td>${esc(l.code)} — ${esc(l.name)}</td><td>${l.n}</td></tr>`).join('') || '<tr><td colspan=2 class="empty">No active locations.</td></tr>'}
      </tbody></table>
    </div>

    ${d.qcIssues.length ? `<div class="panel"><h3>⚠️ Recent QC warnings/failures</h3>
      <table><thead><tr><th>Date</th><th>Test</th><th>Level</th><th>Observed</th><th>Result</th></tr></thead><tbody>
      ${d.qcIssues.map((q) => `<tr><td>${esc(q.qc_date)}</td><td>${esc(q.test_type)}</td><td>${esc(q.level)}</td><td>${q.observed ?? '—'}</td><td>${badge(q.result)}</td></tr>`).join('')}
      </tbody></table></div>` : ''}
  `;
};

/* ---------- Accessioning (specimens) ---------- */
views.accession = async function () {
  await loadLocations();
  const specimens = await api('/specimens?date=' + workingDate());
  const suggestion = 'SNV-' + workingDate().replace(/-/g, '') + '-';

  main.innerHTML = `
    <h2>Accessioning & Specimens</h2>
    <p class="subtitle">Log specimens received at Snellville and track them through resulting.</p>

    <div class="panel">
      <h3>Receive specimen</h3>
      <form class="row" id="specForm">
        <div class="field"><label>Accession #</label><input name="accession" placeholder="${suggestion}001" required></div>
        <div class="field"><label>Origin location</label><select name="location_id" required>${locOptions()}</select></div>
        <div class="field"><label>Test</label><select name="test_type"><option>PSA</option><option>IsoPSA</option><option>PSA+IsoPSA</option></select></div>
        <div class="field"><label>Priority</label><select name="priority"><option value="routine">routine</option><option value="stat">stat</option></select></div>
        <div class="field"><label>Patient ref (de-identified)</label><input name="patient_ref" placeholder="optional"></div>
        <div class="field"><label>Collected at</label><input type="datetime-local" name="collected_at"></div>
        <button class="btn" type="submit">Receive</button>
      </form>
    </div>

    <div class="panel">
      <div class="toolbar">
        <h3 style="margin:0">Specimens — ${esc(workingDate())}</h3>
        <div class="spacer"></div>
        <select id="statusFilter">
          <option value="">All statuses</option>
          ${['received', 'in_run', 'resulted', 'in_transit', 'rejected'].map((s) => `<option>${s}</option>`).join('')}
        </select>
      </div>
      <table id="specTable"><thead><tr>
        <th>Accession</th><th>Origin</th><th>Test</th><th>Status</th><th>Result</th><th>Received</th><th></th>
      </tr></thead><tbody></tbody></table>
    </div>
  `;

  const renderRows = (rows) => {
    $('#specTable tbody').innerHTML = rows.length ? rows.map((s) => {
      const r = (s.results || []).map((x) => `<span class="flag-${x.flag}">${x.test_type} ${x.value}${x.unit || ''}</span>`).join(', ');
      const actions = s.status === 'resulted' ? '' :
        `<button class="btn small secondary" data-result="${s.id}" data-test="${esc(s.test_type)}">+ result</button>`;
      return `<tr>
        <td>${esc(s.accession)}${s.priority === 'stat' ? ' <span class="badge fail">STAT</span>' : ''}</td>
        <td>${esc(s.location_code)}</td><td>${esc(s.test_type)}</td>
        <td>${badge(s.status)}</td><td>${r || '—'}</td><td>${fmtDT(s.received_at || s.created_at)}</td>
        <td>${actions}</td></tr>`;
    }).join('') : '<tr><td colspan=7 class="empty">No specimens for this date.</td></tr>';
  };
  renderRows(specimens);

  $('#statusFilter').onchange = async (e) => {
    const q = '/specimens?date=' + workingDate() + (e.target.value ? '&status=' + e.target.value : '');
    renderRows(await api(q));
  };

  $('#specForm').onsubmit = async (e) => {
    e.preventDefault();
    const f = e.target;
    const body = {
      accession: f.accession.value.trim(),
      location_id: +f.location_id.value,
      test_type: f.test_type.value,
      priority: f.priority.value,
      patient_ref: f.patient_ref.value || null,
      collected_at: f.collected_at.value || null,
      received_at: new Date().toISOString(),
      status: 'received',
    };
    try { await api('/specimens', 'POST', body); toast('Specimen received'); render(); }
    catch (err) { toast(err.message, true); }
  };

  $('#specTable').onclick = async (e) => {
    const btn = e.target.closest('[data-result]');
    if (!btn) return;
    const test = btn.dataset.test === 'PSA+IsoPSA' ? 'PSA' : btn.dataset.test;
    const value = prompt(`Result value for ${test} (ng/mL):`);
    if (value === null || value === '') return;
    const num = parseFloat(value);
    const flag = test === 'PSA' ? (num > 4 ? 'high' : 'normal') : 'normal';
    try { await api(`/specimens/${btn.dataset.result}/results`, 'POST', { test_type: test, value: num, unit: 'ng/mL', flag }); toast('Result added'); render(); }
    catch (err) { toast(err.message, true); }
  };
};

/* ---------- Runs / Batches ---------- */
views.runs = async function () {
  const batches = await api('/batches');
  const unassigned = await api('/specimens?status=received');

  main.innerHTML = `
    <h2>cobas Runs</h2>
    <p class="subtitle">Group received specimens into instrument runs and record QC + completion.</p>
    <div class="panel">
      <h3>New run</h3>
      <form class="row" id="batchForm">
        <div class="field"><label>Run date</label><input type="date" name="run_date" value="${workingDate()}"></div>
        <div class="field"><label>Test</label><select name="test_type"><option>PSA</option><option>IsoPSA</option></select></div>
        <div class="field"><label>Operator</label><input name="operator" placeholder="initials"></div>
        <button class="btn" type="submit">Create run</button>
      </form>
      <p class="muted" style="margin-top:8px">${unassigned.length} received specimen(s) awaiting a run.</p>
    </div>
    <div class="panel">
      <h3>Runs</h3>
      <table><thead><tr><th>ID</th><th>Date</th><th>Test</th><th>Specimens</th><th>QC</th><th>Status</th><th></th></tr></thead>
      <tbody>${batches.map((b) => `<tr>
        <td>#${b.id}</td><td>${esc(b.run_date)}</td><td>${esc(b.test_type)}</td>
        <td>${b.specimen_count}</td><td>${badge(b.qc_status || 'pending')}</td><td>${badge(b.status)}</td>
        <td>
          <button class="btn small secondary" data-assign="${b.id}" data-test="${esc(b.test_type)}">assign</button>
          <button class="btn small secondary" data-qc="${b.id}" data-pass="pass">QC✓</button>
          <button class="btn small secondary" data-complete="${b.id}">complete</button>
        </td></tr>`).join('') || '<tr><td colspan=7 class="empty">No runs yet.</td></tr>'}
      </tbody></table>
    </div>`;

  $('#batchForm').onsubmit = async (e) => {
    e.preventDefault();
    const f = e.target;
    try { await api('/batches', 'POST', { run_date: f.run_date.value, test_type: f.test_type.value, operator: f.operator.value }); toast('Run created'); render(); }
    catch (err) { toast(err.message, true); }
  };

  main.onclick = async (e) => {
    const a = e.target.closest('[data-assign]'); const q = e.target.closest('[data-qc]'); const c = e.target.closest('[data-complete]');
    try {
      if (a) {
        const test = a.dataset.test;
        const pool = await api('/specimens?status=received');
        const elig = pool.filter((s) => s.test_type === test || s.test_type === 'PSA+IsoPSA');
        if (!elig.length) return toast('No eligible received specimens', true);
        const ids = elig.map((s) => s.id);
        if (!confirm(`Assign ${ids.length} received ${test} specimen(s) to run #${a.dataset.assign}?`)) return;
        await api(`/batches/${a.dataset.assign}/assign`, 'POST', { specimen_ids: ids });
        toast('Assigned'); render();
      } else if (q) {
        await api(`/batches/${q.dataset.qc}`, 'PATCH', { qc_status: 'pass', status: 'running', started_at: new Date().toISOString() });
        toast('QC passed'); render();
      } else if (c) {
        await api(`/batches/${c.dataset.complete}`, 'PATCH', { status: 'complete', completed_at: new Date().toISOString() });
        toast('Run complete'); render();
      }
    } catch (err) { toast(err.message, true); }
  };
};

/* ---------- QC ---------- */
views.qc = async function () {
  const log = await api('/qc');
  main.innerHTML = `
    <h2>Quality Control</h2>
    <p class="subtitle">Daily QC is auto-evaluated: 1-2s ⇒ warning, 1-3s ⇒ fail (when target &amp; SD entered).</p>
    <div class="panel">
      <h3>Log QC</h3>
      <form class="row" id="qcForm">
        <div class="field"><label>Date</label><input type="date" name="qc_date" value="${workingDate()}"></div>
        <div class="field"><label>Test</label><select name="test_type"><option>PSA</option><option>IsoPSA</option></select></div>
        <div class="field"><label>Level</label><select name="level"><option>1</option><option>2</option><option>3</option></select></div>
        <div class="field"><label>Lot</label><input name="lot"></div>
        <div class="field"><label>Target (mean)</label><input type="number" step="any" name="target"></div>
        <div class="field"><label>SD</label><input type="number" step="any" name="sd"></div>
        <div class="field"><label>Observed</label><input type="number" step="any" name="observed"></div>
        <div class="field"><label>Operator</label><input name="operator"></div>
        <button class="btn" type="submit">Record</button>
      </form>
    </div>
    <div class="panel">
      <h3>QC history</h3>
      <table><thead><tr><th>Date</th><th>Test</th><th>Lvl</th><th>Lot</th><th>Target</th><th>SD</th><th>Observed</th><th>Z</th><th>Result</th></tr></thead>
      <tbody>${log.map((q) => {
        const z = (q.target != null && q.sd) ? Math.abs((q.observed - q.target) / q.sd).toFixed(2) : '—';
        return `<tr><td>${esc(q.qc_date)}</td><td>${esc(q.test_type)}</td><td>${esc(q.level)}</td><td>${esc(q.lot || '—')}</td>
          <td>${q.target ?? '—'}</td><td>${q.sd ?? '—'}</td><td>${q.observed ?? '—'}</td><td>${z}</td><td>${badge(q.result)}</td></tr>`;
      }).join('') || '<tr><td colspan=9 class="empty">No QC logged.</td></tr>'}</tbody></table>
    </div>`;

  $('#qcForm').onsubmit = async (e) => {
    e.preventDefault();
    const f = e.target;
    const body = {
      qc_date: f.qc_date.value, test_type: f.test_type.value, level: f.level.value,
      lot: f.lot.value || null,
      target: f.target.value ? +f.target.value : null,
      sd: f.sd.value ? +f.sd.value : null,
      observed: f.observed.value ? +f.observed.value : null,
      operator: f.operator.value || null,
    };
    try { const r = await api('/qc', 'POST', body); toast('QC ' + r.result); render(); }
    catch (err) { toast(err.message, true); }
  };
};

/* ---------- Couriers ---------- */
views.couriers = async function () {
  await loadLocations();
  const logs = await api('/couriers?date=' + workingDate());
  main.innerHTML = `
    <h2>Courier / Specimen Transport</h2>
    <p class="subtitle">Log daily pickups from each clinic into Snellville with temperature/chain-of-custody.</p>
    <div class="panel">
      <h3>Log pickup</h3>
      <form class="row" id="courForm">
        <div class="field"><label>Location</label><select name="location_id">${locOptions()}</select></div>
        <div class="field"><label>Pickup date</label><input type="date" name="pickup_date" value="${workingDate()}"></div>
        <div class="field"><label>Pickup time</label><input type="time" name="pickup_time"></div>
        <div class="field"><label># specimens</label><input type="number" name="specimen_count" value="0"></div>
        <div class="field"><label>Courier</label><input name="courier_name"></div>
        <div class="field"><label>Temp °C</label><input type="number" step="any" name="temp_c"></div>
        <div class="field"><label>Temp OK?</label><select name="temp_ok"><option value="1">yes</option><option value="0">no</option></select></div>
        <button class="btn" type="submit">Log</button>
      </form>
    </div>
    <div class="panel">
      <h3>Pickups — ${esc(workingDate())}</h3>
      <table><thead><tr><th>Location</th><th>Date</th><th>Time</th><th>#</th><th>Courier</th><th>Temp</th></tr></thead>
      <tbody>${logs.map((c) => `<tr><td>${esc(c.location_code)}</td><td>${esc(c.pickup_date)}</td><td>${esc(c.pickup_time || '—')}</td>
        <td>${c.specimen_count}</td><td>${esc(c.courier_name || '—')}</td>
        <td>${c.temp_c ?? '—'} ${c.temp_ok ? '✅' : '⚠️'}</td></tr>`).join('') || '<tr><td colspan=6 class="empty">No pickups logged.</td></tr>'}</tbody></table>
    </div>`;

  $('#courForm').onsubmit = async (e) => {
    e.preventDefault();
    const f = e.target;
    const body = {
      location_id: +f.location_id.value, pickup_date: f.pickup_date.value,
      pickup_time: f.pickup_time.value || null, specimen_count: +f.specimen_count.value,
      courier_name: f.courier_name.value || null, temp_c: f.temp_c.value ? +f.temp_c.value : null,
      temp_ok: +f.temp_ok.value, received_at: new Date().toISOString(),
    };
    try { await api('/couriers', 'POST', body); toast('Pickup logged'); render(); }
    catch (err) { toast(err.message, true); }
  };
};

/* ---------- Locations ---------- */
views.locations = async function () {
  await loadLocations();
  main.innerHTML = `
    <h2>Locations</h2>
    <p class="subtitle">Clinics that send specimens to the Snellville lab.</p>
    <div class="panel">
      <h3>Add location</h3>
      <form class="row" id="locForm">
        <div class="field"><label>Code</label><input name="code" placeholder="e.g. LAW" required></div>
        <div class="field"><label>Name</label><input name="name" required></div>
        <div class="field"><label>Address</label><input name="address"></div>
        <div class="field"><label>Contact</label><input name="contact"></div>
        <button class="btn" type="submit">Add</button>
      </form>
    </div>
    <div class="panel">
      <table><thead><tr><th>Code</th><th>Name</th><th>Address</th><th>Active</th></tr></thead>
      <tbody>${LOCATIONS.map((l) => `<tr><td><strong>${esc(l.code)}</strong></td><td>${esc(l.name)}</td>
        <td>${esc(l.address || '—')}</td><td>${l.active ? '✅' : '—'}</td></tr>`).join('')}</tbody></table>
    </div>`;

  $('#locForm').onsubmit = async (e) => {
    e.preventDefault();
    const f = e.target;
    try { await api('/locations', 'POST', { code: f.code.value, name: f.name.value, address: f.address.value, contact: f.contact.value }); toast('Location added'); render(); }
    catch (err) { toast(err.message, true); }
  };
};

/* ---------- Compliance / CLIA checklist ---------- */
views.compliance = async function () {
  const data = await api('/compliance');
  const statuses = ['not_started', 'in_progress', 'blocked', 'done', 'na'];
  const done = data.summary.done || 0;
  const pct = data.total ? Math.round((done / data.total) * 100) : 0;

  main.innerHTML = `
    <h2>CLIA &amp; Launch Checklist</h2>
    <p class="subtitle">${done} / ${data.total} complete (${pct}%). Edit status as you progress. See PLANNING.md for the full narrative.</p>
    <div class="bar" style="max-width:400px"><span style="width:${pct}%"></span></div>
    <div id="catWrap">${Object.entries(data.categories).map(([cat, tasks]) => `
      <div class="cat-block"><h4>${esc(cat)}</h4>
        ${tasks.map((t) => `<div class="task">
          <div class="body">
            <div class="title">${esc(t.title)}</div>
            <div class="desc">${esc(t.description || '')}</div>
            ${t.notes ? `<div class="desc"><em>Note: ${esc(t.notes)}</em></div>` : ''}
          </div>
          <div>
            <select data-task="${t.id}">${statuses.map((s) => `<option value="${s}" ${t.status === s ? 'selected' : ''}>${s.replace(/_/g, ' ')}</option>`).join('')}</select>
          </div>
        </div>`).join('')}
      </div>`).join('')}
    </div>`;

  $('#catWrap').onchange = async (e) => {
    const sel = e.target.closest('[data-task]');
    if (!sel) return;
    try { await api('/compliance/' + sel.dataset.task, 'PATCH', { status: sel.value }); toast('Updated'); }
    catch (err) { toast(err.message, true); }
  };
};

/* ---------- boot ---------- */
document.querySelectorAll('#tabs button').forEach((b) => (b.onclick = () => setView(b.dataset.view)));
$('#globalDate').value = today();
$('#globalDate').onchange = render;
$('#dismissPhi').onclick = (e) => { e.preventDefault(); $('#phi-banner').classList.add('hidden'); };

api('/health').then((h) => { const p = $('#health'); p.textContent = 'online'; p.className = 'pill ok'; })
  .catch(() => { const p = $('#health'); p.textContent = 'offline'; p.className = 'pill bad'; });

setView('dashboard');
