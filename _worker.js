// _worker.js — BKDziti Cloudflare Worker
// Routes: contact form, store API (public + admin), static asset passthrough.

// ─────────────────────────────────────────────────────────────────────────────
// SHARED UTILITIES
// ─────────────────────────────────────────────────────────────────────────────

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
  });
}

function requireEnv(env, key) {
  const val = env && env[key];
  if (!val) throw new Error(`Missing env var: ${key}`);
  return val;
}

function clean(s) { return String(s || '').trim(); }

function genId(prefix = 'id') {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, '')}`;
}

function formatPrice(cents) { return (cents / 100).toFixed(2); }

// ─────────────────────────────────────────────────────────────────────────────
// CONTACT HANDLER
// ─────────────────────────────────────────────────────────────────────────────

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

    if (clean(data.company)) return jsonResponse({ ok: true }); // honeypot

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
    const from   = env.RESEND_FROM || 'BKDziti Contact <contact@bkdziti.com>';
    const to     = env.CONTACT_TO  || 'AlexZornes@BKDziti.com';

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
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [to], reply_to: email, subject, text: lines })
    });

    if (!resp.ok) {
      const body = await resp.json().catch(() => ({}));
      console.error('Resend error:', resp.status, JSON.stringify(body));
      return jsonResponse({ ok: false, error: 'Send failed. Please text or email instead.' }, 502);
    }

    return jsonResponse({ ok: true });
  } catch (err) {
    console.error('Contact handler error:', err?.message);
    return jsonResponse({ ok: false, error: 'Contact form is not configured yet. Please text or email for now.' }, 500);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// STORE: KV HELPERS
// ─────────────────────────────────────────────────────────────────────────────

async function getProductList(env) {
  if (!env.STORE_KV) return [];
  const raw = await env.STORE_KV.get('products:index');
  return raw ? JSON.parse(raw) : [];
}

async function saveProductList(env, list) {
  await env.STORE_KV.put('products:index', JSON.stringify(list));
}

async function getOrderIndex(env) {
  if (!env.STORE_KV) return [];
  const raw = await env.STORE_KV.get('orders:index');
  return raw ? JSON.parse(raw) : [];
}

async function getOrder(env, id) {
  if (!env.STORE_KV) return null;
  const raw = await env.STORE_KV.get(`order:${id}`);
  return raw ? JSON.parse(raw) : null;
}

async function saveOrder(env, order) {
  await env.STORE_KV.put(`order:${order.id}`, JSON.stringify(order));

  // Update orders:index (summary array, newest first)
  const summary = {
    id: order.id,
    status: order.status,
    total: order.total,
    createdAt: order.createdAt,
    customer: { name: order.customer.name, email: order.customer.email }
  };
  const index = await getOrderIndex(env);
  const existing = index.findIndex(o => o.id === order.id);
  if (existing >= 0) {
    index[existing] = summary;
  } else {
    index.unshift(summary);
  }
  await env.STORE_KV.put('orders:index', JSON.stringify(index));

  // Customer email index
  const emailKey = `orders:email:${order.customer.email.toLowerCase()}`;
  const rawCustomer = await env.STORE_KV.get(emailKey);
  const customerOrders = rawCustomer ? JSON.parse(rawCustomer) : [];
  if (!customerOrders.includes(order.id)) {
    customerOrders.unshift(order.id);
    await env.STORE_KV.put(emailKey, JSON.stringify(customerOrders));
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// STORE: ADMIN AUTH
// ─────────────────────────────────────────────────────────────────────────────

function isAdmin(request, env) {
  const adminKey = env.ADMIN_KEY;
  if (!adminKey) return false;
  const auth = request.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : auth;
  return token === adminKey;
}

// ─────────────────────────────────────────────────────────────────────────────
// STORE: STRIPE HELPERS
// ─────────────────────────────────────────────────────────────────────────────

async function verifyStripeSignature(bodyText, signatureHeader, secret) {
  try {
    const parts = {};
    for (const part of signatureHeader.split(',')) {
      const eq = part.indexOf('=');
      if (eq > 0) parts[part.slice(0, eq)] = part.slice(eq + 1);
    }
    const timestamp = parts.t;
    const sig = parts.v1;
    if (!timestamp || !sig) return false;
    if (Math.abs(Date.now() / 1000 - parseInt(timestamp)) > 300) return false;

    const payload = `${timestamp}.${bodyText}`;
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const sigBuffer = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
    const computed = Array.from(new Uint8Array(sigBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
    return computed === sig;
  } catch {
    return false;
  }
}

function flattenForStripe(obj, prefix = '') {
  const parts = [];
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}[${k}]` : k;
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      parts.push(...flattenForStripe(v, key));
    } else if (Array.isArray(v)) {
      v.forEach((item, i) => {
        if (typeof item === 'object') {
          parts.push(...flattenForStripe(item, `${key}[${i}]`));
        } else {
          parts.push([`${key}[${i}]`, String(item)]);
        }
      });
    } else {
      parts.push([key, String(v)]);
    }
  }
  return parts;
}

