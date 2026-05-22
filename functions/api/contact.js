function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store'
    }
  });
}

function requireEnv(env, key) {
  const val = env && env[key];
  if (!val) throw new Error(`Missing ${key}`);
  return val;
}

function clean(s) {
  return String(s || '').trim();
}

export async function onRequestPost({ request, env }) {
  try {
    const ct = request.headers.get('content-type') || '';
    let data = {};

    if (ct.includes('application/json')) {
      data = await request.json().catch(() => ({}));
    } else {
      const fd = await request.formData();
      data = Object.fromEntries(fd.entries());
    }

    // Honeypot field: bots fill it, humans don't.
    if (clean(data.company)) return jsonResponse({ ok: true });

    const name = clean(data.name);
    const email = clean(data.email);
    const phone = clean(data.phone);
    const topic = clean(data.topic);
    const message = clean(data.message);
    const page = clean(data.page);

    if (!name || !email || !message) {
      return jsonResponse({ ok: false, error: 'Please include name, email, and a message.' }, 400);
    }
    if (name.length > 80 || email.length > 120 || phone.length > 40 || topic.length > 80 || message.length > 2000) {
      return jsonResponse({ ok: false, error: 'Message is too long.' }, 400);
    }

    const sid = requireEnv(env, 'TWILIO_ACCOUNT_SID');
    const token = requireEnv(env, 'TWILIO_AUTH_TOKEN');
    const from = requireEnv(env, 'TWILIO_FROM_NUMBER');
    const to = requireEnv(env, 'WORK_PHONE_NUMBER');

    const sms = [
      'BKDziti Contact Form',
      topic ? `Topic: ${topic}` : null,
      `Name: ${name}`,
      `Email: ${email}`,
      phone ? `Phone: ${phone}` : null,
      page ? `Page: ${page}` : null,
      '',
      message
    ].filter(Boolean).join('\n');

    const url = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`;
    const auth = btoa(`${sid}:${token}`);

    const body = new URLSearchParams();
    body.set('From', from);
    body.set('To', to);
    body.set('Body', sms.slice(0, 1500));

    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'authorization': `Basic ${auth}`,
        'content-type': 'application/x-www-form-urlencoded;charset=UTF-8'
      },
      body
    });

    if (!resp.ok) {
      const txt = await resp.text().catch(() => '');
      return jsonResponse({ ok: false, error: 'Send failed. Please text or email instead.' }, 502);
    }

    return jsonResponse({ ok: true });
  } catch (err) {
    return jsonResponse({ ok: false, error: 'Contact form is not configured yet. Please text or email for now.' }, 500);
  }
}

