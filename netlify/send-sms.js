// ============================================================
// ClientSteady — Netlify Function: send-sms
// Receives booking data from demo site, sends real SMS via Twilio
// Environment variables required in Netlify:
//   TWILIO_ACCOUNT_SID
//   TWILIO_AUTH_TOKEN
//   TWILIO_PHONE_NUMBER
// ============================================================

exports.handler = async function(event, context) {

  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  // CORS headers — allows your demo site to call this function
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  let body;
  try {
    body = JSON.parse(event.body);
  } catch(e) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const { to, type, firstName, service, date, time, slot1, slot2, slot3 } = body;

  // Validate phone number
  if (!to || !to.match(/^\+?[1-9]\d{9,14}$/)) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid phone number' }) };
  }

  // Format phone — ensure E.164 format
  const phone = to.startsWith('+') ? to : '+1' + to.replace(/\D/g,'');

  // Build message based on automation type
  const messages = {
    confirmation: `Hi ${firstName}! Thanks for booking with us. You're all set for your ${service} on ${date} at ${time}. Reply C to confirm your spot. See you then! ✨`,

    reminder: `Hi ${firstName}! Just a reminder — your ${service} is tomorrow at ${time}. Reply YES to confirm or CANCEL to reschedule. We'll hold your spot! 📅`,

    cancellation_rebook: `Hi ${firstName}! We saw your cancellation. Life happens — no worries! We have these openings:\n\n1. ${slot1 || 'Mon at 10am'}\n2. ${slot2 || 'Tue at 2pm'}\n3. ${slot3 || 'Wed at 11am'}\n\nReply 1, 2, or 3 to grab a spot! 📅`,

    no_show: `Hi ${firstName}! We missed you today. We'd love to get you rescheduled whenever you're ready — just reply here and we'll find a time that works. ❤️`,

    review: `${firstName}, thank you for visiting! If you loved your experience, a quick Google review means the world to us. See you next time! ⭐`,

    winback: `Hi ${firstName}! It's been a little while and we miss you! Is there anything we can help you with? We'd love to welcome you back. 🌸`,
  };

  const messageBody = messages[type] || messages.confirmation;

  // Send via Twilio REST API
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken  = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_PHONE_NUMBER;

  if (!accountSid || !authToken || !fromNumber) {
    return {
      statusCode: 500, headers,
      body: JSON.stringify({ error: 'Twilio credentials not configured in Netlify environment variables' })
    };
  }

  const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const credentials = Buffer.from(`${accountSid}:${authToken}`).toString('base64');

  const params = new URLSearchParams();
  params.append('To', phone);
  params.append('From', fromNumber);
  params.append('Body', messageBody);

  try {
    const response = await fetch(twilioUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString()
    });

    const result = await response.json();

    if (response.ok) {
      console.log(`[ClientSteady] SMS sent to ${phone} — SID: ${result.sid}`);
      return {
        statusCode: 200, headers,
        body: JSON.stringify({ success: true, sid: result.sid, type, to: phone })
      };
    } else {
      console.error('[ClientSteady] Twilio error:', result);
      return {
        statusCode: 400, headers,
        body: JSON.stringify({ error: result.message || 'Twilio send failed', code: result.code })
      };
    }
  } catch(err) {
    console.error('[ClientSteady] Fetch error:', err);
    return {
      statusCode: 500, headers,
      body: JSON.stringify({ error: err.message })
    };
  }
};
