// ============================================================
// ClientSteady — Netlify Function: send-sms
// ============================================================

// Simple in-memory rate limiter (resets on cold start)
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = 5; // max 5 requests per IP per minute
const ALLOWED_ORIGIN = 'https://clientsteady.com';
const ALLOWED_TYPES = ['confirmation','reminder','cancellation_rebook','no_show','review','winback'];
const MAX_PAYLOAD = 2000; // bytes

function checkRateLimit(ip) {
  const now = Date.now();
  const entry = rateLimitMap.get(ip) || { count: 0, start: now };
  if (now - entry.start > RATE_LIMIT_WINDOW) {
    rateLimitMap.set(ip, { count: 1, start: now });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX) return false;
  entry.count++;
  rateLimitMap.set(ip, entry);
  return true;
}

function sanitize(str, maxLen = 100) {
  if (typeof str !== 'string') return '';
  return str.replace(/[<>"']/g, '').trim().slice(0, maxLen);
}

exports.handler = async function(event, context) {
  const origin = event.headers['origin'] || '';
  const ip = event.headers['x-forwarded-for']?.split(',')[0] || 'unknown';

  const corsHeaders = {
    'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Handle preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }

  // Enforce origin
  if (origin && origin !== ALLOWED_ORIGIN) {
    return { statusCode: 403, headers: corsHeaders, body: JSON.stringify({ error: 'Origin not allowed' }) };
  }

  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: corsHeaders, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  // Rate limit
  if (!checkRateLimit(ip)) {
    return { statusCode: 429, headers: corsHeaders, body: JSON.stringify({ error: 'Too many requests. Please wait a moment.' }) };
  }

  // Payload size check
  if ((event.body || '').length > MAX_PAYLOAD) {
    return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'Payload too large' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch(e) {
    return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const { to, type, firstName, service, date, time, slot1, slot2, slot3 } = body;

  // Validate phone
  const phone = String(to || '').replace(/\D/g, '');
  if (phone.length < 10 || phone.length > 11) {
    return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'Invalid phone number' }) };
  }
  const e164 = phone.length === 11 ? '+' + phone : '+1' + phone;

  // Validate message type
  if (!ALLOWED_TYPES.includes(type)) {
    return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'Invalid message type' }) };
  }

  // Sanitize inputs
  const name = sanitize(firstName || 'there', 50);
  const svc  = sanitize(service || 'your appointment', 80);
  const dt   = sanitize(date || 'your scheduled date', 50);
  const tm   = sanitize(time || 'your scheduled time', 30);

  const messages = {
    confirmation: `Hi ${name}! Thanks for booking. You're all set for your ${svc} on ${dt} at ${tm}. Reply C to confirm ✨`,
    reminder: `Hi ${name}! Reminder — your ${svc} is tomorrow at ${tm}. Reply YES to confirm or CANCEL to reschedule 📅`,
    cancellation_rebook: `Hi ${name}! We saw your cancellation. We have these openings:\n\n1. ${sanitize(slot1||'Mon at 10am',30)}\n2. ${sanitize(slot2||'Tue at 2pm',30)}\n3. ${sanitize(slot3||'Wed at 11am',30)}\n\nReply 1, 2, or 3 to grab a spot! 📅`,
    no_show: `Hi ${name}! We missed you today. We'd love to get you rescheduled — just reply here and we'll find a time. ❤️`,
    review: `${name}, thank you for visiting! If you loved your experience, a quick Google review means the world to us. See you next time! ⭐`,
    winback: `Hi ${name}! It's been a little while and we miss you! Is there anything we can help you with? We'd love to welcome you back. 🌸`,
  };

  const messageBody = messages[type];
  const accountSid  = process.env.TWILIO_ACCOUNT_SID;
  const authToken   = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber  = process.env.TWILIO_PHONE_NUMBER;

  if (!accountSid || !authToken || !fromNumber) {
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: 'SMS service not configured' }) };
  }

  const twilioUrl  = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const credentials = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
  const params = new URLSearchParams();
  params.append('To', e164);
  params.append('From', fromNumber);
  params.append('Body', messageBody);

  try {
    const response = await fetch(twilioUrl, {
      method: 'POST',
      headers: { 'Authorization': `Basic ${credentials}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString()
    });
    const result = await response.json();
    if (response.ok) {
      console.log(`[ClientSteady] SMS sent to ${e164} type:${type} sid:${result.sid}`);
      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ success: true, sid: result.sid }) };
    } else {
      console.error(`[ClientSteady] Twilio error:`, result.message, result.code);
      return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: result.message, code: result.code }) };
    }
  } catch(err) {
    console.error('[ClientSteady] Fetch error:', err.message);
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: 'SMS send failed' }) };
  }
};