async function createStripeSession(env, { orderId, items, customerEmail, origin }) {
  const stripeKey = requireEnv(env, 'STRIPE_SECRET_KEY');

  const lineItems = items.map(item => ({
    price_data: {
      currency: 'usd',
      product_data: { name: item.name },
      unit_amount: String(item.price)
    },
    quantity: String(item.quantity)
  }));

  const params = {
    mode: 'payment',
    success_url: `${origin}/store/confirmation.html?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/store/cart.html`,
    customer_email: customerEmail,
    'metadata[orderId]': orderId,
    line_items: lineItems
  };

  const pairs = flattenForStripe(params);
  const body = pairs.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');

  const resp = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${stripeKey}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Stripe session creation failed');
  }
  return resp.json();
}

// ─────────────────────────────────────────────────────────────────────────────
// STORE: ORDER EMAILS (via Resend)
// ─────────────────────────────────────────────────────────────────────────────

async function sendOrderEmails(env, order) {
  const apiKey = env.RESEND_API_KEY;
  if (!apiKey) return;

  const from    = env.RESEND_FROM || 'BKDziti Store <contact@bkdziti.com>';
  const adminTo = env.CONTACT_TO  || 'info@bkdziti.com';

  const rowStyle = 'padding:10px 8px;border-bottom:1px solid rgba(249,83,1,0.15)';
  const itemsHtml = order.items.map(item => `
    <tr>
      <td style="${rowStyle}">${item.name}</td>
      <td style="${rowStyle};text-align:center">${item.quantity}</td>
      <td style="${rowStyle};text-align:right">$${formatPrice(item.price * item.quantity)}</td>
    </tr>`).join('');

  const receiptHtml = `<!DOCTYPE html><html lang="en">
<body style="margin:0;padding:0;background:#0a0500;color:#fcf9f5;font-family:'Helvetica Neue',Arial,sans-serif">
<div style="max-width:600px;margin:0 auto;padding:2.5rem 2rem">
  <div style="text-align:center;margin-bottom:2rem;padding-bottom:1.5rem;border-bottom:1px solid rgba(249,83,1,0.2)">
    <h1 style="margin:0;font-size:2.2rem;color:#FF9A0B;letter-spacing:-0.02em">BKDziti</h1>
    <p style="margin:0.25rem 0 0;color:#F95301;font-size:0.85rem;letter-spacing:0.15em">ベイクドジーティ</p>
  </div>
  <h2 style="color:#FF9A0B;margin:0 0 0.5rem">Order Confirmed!</h2>
  <p style="color:rgba(252,249,245,0.8);margin:0 0 1.5rem">Hi ${order.customer.name}, your order has been confirmed and we'll be in touch shortly.</p>
  <div style="background:#1a0a00;border:1px solid rgba(249,83,1,0.25);border-radius:12px;padding:1.5rem;margin-bottom:1.5rem">
    <p style="margin:0 0 1rem;font-size:0.82rem;color:#F9EACA;letter-spacing:0.05em">ORDER ID: <strong>${order.id}</strong></p>
    <table style="width:100%;border-collapse:collapse">
      <thead><tr>
        <th style="padding:8px;text-align:left;font-size:0.75rem;letter-spacing:0.1em;text-transform:uppercase;color:#FF9A0B;border-bottom:1px solid rgba(249,83,1,0.3)">Item</th>
        <th style="padding:8px;text-align:center;font-size:0.75rem;letter-spacing:0.1em;text-transform:uppercase;color:#FF9A0B;border-bottom:1px solid rgba(249,83,1,0.3)">Qty</th>
        <th style="padding:8px;text-align:right;font-size:0.75rem;letter-spacing:0.1em;text-transform:uppercase;color:#FF9A0B;border-bottom:1px solid rgba(249,83,1,0.3)">Price</th>
      </tr></thead>
      <tbody>${itemsHtml}</tbody>
      <tfoot><tr>
        <td colspan="2" style="padding:12px 8px 0;font-weight:bold;color:#FF9A0B">Total</td>
        <td style="padding:12px 8px 0;text-align:right;font-weight:bold;color:#FF9A0B">$${formatPrice(order.total)}</td>
      </tr></tfoot>
    </table>
  </div>
  <p style="color:rgba(252,249,245,0.6);font-size:0.9rem;line-height:1.6">
    Have questions? Reply to this email or reach out at
    <a href="mailto:AlexZornes@BKDziti.com" style="color:#FF9A0B;text-decoration:none">AlexZornes@BKDziti.com</a>.
  </p>
  <div style="margin-top:2rem;padding-top:1.5rem;border-top:1px solid rgba(249,83,1,0.15);text-align:center;font-size:0.72rem;color:rgba(252,249,245,0.3)">
    &copy; 2026 BKDziti LLC &middot; All Rights Reserved
  </div>
</div>
</body></html>`;

  const adminHtml = `<!DOCTYPE html><html lang="en">
<body style="margin:0;padding:0;background:#0a0500;color:#fcf9f5;font-family:'Helvetica Neue',Arial,sans-serif">
<div style="max-width:600px;margin:0 auto;padding:2rem">
  <h1 style="color:#FF9A0B;margin:0 0 0.5rem">&#x1F6CD; New Order</h1>
  <p style="color:rgba(252,249,245,0.5);font-size:0.82rem;margin:0 0 1.5rem">${new Date(order.createdAt).toLocaleString()}</p>
  <div style="background:#1a0a00;border:1px solid rgba(249,83,1,0.25);border-radius:12px;padding:1.5rem;margin-bottom:1.5rem">
    <p style="margin:0 0 0.5rem"><strong style="color:#FF9A0B">Order ID:</strong> ${order.id}</p>
    <p style="margin:0 0 0.5rem"><strong style="color:#FF9A0B">Customer:</strong> ${order.customer.name}</p>
    <p style="margin:0"><strong style="color:#FF9A0B">Email:</strong> <a href="mailto:${order.customer.email}" style="color:#F9EACA">${order.customer.email}</a></p>
  </div>
  <table style="width:100%;border-collapse:collapse;margin-bottom:1rem">
    <thead><tr>
      <th style="padding:8px;text-align:left;font-size:0.75rem;text-transform:uppercase;color:#FF9A0B;border-bottom:1px solid rgba(249,83,1,0.3)">Item</th>
      <th style="padding:8px;text-align:center;font-size:0.75rem;text-transform:uppercase;color:#FF9A0B;border-bottom:1px solid rgba(249,83,1,0.3)">Qty</th>
      <th style="padding:8px;text-align:right;font-size:0.75rem;text-transform:uppercase;color:#FF9A0B;border-bottom:1px solid rgba(249,83,1,0.3)">Price</th>
    </tr></thead>
    <tbody>${itemsHtml}</tbody>
  </table>
  <p style="font-size:1.1rem"><strong style="color:#FF9A0B">Total: $${formatPrice(order.total)}</strong></p>
</div>
</body></html>`;

  await Promise.allSettled([
    fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from,
        to: [order.customer.email],
        subject: `Order Confirmed — BKDziti (#${order.id.slice(-8).toUpperCase()})`,
        html: receiptHtml
      })
    }),
    fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from,
        to: [adminTo],
        subject: `[BKDziti Store] New order from ${order.customer.name} — $${formatPrice(order.total)}`,
        html: adminHtml
      })
    })
  ]);
}

