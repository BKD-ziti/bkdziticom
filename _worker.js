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
  if (!val) throw new Error(`Missing env var: ${key}`);
  return val;
}

function clean(s) {
  return String(s || '').trim();
}

async function handleContact(request, env) {
  try {
    const ct = request.headers.get('content-type') || '';
    let data = {};

    if (ct.includes('application/json')) {
      data = await request.json().catch(() => ({}));
    } else {
      const fd = await request.formData();
      data = Object.fromEntries(fd.entries());
    }

    if (clean(data.company)) return jsonResponse({ ok: true });

    const name    = clean(data.name);
    const email   = clean(data.email);
    const phone   = clean(data.phone);
    const topic   = clean(data.topic);
    const message = clean(data.message);
    const page    = clean(data.page);

    if (!name || !email || !message) {
      return jsonResponse({ ok: false, error: 'Please include name, email, and a message.' }, 400);
    }
    if (name.length > 80 || email.length > 120 || phone.length > 40 || topic.length > 80 || message.length > 2000) {
      return jsonResponse({ ok: false, error: 'Message is too long.' }, 400);
    }

    const apiKey = requireEnv(env, 'RESEND_API_KEY');
    const from   = (env && env['RESEND_FROM']) || 'BKDziti Contact <contact@bkdziti.com>';
    const to     = (env && env['CONTACT_TO'])  || 'AlexZornes@BKDziti.com';

    const lines = [
      topic ? `Topic: ${topic}` : null,
      `Name: ${name}`,
      `Email: ${email}`,
      phone ? `Phone: ${phone}` : null,
      page  ? `Page: ${page}`   : null,
      '',
      message
    ].filter(s => s !== null).join('\n');

    const subject = topic
      ? `[BKDziti] ${topic} — from ${name}`
      : `[BKDziti] New message from ${name}`;

    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from,
        to: [to],
        reply_to: email,
        subject,
        text: lines
      })
    });

    if (!resp.ok) {
      const body = await resp.json().catch(() => ({}));
      console.error('Resend error:', resp.status, JSON.stringify(body));
      return jsonResponse({ ok: false, error: 'Send failed. Please text or email instead.' }, 502);
    }

    return jsonResponse({ ok: true });
  } catch (err) {
    console.error('Contact handler error:', err && err.message);
    return jsonResponse({ ok: false, error: 'Contact form is not configured yet. Please text or email for now.' }, 500);
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === 'POST' && url.pathname === '/api/contact') {
      return handleContact(request, env);
    }

    return env.ASSETS.fetch(request);
  }
};
