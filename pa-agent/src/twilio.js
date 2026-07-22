'use strict';

// Text a patient for the info we're missing (pharmacy, DOB, member ID).
// Requires a signed Twilio BAA before any PHI is sent over SMS.
//
// Outbound: sendMissingInfoRequest() asks only for what's missing, minimally.
// Inbound: parseInboundReply() maps a free-text reply back onto case fields.

const config = require('./config');
const { log } = require('./phi');

let client = null;
function getClient() {
  if (!config.twilio.enabled) return null;
  if (!client) client = require('twilio')(config.twilio.accountSid, config.twilio.authToken);
  return client;
}

function missingInfoPrompt(missing) {
  // Keep it minimal and non-identifying in the outbound body.
  const asks = [];
  if (missing.includes('pharmacy')) asks.push('your pharmacy name & location');
  if (missing.includes('DOB')) asks.push('your date of birth (MM/DD/YYYY)');
  if (missing.includes('insurance member ID')) asks.push('your insurance member ID');
  const list = asks.length ? asks.join(', and ') : 'a bit more information';
  return (
    `Hi — this is your doctor's office working on the prior authorization for your ` +
    `medication. To finish, please reply with ${list}. Reply STOP to opt out.`
  );
}

async function sendMissingInfoRequest(caseRecord, missing) {
  const c = getClient();
  const to = caseRecord?.patient?.phone;
  if (!c) throw httpErr(503, 'Twilio is not configured.');
  if (!to) throw httpErr(400, 'No patient phone number on file.');

  const body = missingInfoPrompt(missing);
  const opts = { from: config.twilio.from, to, body };
  if (config.twilio.publicBaseUrl) {
    opts.statusCallback = `${config.twilio.publicBaseUrl}/webhooks/twilio/status`;
  }
  const msg = await c.messages.create(opts);
  log('sms sent', { sid: msg.sid, asked: missing });
  return { sid: msg.sid };
}

// Best-effort extraction from a patient's free-text reply.
function parseInboundReply(text) {
  const out = {};
  const dob = text.match(/\b(0?[1-9]|1[0-2])[\/-](0?[1-9]|[12]\d|3[01])[\/-](19|20)\d\d\b/);
  if (dob) out.dob = dob[0];
  // Member IDs are messy; capture an alphanumeric token 6+ chars if labeled.
  const member = text.match(/(?:member|id|policy)\s*[:#]?\s*([A-Z0-9-]{6,})/i);
  if (member) out.memberId = member[1];
  // Pharmacy: anything after "pharmacy" keyword, else leave for staff review.
  const pharm = text.match(/pharmacy[:\s]+(.+)/i);
  if (pharm) out.pharmacy = pharm[1].trim();
  return out;
}

function isStop(text) {
  return /\b(stop|stopall|unsubscribe|cancel|end|quit)\b/i.test(text.trim());
}

function httpErr(status, msg) {
  const e = new Error(msg);
  e.status = status;
  return e;
}

module.exports = { sendMissingInfoRequest, parseInboundReply, isStop, missingInfoPrompt };