// ─────────────────────────────────────────────────────────────────────────────
// STORE: PUBLIC API HANDLERS
// ─────────────────────────────────────────────────────────────────────────────

async function handleGetProducts(env) {
  const products = await getProductList(env);
  return jsonResponse({ ok: true, products: products.filter(p => p.active) });
}

async function handleGetProduct(env, id) {
  const products = await getProductList(env);
  const product = products.find(p => p.id === id);
  if (!product || !product.active) return jsonResponse({ ok: false, error: 'Product not found' }, 404);
  return jsonResponse({ ok: true, product });
}

async function handleCreateCheckout(request, env) {
  try {
    const data = await request.json().catch(() => null);
    if (!data?.items?.length) return jsonResponse({ ok: false, error: 'Cart is empty' }, 400);

    const customerEmail = clean(data.customerEmail);
    const customerName  = clean(data.customerName);
    if (!customerEmail || !customerName) {
      return jsonResponse({ ok: false, error: 'Name and email are required' }, 400);
    }

    // Server-side price validation — never trust client prices
    const products = await getProductList(env);
    const validatedItems = [];
    for (const cartItem of data.items) {
      const product = products.find(p => p.id === cartItem.productId && p.active);
      if (!product) return jsonResponse({ ok: false, error: `Product unavailable: ${cartItem.productId}` }, 400);
      const qty = Math.max(1, Math.min(100, parseInt(cartItem.quantity) || 1));
      validatedItems.push({ productId: product.id, name: product.name, price: product.price, quantity: qty });
    }

    const total   = validatedItems.reduce((s, i) => s + i.price * i.quantity, 0);
    const orderId = genId('ord');
    const now     = new Date().toISOString();

    const order = {
      id: orderId,
      stripeSessionId: null,
      status: 'pending',
      customer: { name: customerName, email: customerEmail },
      items: validatedItems,
      subtotal: total,
      total,
      createdAt: now,
      paidAt: null
    };

    await saveOrder(env, order);

    const origin  = new URL(request.url).origin;
    const session = await createStripeSession(env, { orderId, items: validatedItems, customerEmail, origin });

    order.stripeSessionId = session.id;
    await saveOrder(env, order);

    return jsonResponse({ ok: true, url: session.url });
  } catch (err) {
    console.error('Checkout error:', err?.message);
    return jsonResponse({ ok: false, error: err?.message || 'Checkout failed' }, 500);
  }
}

