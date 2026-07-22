'use strict';

// Builds the medical-necessity narrative — the part that actually gets PAs
// approved. Deterministic template first (auditable, no black box); optional
// Anthropic polish if an API key + BAA are configured.
//
// The prescriber reviews and edits every narrative before it is used. This is a
// drafting aid, not an attestation — the attestation is the prescriber's.

const config = require('./config');

// Map a step-therapy outcome to defensible payer language.
const OUTCOME = {
  failure: 'was tried without adequate clinical response',
  intolerance: 'was not tolerated due to adverse effects',
  contraindication: 'is contraindicated',
  allergy: 'is contraindicated due to documented allergy',
  inadequate: 'produced an inadequate response at the maximally tolerated dose',
};

function buildTemplate(c) {
  const p = c.patient || {};
  const m = c.medication || {};
  const cl = c.clinical || {};
  const age = p.dob ? ageFrom(p.dob) : null;

  const who = [
    age ? `${age}-year-old` : null,
    p.sex || null,
    'patient',
  ].filter(Boolean).join(' ');

  const lines = [];

  lines.push(
    `Prior authorization is requested for ${m.drug || '[medication]'}` +
      `${m.strength ? ' ' + m.strength : ''}` +
      `${m.sig ? ' (' + m.sig + ')' : ''} for a ${who} with ` +
      `${cl.diagnosis || m.indication || '[diagnosis]'}` +
      `${m.icd10 ? ` (ICD-10 ${m.icd10})` : ''}.`,
  );

  if (cl.severity || cl.duration || cl.symptoms) {
    lines.push(
      `Clinical course: ${[cl.severity && `${cl.severity} severity`, cl.duration && `duration ${cl.duration}`, cl.symptoms]
        .filter(Boolean)
        .join('; ')}.`,
    );
  }

  // Step therapy — the highest-yield section for approvals.
  const tried = Array.isArray(cl.stepTherapy) ? cl.stepTherapy : [];
  if (tried.length) {
    const parts = tried.map((t) => {
      const verb = OUTCOME[t.outcome] || `was tried (${t.outcome || 'outcome not specified'})`;
      return `${t.drug}${t.duration ? ` for ${t.duration}` : ''}, which ${verb}${t.note ? ` — ${t.note}` : ''}`;
    });
    lines.push(`Step therapy: the patient has previously received ${parts.join('; ')}.`);
  } else {
    lines.push(
      'Step therapy: [document prior therapies tried and their outcomes — failures, ' +
        'intolerances, or contraindications. This is typically the deciding factor.]',
    );
  }

  if (cl.contraindicationsToAlternatives) {
    lines.push(`Preferred/alternative agents are unsuitable because: ${cl.contraindicationsToAlternatives}.`);
  }

  if (cl.labs) lines.push(`Relevant objective findings: ${cl.labs}.`);

  lines.push(
    `${m.drug || 'The requested medication'} is medically necessary because ` +
      `${cl.rationale || 'the patient has exhausted or cannot use formulary alternatives and requires this agent to achieve disease control and avoid clinical deterioration'}.`,
  );

  if (cl.guideline) lines.push(`This request is consistent with ${cl.guideline}.`);

  lines.push(
    'The prescriber attests that this therapy is medically necessary for this ' +
      'patient and that the above information is accurate to the best of their knowledge.',
  );

  return lines.join('\n\n');
}

function ageFrom(dob) {
  const d = new Date(dob);
  if (isNaN(d)) return null;
  const now = new Date();
  let a = now.getFullYear() - d.getFullYear();
  const mo = now.getMonth() - d.getMonth();
  if (mo < 0 || (mo === 0 && now.getDate() < d.getDate())) a--;
  return a >= 0 && a < 130 ? a : null;
}

// Optional: ask Claude to tighten the prose while preserving every clinical fact.
// Requires ANTHROPIC_API_KEY (sign a BAA / enable zero-retention first).
async function polishWithClaude(draft) {
  if (!config.anthropic.enabled) return draft;
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': config.anthropic.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-5',
        max_tokens: 900,
        messages: [
          {
            role: 'user',
            content:
              'You are a clinical documentation assistant. Rewrite the following ' +
              'prior-authorization medical-necessity statement to be concise, formal, ' +
              'and persuasive to a payer reviewer. Do NOT invent, add, or remove any ' +
              'clinical fact, drug, dose, or outcome. Preserve any [bracketed] ' +
              'placeholders verbatim so the prescriber knows what to complete. Return ' +
              'only the rewritten statement.\n\n---\n' + draft,
          },
        ],
      }),
    });
    if (!res.ok) return draft;
    const data = await res.json();
    const text = data?.content?.[0]?.text?.trim();
    return text || draft;
  } catch {
    return draft; // never let polish failure block the workflow
  }
}

async function build(caseRecord, { polish = true } = {}) {
  const draft = buildTemplate(caseRecord);
  return polish ? await polishWithClaude(draft) : draft;
}

module.exports = { build, buildTemplate, OUTCOME };