async function handleVerifySession(env, request) {
  const url       = new URL(request.url);
  const sessionId = url.searchParams.get('session_id');
  if (!sessionId) return jsonResponse({ ok: false, error: 'session_id required' }, 400);

  const stripeKey = env.STRIPE_SECRET_KEY;
  if (!stripeKey) return jsonResponse({ ok: false, error: 'Store not configured' }, 500);

  const resp = await fetch(`https://api.stripe.com/v1/checkout/sessions/${sessionId}`, {
    headers: { 'Authorization': `Bearer ${stripeKey}` }
  });
  if (!resp.ok) return jsonResponse({ ok: false, error: 'Session not found' }, 404);

  const session = await resp.json();
  const orderId = session.metadata?.orderId;
  if (!orderId) return jsonResponse({ ok: false, error: 'No order linked to session' }, 404);

  const order = await getOrder(env, orderId);
  if (!order) return jsonResponse({ ok: false, error: 'Order not found' }, 404);

  return jsonResponse({ ok: true, order, paymentStatus: session.payment_status });
}

async function handleGetOrder(env, id, request) {
  const order = await getOrder(env, id);
  if (!order) return jsonResponse({ ok: false, error: 'Not found' }, 404);

  const url   = new URL(request.url);
  const email = url.searchParams.get('email');
  if (!email || email.toLowerCase() !== order.customer.email.toLowerCase()) {
    return jsonResponse({ ok: false, error: 'Not found' }, 404);
  }
  return jsonResponse({ ok: true, order });
}

async function handleGetCustomerOrders(env, request) {
  const url   = new URL(request.url);
  const email = url.searchParams.get('email');
  if (!email) return jsonResponse({ ok: false, error: 'email required' }, 400);

  const emailKey = `orders:email:${email.toLowerCase()}`;
  if (!env.STORE_KV) return jsonResponse({ ok: true, orders: [] });
  const raw = await env.STORE_KV.get(emailKey);
  const orderIds = raw ? JSON.parse(raw) : [];
  const orders = await Promise.all(orderIds.slice(0, 20).map(id => getOrder(env, id)));
  return jsonResponse({ ok: true, orders: orders.filter(Boolean) });
}

async function handleStripeWebhook(request, env) {
  const sig           = request.headers.get('stripe-signature') || '';
  const webhookSecret = env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) return new Response('Webhook not configured', { status: 500 });

  const bodyText = await request.text();
  const valid    = await verifyStripeSignature(bodyText, sig, webhookSecret);
  if (!valid) return new Response('Invalid signature', { status: 400 });

  const event = JSON.parse(bodyText);
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const orderId = session.metadata?.orderId;
    if (orderId) {
      const order = await getOrder(env, orderId);
      if (order && order.status !== 'paid') {
        order.status          = 'paid';
        order.paidAt          = new Date().toISOString();
        order.stripeSessionId = session.id;
        await saveOrder(env, order);
        await sendOrderEmails(env, order);
      }
    }
  }

  return new Response('ok', { status: 200 });
}

// ─────────────────────────────────────────────────────────────────────────────
// STORE: ADMIN API HANDLERS
// ─────────────────────────────────────────────────────────────────────────────

async function handleAdminAuth(request, env) {
  const data = await request.json().catch(() => ({}));
  const key  = clean(data.key);
  const adminKey = env.ADMIN_KEY;
  if (!adminKey || key !== adminKey) {
    return jsonResponse({ ok: false, error: 'Invalid credentials' }, 401);
  }
  return jsonResponse({ ok: true, token: adminKey });
}

async function handleAdminGetProducts(env) {
  const products = await getProductList(env);
  return jsonResponse({ ok: true, products });
}

async function handleAdminCreateProduct(request, env) {
  const data = await request.json().catch(() => null);
  if (!data?.name || !data.price) {
    return jsonResponse({ ok: false, error: 'name and price are required' }, 400);
  }

  const price = Math.round(parseFloat(data.price) * 100);
  if (isNaN(price) || price <= 0) return jsonResponse({ ok: false, error: 'Invalid price' }, 400);

  const product = {
    id:          genId('prod'),
    name:        clean(data.name).slice(0, 120),
    description: clean(data.description).slice(0, 2000),
    price,
    imageUrl:    clean(data.imageUrl).slice(0, 500),
    category:    clean(data.category).slice(0, 60) || 'general',
    active:      data.active !== false,
    createdAt:   new Date().toISOString(),
    updatedAt:   new Date().toISOString()
  };

  const list = await getProductList(env);
  list.unshift(product);
  await saveProductList(env, list);
  return jsonResponse({ ok: true, product }, 201);
}

async function handleAdminUpdateProduct(request, env, id) {
  const data = await request.json().catch(() => null);
  if (!data) return jsonResponse({ ok: false, error: 'Invalid request' }, 400);

  const list = await getProductList(env);
  const idx  = list.findIndex(p => p.id === id);
  if (idx < 0) return jsonResponse({ ok: false, error: 'Product not found' }, 404);

  const product = { ...list[idx] };
  if (data.name        !== undefined) product.name        = clean(data.name).slice(0, 120);
  if (data.description !== undefined) product.description = clean(data.description).slice(0, 2000);
  if (data.price       !== undefined) product.price       = Math.round(parseFloat(data.price) * 100);
  if (data.imageUrl    !== undefined) product.imageUrl    = clean(data.imageUrl).slice(0, 500);
  if (data.category    !== undefined) product.category    = clean(data.category).slice(0, 60);
  if (data.active      !== undefined) product.active      = Boolean(data.active);
  product.updatedAt = new Date().toISOString();

  list[idx] = product;
  await saveProductList(env, list);
  return jsonResponse({ ok: true, product });
}

async function handleAdminDeleteProduct(env, id) {
  const list = await getProductList(env);
  const idx  = list.findIndex(p => p.id === id);
  if (idx < 0) return jsonResponse({ ok: false, error: 'Product not found' }, 404);
  list.splice(idx, 1);
  await saveProductList(env, list);
  return jsonResponse({ ok: true });
}

async function handleAdminGetOrders(env) {
  const index = await getOrderIndex(env);
  return jsonResponse({ ok: true, orders: index });
}

async function handleAdminGetOrder(env, id) {
  const order = await getOrder(env, id);
  if (!order) return jsonResponse({ ok: false, error: 'Order not found' }, 404);
  return jsonResponse({ ok: true, order });
}

async function handleAdminUpdateOrder(request, env, id) {
  const data = await request.json().catch(() => null);
  if (!data) return jsonResponse({ ok: false, error: 'Invalid request' }, 400);

  const order = await getOrder(env, id);
  if (!order) return jsonResponse({ ok: false, error: 'Order not found' }, 404);

  const validStatuses = ['pending', 'paid', 'processing', 'fulfilled', 'cancelled'];
  if (data.status && validStatuses.includes(data.status)) order.status = data.status;
  if (data.notes !== undefined) order.notes = clean(data.notes).slice(0, 1000);
  order.updatedAt = new Date().toISOString();

  await saveOrder(env, order);
  return jsonResponse({ ok: true, order });
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN ROUTER
// ─────────────────────────────────────────────────────────────────────────────

export default {
  async fetch(request, env, ctx) {
    const url      = new URL(request.url);
    const path     = url.pathname;
    const method   = request.method;

    // ── Contact ──────────────────────────────────────────────────────────────
    if (method === 'POST' && path === '/api/contact') return handleContact(request, env);

    // ── Store: Public ─────────────────────────────────────────────────────────
    if (path === '/api/store/products'   && method === 'GET')  return handleGetProducts(env);
    if (path === '/api/store/checkout'   && method === 'POST') return handleCreateCheckout(request, env);
    if (path === '/api/store/verify-session' && method === 'GET') return handleVerifySession(env, request);
    if (path === '/api/store/customer-orders' && method === 'GET') return handleGetCustomerOrders(env, request);
    if (path === '/api/store/stripe-webhook' && method === 'POST') return handleStripeWebhook(request, env);

    if (path.startsWith('/api/store/products/') && method === 'GET') {
      return handleGetProduct(env, path.slice('/api/store/products/'.length));
    }
    if (path.startsWith('/api/store/orders/') && method === 'GET') {
      return handleGetOrder(env, path.slice('/api/store/orders/'.length), request);
    }

    // ── Store: Admin ──────────────────────────────────────────────────────────
    if (path.startsWith('/api/store/admin/')) {
      if (path === '/api/store/admin/auth' && method === 'POST') return handleAdminAuth(request, env);

      if (!isAdmin(request, env)) return jsonResponse({ ok: false, error: 'Unauthorized' }, 401);

      if (path === '/api/store/admin/products') {
        if (method === 'GET')  return handleAdminGetProducts(env);
        if (method === 'POST') return handleAdminCreateProduct(request, env);
      }
      if (path.startsWith('/api/store/admin/products/')) {
        const id = path.slice('/api/store/admin/products/'.length);
        if (method === 'PUT')    return handleAdminUpdateProduct(request, env, id);
        if (method === 'DELETE') return handleAdminDeleteProduct(env, id);
      }
      if (path === '/api/store/admin/orders' && method === 'GET') return handleAdminGetOrders(env);
      if (path.startsWith('/api/store/admin/orders/')) {
        const id = path.slice('/api/store/admin/orders/'.length);
        if (method === 'GET') return handleAdminGetOrder(env, id);
        if (method === 'PUT') return handleAdminUpdateOrder(request, env, id);
      }

      return jsonResponse({ ok: false, error: 'Not found' }, 404);
    }

    // ── Static assets ─────────────────────────────────────────────────────────
    return env.ASSETS.fetch(request);
  }
};
