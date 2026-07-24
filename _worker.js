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

// Basic RFC-5322-ish format check — not exhaustive, just enough to reject
// garbage like "sxdfgvhb" before it becomes a Stripe API call or an order.
function isValidEmail(s) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s || '').trim());
}

// Adds baseline security headers to a response without touching its body —
// safe to wrap around any HTML/asset response, no visual or functional effect.
function withSecurityHeaders(response) {
  const headers = new Headers(response.headers);
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('X-Frame-Options', 'SAMEORIGIN');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), interest-cohort=()');
  headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

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
// STORE: REVIEWS KV HELPERS
// ─────────────────────────────────────────────────────────────────────────────

async function getProductReviews(env, productId) {
  if (!env.STORE_KV) return [];
  const raw = await env.STORE_KV.get(`reviews:${productId}`);
  return raw ? JSON.parse(raw) : [];
}

async function saveProductReviews(env, productId, reviews) {
  await env.STORE_KV.put(`reviews:${productId}`, JSON.stringify(reviews));
}

async function handleGetReviews(env, productId) {
  const reviews = await getProductReviews(env, productId);
  const avg = reviews.length
    ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
    : 0;
  return jsonResponse({ ok: true, reviews, average: Math.round(avg * 10) / 10, count: reviews.length });
}

async function handleSubmitReview(request, env, productId) {
  try {
    const body = await request.json();
    const email   = clean(body.email).toLowerCase();
    const name    = clean(body.name);
    const rating  = parseInt(body.rating, 10);
    const comment = clean(body.comment);

    if (!email || !name || !rating) {
      return jsonResponse({ ok: false, error: 'Name, email, and rating are required.' }, 400);
    }
    if (rating < 1 || rating > 5) {
      return jsonResponse({ ok: false, error: 'Rating must be between 1 and 5.' }, 400);
    }
    if (comment.length > 1000) {
      return jsonResponse({ ok: false, error: 'Review must be under 1000 characters.' }, 400);
    }

    const emailKey = `orders:email:${email}`;
    const rawOrders = env.STORE_KV ? await env.STORE_KV.get(emailKey) : null;
    if (!rawOrders) {
      return jsonResponse({ ok: false, error: 'No orders found for this email. You must purchase before reviewing.' }, 403);
    }

    const orderIds = JSON.parse(rawOrders);
    let hasPurchased = false;
    for (const oid of orderIds) {
      const order = await getOrder(env, oid);
      if (order && (order.status === 'paid' || order.status === 'fulfilled') &&
          order.items && order.items.some(i => i.productId === productId)) {
        hasPurchased = true;
        break;
      }
    }
    if (!hasPurchased) {
      return jsonResponse({ ok: false, error: 'You must purchase this item before leaving a review.' }, 403);
    }

    const reviews = await getProductReviews(env, productId);
    const existing = reviews.findIndex(r => r.email === email);
    const review = {
      id: genId('rev'),
      email,
      name,
      rating,
      comment,
      createdAt: new Date().toISOString()
    };

    if (existing >= 0) {
      reviews[existing] = review;
    } else {
      reviews.unshift(review);
    }

    await saveProductReviews(env, productId, reviews);

    const avg = reviews.reduce((s, r) => s + r.rating, 0) / reviews.length;
    return jsonResponse({ ok: true, review, average: Math.round(avg * 10) / 10, count: reviews.length });
  } catch (err) {
    return jsonResponse({ ok: false, error: err.message || 'Failed to submit review' }, 500);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// STORE: QUOTE REQUEST HANDLER
// ─────────────────────────────────────────────────────────────────────────────

async function handleQuoteRequest(request, env) {
  try {
    const data = await request.json().catch(() => null);
    if (!data) return jsonResponse({ ok: false, error: 'Invalid request' }, 400);

    const name    = clean(data.name);
    const email   = clean(data.email);
    const phone   = clean(data.phone);
    const service = clean(data.service);
    const details = clean(data.details);

    if (!name || !email || !details) {
      return jsonResponse({ ok: false, error: 'Name, email, and project details are required.' }, 400);
    }
    if (name.length > 80 || email.length > 120 || phone.length > 40 || service.length > 120 || details.length > 3000) {
      return jsonResponse({ ok: false, error: 'One or more fields are too long.' }, 400);
    }

    const apiKey = requireEnv(env, 'RESEND_API_KEY');
    const from   = env.RESEND_FROM || 'BKDziti Store <contact@bkdziti.com>';
    const to     = 'info@bkdziti.com';

    const body = [
      `Custom Quote Request`,
      ``,
      `Name: ${name}`,
      `Email: ${email}`,
      phone ? `Phone: ${phone}` : null,
      service ? `Service interest: ${service}` : null,
      ``,
      `Project Details:`,
      details
    ].filter(s => s !== null).join('\n');

    const subject = `[BKDziti Store] Custom Quote Request — ${name}`;

    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to, subject, text: body, reply_to: email })
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.message || 'Email send failed');
    }

    return jsonResponse({ ok: true });
  } catch (err) {
    return jsonResponse({ ok: false, error: err.message || 'Failed to send quote request' }, 500);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// STORE: SEED PRODUCTS
// ─────────────────────────────────────────────────────────────────────────────

const SEED_PRODUCTS = [
  // ── CONSULTATION ──────────────────────────────────────────────────────────
  {
    id: 'prod_consultation_hourly',
    name: 'Consultation — Hourly',
    description: 'One-on-one consulting time billed per hour. Strategy calls, menu feedback, brand reviews, social media audits, operations guidance — whatever you need. Minimum 1 hour booking. Schedule at a time that works for you.',
    features: ['Strategy & concept calls', 'Menu & brand feedback', 'Social media audits', 'Operations guidance', 'Min. 1 hour booking', 'Flexible scheduling'],
    price: 15000,
    imageUrl: '/assets/images/IMG_2336.JPG',
    type: 'service',
    pricingModel: 'one-time',
    billingInterval: '',
    active: true
  },
  {
    id: 'prod_consultation_retainer',
    name: 'Consultation Retainer',
    description: 'Monthly consulting retainer for ongoing strategic support. Priority access with 4+ hours per month, unlimited email Q&A, a monthly strategy call, and dedicated project support. Best for businesses in active growth phases.',
    features: ['4+ consulting hours/month', 'Priority access & scheduling', 'Unlimited email Q&A', 'Monthly strategy call', 'Ongoing project support', 'Cancel anytime'],
    price: 80000,
    imageUrl: '/assets/images/IMG_2336.JPG',
    type: 'service',
    pricingModel: 'monthly',
    billingInterval: '',
    active: true
  },
  // ── MEDIA PRODUCTION ──────────────────────────────────────────────────────
  {
    id: 'prod_media_photography',
    name: 'Photography Session',
    description: 'Professional food and brand photography. High-quality images with expert lighting, composition, and styling. Perfect for menus, websites, social media, and marketing materials. Delivered as edited, high-resolution files.',
    features: ['30–50 edited images', 'Expert lighting & styling', 'Food & lifestyle photography', 'Social-ready formats', 'High-res file delivery', '1-week turnaround'],
    price: 30000,
    imageUrl: '/assets/images/IMG_2339(1).JPG',
    type: 'service',
    pricingModel: 'one-time',
    billingInterval: '',
    active: true
  },
  {
    id: 'prod_media_videography',
    name: 'Videography',
    description: 'Professional video production for your brand. Short-form social videos for Instagram Reels and TikTok, dish prep videos, full menu showcases, and brand promos. Color-graded and music-licensed for immediate publication.',
    features: ['Short-form social videos', 'Color grading & music', 'Scripting support', 'Reels / TikTok / YouTube ready', 'Platform-optimized cuts', '2-week turnaround'],
    price: 60000,
    imageUrl: '/assets/images/Datamosh-Dream.mp4',
    type: 'service',
    pricingModel: 'one-time',
    billingInterval: '',
    active: true
  },
  {
    id: 'prod_media_editing',
    name: 'Video Editing',
    description: "Send us your raw footage and we'll edit it into polished, platform-ready content. Includes color grading, music, captions, and graphics. Perfect if you shoot your own content but need professional post-production.",
    features: ['Bring your own footage', 'Color grading', 'Captions & on-screen graphics', 'Platform-optimized cuts', 'Up to 10 min raw footage', '1-week turnaround'],
    price: 20000,
    imageUrl: '/assets/images/Datamosh-Dream.mp4',
    type: 'service',
    pricingModel: 'one-time',
    billingInterval: '',
    active: true
  },
  {
    id: 'prod_media_bundle',
    name: 'Monthly Content Bundle',
    description: 'Consistent, professional content every month. Includes a monthly photo + video shoot, 10+ edited images, 2 short-form social videos, and a content calendar to keep your brand looking fresh across all platforms.',
    features: ['Monthly photo + video shoot', '10+ edited images', '2 short-form social videos', 'Content calendar included', 'All platforms covered', 'Cancel anytime'],
    price: 100000,
    imageUrl: '/assets/images/Datamosh-Dream.mp4',
    type: 'service',
    pricingModel: 'monthly',
    billingInterval: '',
    active: true
  },
  // ── POP-UP COORDINATION ───────────────────────────────────────────────────
  {
    id: 'prod_popup_starter',
    name: 'Pop-Up — Starter',
    description: 'Get your pop-up off the ground with expert planning support. Includes concept development, menu planning, vendor recommendations, and a marketing template to promote your event. Virtual support throughout.',
    features: ['Concept development', 'Menu planning', 'Vendor list & recommendations', 'Marketing template', 'Virtual support throughout', 'Up to 50 covers'],
    price: 100000,
    imageUrl: '/assets/images/IMG_0326.JPG',
    type: 'service',
    pricingModel: 'one-time',
    billingInterval: '',
    active: true
  },
  {
    id: 'prod_popup_standard',
    name: 'Pop-Up — Standard',
    description: 'Full-service pop-up coordination from concept to execution. We handle concept + menu design, vendor sourcing, marketing campaign creation, and are on-site for the event. Includes a post-event report with insights.',
    features: ['Full concept + menu design', 'Vendor sourcing & logistics', 'Marketing campaign creation', 'On-site coordination', 'Post-event report', 'Up to 100 covers'],
    price: 250000,
    imageUrl: '/assets/images/IMG_0326.JPG',
    type: 'service',
    pricingModel: 'one-time',
    billingInterval: '',
    active: true
  },
  {
    id: 'prod_popup_premium',
    name: 'Pop-Up — Premium',
    description: 'The full BKDziti experience. Everything in Standard plus professional media production (photo + video), a paid social ad campaign, custom brand activation design, and a dedicated project manager from start to finish.',
    features: ['Everything in Standard', 'Professional photo + video', 'Paid social ad campaign', 'Brand activation design', 'Dedicated project manager', 'Unlimited covers'],
    price: 500000,
    imageUrl: '/assets/images/IMG_0326.JPG',
    type: 'service',
    pricingModel: 'one-time',
    billingInterval: '',
    active: true
  },
  // ── BRANDING & MARKETING ──────────────────────────────────────────────────
  {
    id: 'prod_brand_strategy',
    name: 'Brand Strategy',
    description: 'A comprehensive brand audit and positioning report. We analyze your current brand, competitors, and target audience — then deliver a clear, actionable 60-day plan to strengthen your presence and grow your customer base.',
    features: ['Brand & competitor audit', 'Target audience research', 'Brand positioning report', '60-day action plan', '1-hour debrief call', 'Delivered in 2 weeks'],
    price: 100000,
    imageUrl: '/assets/images/IMG_2340(1).JPG',
    type: 'service',
    pricingModel: 'one-time',
    billingInterval: '',
    active: true
  },
  {
    id: 'prod_brand_identity',
    name: 'Brand Identity',
    description: 'A complete brand identity system for your business — restaurant or otherwise. Three logo concepts, refined to one final design, with a full visual system: color palette, typography, brand guidelines PDF, and social media templates.',
    features: ['3 logo concepts', 'Color palette & typography', 'Brand guidelines PDF', 'Social media templates', 'All file formats (SVG, PNG, PDF)', '3-week delivery'],
    price: 200000,
    imageUrl: '/assets/images/IMG_2340(1).JPG',
    type: 'service',
    pricingModel: 'one-time',
    billingInterval: '',
    active: true
  },
  {
    id: 'prod_brand_social',
    name: 'Social Media Management',
    description: 'Done-for-you social media management. We create 12 posts per month (photo + caption), develop your platform strategy, handle hashtag research, and deliver a monthly performance report. Keep your brand visible and growing.',
    features: ['12 posts/month (photo + caption)', 'Platform strategy', 'Hashtag research', 'Monthly performance report', 'Instagram & Facebook covered', 'Cancel anytime'],
    price: 50000,
    imageUrl: '/assets/images/IMG_2340(1).JPG',
    type: 'service',
    pricingModel: 'monthly',
    billingInterval: '',
    active: true
  },
  // ── MEAL PREP ─────────────────────────────────────────────────────────────
  {
    id: 'prod_meal_weekly',
    name: 'Meal Prep — Weekly',
    description: '7-day meal plan, prepped fresh and ready to go. Nutritious, flavorful meals made with fresh ingredients — portioned and packaged for the week. Dietary preferences and restrictions accommodated. Delivered weekly.',
    features: ['7 days of meals', 'Fresh ingredient prep', 'Portion-controlled', 'Dietary accommodations', 'Weekly delivery', 'Cancel anytime'],
    price: 10000,
    imageUrl: '/assets/images/IMG_1123.PNG',
    type: 'product',
    pricingModel: 'weekly',
    billingInterval: '',
    active: true
  },
  {
    id: 'prod_meal_biweekly',
    name: 'Meal Prep — Bi-Weekly',
    description: '14 meals delivered every two weeks. A flexible option for those who want consistent meal prep without a weekly commitment. Variety of recipes each cycle, with dietary preferences and restrictions accommodated.',
    features: ['14 meals per cycle', 'Fresh ingredient prep', 'Recipe variety each cycle', 'Dietary accommodations', 'Bi-weekly delivery', 'Cancel anytime'],
    price: 18000,
    imageUrl: '/assets/images/IMG_1123.PNG',
    type: 'product',
    pricingModel: 'biweekly',
    billingInterval: '',
    active: true
  },
  {
    id: 'prod_meal_monthly',
    name: 'Meal Prep — Monthly',
    description: 'A full month of meal prep planning and preparation. Includes a seasonal menu rotation, detailed prep instructions, a grocery list you can shop yourself or let us handle, and priority scheduling for your delivery slot.',
    features: ['Full month coverage (4 weeks)', 'Seasonal menu rotation', 'Detailed prep instructions', 'Grocery list included', 'Priority scheduling', 'Cancel anytime'],
    price: 30000,
    imageUrl: '/assets/images/IMG_1123.PNG',
    type: 'product',
    pricingModel: 'monthly',
    billingInterval: '',
    active: true
  },
  // ── CUSTOM QUOTE ──────────────────────────────────────────────────────────
  {
    id: 'prod_custom_quote',
    name: 'Request a Custom Quote',
    description: "Have a project in mind that doesn't fit a standard package? Tell us what you need — we'll put together a custom solution and send you a quote within 24 hours. No commitment required.",
    features: ['Mix and match services', 'Custom package pricing', '24-hour response guarantee', 'No commitment required', 'Tailored to your goals', 'Free to request'],
    price: 0,
    imageUrl: '/assets/images/Card.png',
    type: 'service',
    pricingModel: 'quote',
    billingInterval: '',
    active: true
  }
];

async function handleAdminSeedProducts(env) {
  // Non-destructive seeding: any product that already exists is left EXACTLY
  // as the admin last saved it — edits, ordering, and active-state all stick.
  // Only genuinely new seed products (an id not already present) are appended.
  // A re-seed therefore never overwrites or reverts admin-managed items.
  const existing = await getProductList(env);
  const now = new Date().toISOString();
  const haveIds = new Set(existing.map(p => p.id));
  const merged = existing.slice();
  let added = 0;
  for (const seed of SEED_PRODUCTS) {
    if (!haveIds.has(seed.id)) {
      merged.push({ ...seed, createdAt: now, updatedAt: now });
      added++;
    }
  }
  await saveProductList(env, merged);
  return jsonResponse({ ok: true, seeded: added, total: merged.length });
}

// ─────────────────────────────────────────────────────────────────────────────
// STORE: ADMIN AUTH
//
// The client never receives the raw ADMIN_KEY. On login we issue a short-lived
// HMAC-signed session token ("<payloadB64>.<sigB64>") whose signing key is
// derived from ADMIN_KEY — so no extra secret/env var is needed. isAdmin()
// verifies the signature and the embedded expiry, so a leaked token is useless
// after it expires and can never be replayed as the permanent password.
// ─────────────────────────────────────────────────────────────────────────────

const SESSION_TTL_SECONDS = 8 * 60 * 60; // absolute lifetime of an admin session

// Constant-time compare of two equal-length byte arrays.
function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

function b64urlEncode(bytes) {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecode(str) {
  const pad = str.length % 4 ? '='.repeat(4 - (str.length % 4)) : '';
  const bin = atob(str.replace(/-/g, '+').replace(/_/g, '/') + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function sessionSigningKey(env) {
  const secret = requireEnv(env, 'ADMIN_KEY');
  // Namespace the derived key so the session secret is distinct from the raw key.
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode('bkd-admin-session-v1:' + secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

async function issueSessionToken(env) {
  const payload = { exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS, iat: Math.floor(Date.now() / 1000) };
  const payloadB64 = b64urlEncode(new TextEncoder().encode(JSON.stringify(payload)));
  const key = await sessionSigningKey(env);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payloadB64));
  return payloadB64 + '.' + b64urlEncode(new Uint8Array(sig));
}

async function verifySessionToken(env, token) {
  if (!env.ADMIN_KEY || !token || token.indexOf('.') === -1) return false;
  const [payloadB64, sigB64] = token.split('.');
  if (!payloadB64 || !sigB64) return false;
  try {
    const key = await sessionSigningKey(env);
    const expected = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payloadB64)));
    const provided = b64urlDecode(sigB64);
    if (!timingSafeEqual(expected, provided)) return false;
    const payload = JSON.parse(new TextDecoder().decode(b64urlDecode(payloadB64)));
    if (!payload || typeof payload.exp !== 'number') return false;
    if (payload.exp < Math.floor(Date.now() / 1000)) return false;
    return true;
  } catch {
    return false;
  }
}

// Constant-time verification that the supplied password matches ADMIN_KEY.
// Both sides are SHA-256'd first so the compare is fixed-length and leaks
// neither the key length nor a per-character timing signal.
async function adminKeyMatches(env, provided) {
  if (!env.ADMIN_KEY) return false;
  const enc = new TextEncoder();
  const a = new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(provided)));
  const b = new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(env.ADMIN_KEY)));
  return timingSafeEqual(a, b);
}

async function isAdmin(request, env) {
  const auth = request.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : auth;
  return verifySessionToken(env, token);
}

// ── Brute-force throttle (KV-backed, per IP) ─────────────────────────────────
const AUTH_MAX_FAILURES = 8;      // failures allowed within the window
const AUTH_WINDOW_SECONDS = 900;  // 15-minute rolling window / lockout

async function authAttemptsKey(ip) { return `authfail:${ip}`; }

async function isAuthRateLimited(env, ip) {
  if (!env.STORE_KV) return false;
  const raw = await env.STORE_KV.get(await authAttemptsKey(ip));
  return raw ? parseInt(raw, 10) >= AUTH_MAX_FAILURES : false;
}

async function recordAuthFailure(env, ip) {
  if (!env.STORE_KV) return;
  const k = await authAttemptsKey(ip);
  const raw = await env.STORE_KV.get(k);
  const count = (raw ? parseInt(raw, 10) : 0) + 1;
  await env.STORE_KV.put(k, String(count), { expirationTtl: AUTH_WINDOW_SECONDS });
}

async function clearAuthFailures(env, ip) {
  if (!env.STORE_KV) return;
  await env.STORE_KV.delete(await authAttemptsKey(ip));
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

  // Determine checkout mode based on items
  const hasSub = items.some(i => i.pricingModel && i.pricingModel !== 'one-time');
  const hasOne = items.some(i => !i.pricingModel || i.pricingModel === 'one-time');

  if (hasSub && hasOne) {
    throw new Error('Cannot mix subscription and one-time items in the same checkout. Please purchase them separately.');
  }

  const mode = hasSub ? 'subscription' : 'payment';

  const lineItems = items.map(item => {
    const priceData = {
      currency: 'usd',
      product_data: { name: item.name },
      unit_amount: String(item.price)
    };

    if (item.pricingModel === 'monthly') {
      priceData.recurring = { interval: 'month' };
    } else if (item.pricingModel === 'yearly') {
      priceData.recurring = { interval: 'year' };
    } else if (item.pricingModel === 'weekly') {
      priceData.recurring = { interval: 'week' };
    } else if (item.pricingModel === 'biweekly') {
      priceData.recurring = { interval: 'week', interval_count: 2 };
      priceData.product_data.name = `${item.name} (Bi-Weekly)`;
    } else if (item.pricingModel === 'custom') {
      priceData.recurring = { interval: 'month' };
      if (item.billingInterval) {
        priceData.product_data.name = `${item.name} (${item.billingInterval})`;
      }
    }

    return {
      price_data: priceData,
      quantity: String(item.quantity)
    };
  });

  const params = {
    mode,
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

const SEED_VERSION = '4';

async function handleGetProducts(env) {
  let products = await getProductList(env);
  // Only (re)seed when the seed VERSION changes — a deliberate deploy-time
  // action. We must NOT re-seed just because a seed product is "missing":
  // that's usually the admin having deleted it on purpose, and re-seeding
  // would resurrect it (and used to overwrite every other product's edits).
  const storedVersion = env.STORE_KV ? await env.STORE_KV.get('seed_version') : null;
  if (env.STORE_KV && storedVersion !== SEED_VERSION) {
    await handleAdminSeedProducts(env);
    await env.STORE_KV.put('seed_version', SEED_VERSION);
    products = await getProductList(env);
  }
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
    if (!isValidEmail(customerEmail)) {
      return jsonResponse({ ok: false, error: 'Please enter a valid email address.' }, 400);
    }

    // Server-side price validation — never trust client prices
    const products = await getProductList(env);
    const validatedItems = [];
    for (const cartItem of data.items) {
      const product = products.find(p => p.id === cartItem.productId && p.active);
      if (!product) return jsonResponse({ ok: false, error: `Product unavailable: ${cartItem.productId}` }, 400);
      const qty = Math.max(1, Math.min(100, parseInt(cartItem.quantity) || 1));
      validatedItems.push({
        productId:       product.id,
        name:            product.name,
        price:           product.price,
        quantity:        qty,
        type:            product.type || 'product',
        pricingModel:    product.pricingModel || 'one-time',
        billingInterval: product.billingInterval || ''
      });
    }

    const total   = validatedItems.reduce((s, i) => s + i.price * i.quantity, 0);
    const orderId = genId('ord');
    const now     = new Date().toISOString();

    // IMPORTANT: create the Stripe session BEFORE writing anything to KV.
    // Previously the order was saved first and Stripe called second, so any
    // Stripe-side failure (bad email format, network hiccup, mixed cart,
    // etc.) left a "pending" order permanently sitting in the admin orders
    // list that had never actually reached Stripe — exactly the mismatch
    // where an order shows up on the site but not in the Stripe dashboard.
    // Now nothing is persisted unless Stripe confirms the session exists.
    const origin  = new URL(request.url).origin;
    const session = await createStripeSession(env, { orderId, items: validatedItems, customerEmail, origin });

    const order = {
      id: orderId,
      stripeSessionId: session.id,
      status: 'pending',
      customer: { name: customerName, email: customerEmail },
      items: validatedItems,
      subtotal: total,
      total,
      createdAt: now,
      paidAt: null
    };

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
  const ip = request.headers.get('cf-connecting-ip') || 'unknown';
  if (await isAuthRateLimited(env, ip)) {
    return jsonResponse({ ok: false, error: 'Too many attempts. Please wait a few minutes and try again.' }, 429);
  }
  const data = await request.json().catch(() => ({}));
  const key  = clean(data.key);
  if (!(await adminKeyMatches(env, key))) {
    await recordAuthFailure(env, ip);
    return jsonResponse({ ok: false, error: 'Invalid credentials' }, 401);
  }
  await clearAuthFailures(env, ip);
  const token = await issueSessionToken(env);
  return jsonResponse({ ok: true, token, expiresIn: SESSION_TTL_SECONDS });
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

  const validPricingModels = ['one-time', 'monthly', 'yearly', 'weekly', 'biweekly', 'custom', 'quote'];
  const pricingModel = validPricingModels.includes(clean(data.pricingModel)) ? clean(data.pricingModel) : 'one-time';

  const product = {
    id:              genId('prod'),
    name:            clean(data.name).slice(0, 120),
    description:     clean(data.description).slice(0, 2000),
    price,
    imageUrl:        clean(data.imageUrl).slice(0, 500),
    type:            clean(data.type) === 'service' ? 'service' : 'product',
    pricingModel,
    billingInterval: pricingModel === 'custom' ? clean(data.billingInterval).slice(0, 60) : '',
    active:          data.active !== false,
    createdAt:       new Date().toISOString(),
    updatedAt:       new Date().toISOString()
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
  const validPM = ['one-time', 'monthly', 'yearly', 'weekly', 'biweekly', 'custom', 'quote'];
  if (data.name           !== undefined) product.name           = clean(data.name).slice(0, 120);
  if (data.description    !== undefined) product.description    = clean(data.description).slice(0, 2000);
  if (data.price          !== undefined) product.price          = Math.round(parseFloat(data.price) * 100);
  if (data.imageUrl       !== undefined) product.imageUrl       = clean(data.imageUrl).slice(0, 500);
  if (data.type           !== undefined) product.type           = clean(data.type) === 'service' ? 'service' : 'product';
  if (data.pricingModel   !== undefined) product.pricingModel   = validPM.includes(clean(data.pricingModel)) ? clean(data.pricingModel) : 'one-time';
  if (data.billingInterval !== undefined) product.billingInterval = product.pricingModel === 'custom' ? clean(data.billingInterval).slice(0, 60) : '';
  if (data.active         !== undefined) product.active         = Boolean(data.active);
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

async function handleAdminReorderProducts(request, env) {
  const data = await request.json().catch(() => null);
  if (!data || !Array.isArray(data.order)) {
    return jsonResponse({ ok: false, error: 'order must be an array of product IDs' }, 400);
  }
  const list = await getProductList(env);
  const byId = new Map(list.map(p => [p.id, p]));
  const seen = new Set();
  const reordered = [];
  for (const id of data.order) {
    const p = byId.get(String(id));
    if (p && !seen.has(p.id)) { reordered.push(p); seen.add(p.id); }
  }
  // Any products not mentioned keep their relative order at the end.
  for (const p of list) {
    if (!seen.has(p.id)) reordered.push(p);
  }
  await saveProductList(env, reordered);
  return jsonResponse({ ok: true, products: reordered });
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
// CONTENT API (articles, featured, socials — editable via /admin/)
// ─────────────────────────────────────────────────────────────────────────────

async function handleGetContent(env, key) {
  if (!env.STORE_KV) return jsonResponse(null);
  const raw = await env.STORE_KV.get(`content:${key}`);
  if (!raw) return jsonResponse(null);
  try { return jsonResponse(JSON.parse(raw)); } catch { return jsonResponse(null); }
}

async function handlePutContent(request, env, key) {
  const data = await request.json().catch(() => null);
  if (data === null) return jsonResponse({ ok: false, error: 'Invalid JSON' }, 400);
  if (!env.STORE_KV) return jsonResponse({ ok: false, error: 'KV not configured' }, 500);
  await env.STORE_KV.put(`content:${key}`, JSON.stringify(data));
  return jsonResponse({ ok: true });
}

async function handleDeleteContent(env, key) {
  if (!env.STORE_KV) return jsonResponse({ ok: false, error: 'KV not configured' }, 500);
  await env.STORE_KV.delete(`content:${key}`);
  return jsonResponse({ ok: true });
}

// ─────────────────────────────────────────────────────────────────────────────
// SITE TEXT OVERLAY (live content editing from /admin/ → "Site Content")
//
// The admin panel saves copy edits to KV under `content:site-text`:
//   {
//     blocks:   { "<key>": "<html>" },            // static HTML tagged with data-bkd-edit="<key>"
//     sections: { "<page>": { "<sectionId>": { label,title,body,buttonText,buttonUrl,media } } }
//   }
// At serve time every HTML page gets:
//   1. [data-bkd-edit] / [data-bkd-edit-src] elements rewritten server-side
//      (no flash of stale content, works without JS, SEO-safe), and
//   2. the full edits object injected as window.BKD_EDITS so site.js can merge
//      section overrides into PAGE_CONFIG before it renders content sections.
// Appending `?bkd_raw=1` skips the overlay — the admin editor uses that to
// read each page's built-in defaults.
// ─────────────────────────────────────────────────────────────────────────────

async function applySiteEdits(response, env, url) {
  try {
    if (!env.STORE_KV || response.status !== 200) return response;
    const ct = response.headers.get('content-type') || '';
    if (!ct.includes('text/html')) return response;
    if (url.searchParams.get('bkd_raw') === '1') return response;

    const raw = await env.STORE_KV.get('content:site-text');
    if (!raw) return response;

    let edits;
    try { edits = JSON.parse(raw); } catch { return response; }
    const blocks = (edits && edits.blocks) || {};
    const sections = (edits && edits.sections) || {};
    if (!Object.keys(blocks).length && !Object.keys(sections).length) return response;

    // </script>-safe JSON for inline injection.
    const payload = JSON.stringify({ blocks, sections }).replace(/</g, '\\u003c');

    return new HTMLRewriter()
      .on('[data-bkd-edit]', {
        element(el) {
          const key = el.getAttribute('data-bkd-edit');
          if (key && blocks[key] != null) el.setInnerContent(String(blocks[key]), { html: true });
        }
      })
      .on('[data-bkd-edit-src]', {
        element(el) {
          const key = el.getAttribute('data-bkd-edit-src');
          if (key && blocks[key] != null) {
            const v = String(blocks[key]);
            if (el.hasAttribute('data-src-webm')) el.setAttribute('data-src-webm', v);
            else el.setAttribute('src', v);
          }
        }
      })
      .on('head', {
        element(el) {
          el.append(`<script>window.BKD_EDITS=${payload}</script>`, { html: true });
        }
      })
      .transform(response);
  } catch (err) {
    console.error('applySiteEdits error:', err?.message);
    return response;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN ROUTER
// ─────────────────────────────────────────────────────────────────────────────

export default {
  async fetch(request, env, ctx) {
    let url        = new URL(request.url);
    let path       = url.pathname;
    const method   = request.method;

    // ── hosting.bkdziti.com ──────────────────────────────────────────────────
    // The hosting subdomain is served by this same Worker: its pages live in
    // /hosting/ in this repo, and because it's the same Worker it shares the
    // KV-backed content API — so the "Hosted Sites" list edited in /admin/
    // updates hosting.bkdziti.com within seconds.
    const isHostingHost = url.hostname === 'hosting.bkdziti.com';
    if (isHostingHost && path !== '/hosting' && !path.startsWith('/hosting/') && !path.startsWith('/api/') && !path.startsWith('/assets/')) {
      url.pathname = '/hosting' + (path === '/' ? '/' : path);
      path = url.pathname;
      request = new Request(url.toString(), request);
    }
    // On the main domain, /hosting/* lives on the subdomain (301). Done here
    // instead of _redirects so the rule can be hostname-aware — a static
    // _redirects rule would loop forever on the subdomain itself.
    if (!isHostingHost && (path === '/hosting' || path.startsWith('/hosting/')) && method === 'GET') {
      const rest = path.replace(/^\/hosting\/?/, '/');
      return Response.redirect('https://hosting.bkdziti.com' + rest + url.search, 301);
    }

    // ── Contact ──────────────────────────────────────────────────────────────
    if (method === 'POST' && path === '/api/contact') return handleContact(request, env);

    // ── Store: Public ─────────────────────────────────────────────────────────
    if (path === '/api/store/products'   && method === 'GET')  return handleGetProducts(env);
    if (path === '/api/store/checkout'   && method === 'POST') return handleCreateCheckout(request, env);
    if (path === '/api/store/quote'      && method === 'POST') return handleQuoteRequest(request, env);
    if (path === '/api/store/verify-session' && method === 'GET') return handleVerifySession(env, request);
    if (path === '/api/store/customer-orders' && method === 'GET') return handleGetCustomerOrders(env, request);
    if (path === '/api/store/stripe-webhook' && method === 'POST') return handleStripeWebhook(request, env);

    if (path.startsWith('/api/store/products/') && path.endsWith('/reviews')) {
      const productId = path.slice('/api/store/products/'.length, path.length - '/reviews'.length);
      if (method === 'GET')  return handleGetReviews(env, productId);
      if (method === 'POST') return handleSubmitReview(request, env, productId);
    }
    if (path.startsWith('/api/store/products/') && method === 'GET') {
      return handleGetProduct(env, path.slice('/api/store/products/'.length));
    }
    if (path.startsWith('/api/store/orders/') && method === 'GET') {
      return handleGetOrder(env, path.slice('/api/store/orders/'.length), request);
    }

    // ── Store: Admin ──────────────────────────────────────────────────────────
    if (path.startsWith('/api/store/admin/')) {
      if (path === '/api/store/admin/auth' && method === 'POST') return handleAdminAuth(request, env);

      if (!(await isAdmin(request, env))) return jsonResponse({ ok: false, error: 'Unauthorized' }, 401);

      if (path === '/api/store/admin/seed' && method === 'POST') return handleAdminSeedProducts(env);
      if (path === '/api/store/admin/products') {
        if (method === 'GET')  return handleAdminGetProducts(env);
        if (method === 'POST') return handleAdminCreateProduct(request, env);
      }
      if (path === '/api/store/admin/products/reorder' && method === 'POST') {
        return handleAdminReorderProducts(request, env);
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

    // ── Content API (articles / featured / socials / resources / calls) ─────
    if (path.startsWith('/api/content/')) {
      const key = path.slice('/api/content/'.length);
      if (['articles', 'featured', 'socials', 'resources', 'calls', 'hosted-sites', 'site-text'].includes(key)) {
        if (method === 'GET') {
          // Public reads are CORS-open so any BKDziti property (e.g. the
          // hosting subdomain) can consume the same content API.
          const resp = await handleGetContent(env, key);
          const headers = new Headers(resp.headers);
          headers.set('access-control-allow-origin', '*');
          return new Response(resp.body, { status: resp.status, headers });
        }
        if (!(await isAdmin(request, env))) return jsonResponse({ ok: false, error: 'Unauthorized' }, 401);
        if (method === 'PUT')    return handlePutContent(request, env, key);
        if (method === 'DELETE') return handleDeleteContent(env, key);
      }
    }

    // ── R2 media assets ───────────────────────────────────────────────────────
    // Intercept /assets/images/* and serve from R2 bucket (key = bare filename).
    // Falls through to static assets if the key isn't in R2 yet.
    if (path.startsWith('/assets/images/') && env.MEDIA) {
      const key = decodeURIComponent(path.slice('/assets/images/'.length));
      if (key) {
        const object = await env.MEDIA.get(key);
        if (object) {
          const headers = new Headers();
          object.writeHttpMetadata(headers);
          headers.set('cache-control', 'public, max-age=31536000, immutable');
          if (!headers.has('content-type')) {
            const ext = (key.split('.').pop() || '').toLowerCase();
            const mime = {
              webm: 'video/webm', mp4: 'video/mp4',
              jpg: 'image/jpeg', jpeg: 'image/jpeg',
              png: 'image/png', svg: 'image/svg+xml',
              gif: 'image/gif', ico: 'image/x-icon',
              pdf: 'application/pdf', heic: 'image/heic',
              webmanifest: 'application/manifest+json',
            };
            if (mime[ext]) headers.set('content-type', mime[ext]);
          }
          const ifNoneMatch = request.headers.get('if-none-match');
          if (ifNoneMatch && ifNoneMatch === object.httpEtag) {
            return new Response(null, { status: 304, headers });
          }
          return new Response(object.body, { headers });
        }
      }
    }

    // ── Static assets ─────────────────────────────────────────────────────────
    let assetResponse = await env.ASSETS.fetch(request);
    if (method === 'GET') assetResponse = await applySiteEdits(assetResponse, env, url);

    // The admin surface must never be cached or stored in the browser's
    // back/forward cache — otherwise "Back" restores the logged-in page
    // (and stale HTML/CSS) without re-running the auth check. no-store forces
    // a fresh load + token re-validation every time it's viewed.
    const isAdminSurface = path === '/admin' || path.startsWith('/admin/') ||
                           path === '/store/admin' || path.startsWith('/store/admin/');
    if (isAdminSurface) {
      assetResponse = new Response(assetResponse.body, assetResponse);
      assetResponse.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
      assetResponse.headers.set('Pragma', 'no-cache');
    }

    // Branded 404 page instead of the bare Cloudflare default.
    if (assetResponse.status === 404 && (method === 'GET' || method === 'HEAD')) {
      const notFoundRequest = new Request(new URL('/404.html', url).toString(), request);
      const notFoundResponse = await env.ASSETS.fetch(notFoundRequest);
      if (notFoundResponse.status !== 404) {
        return withSecurityHeaders(new Response(notFoundResponse.body, {
          status: 404,
          headers: notFoundResponse.headers
        }));
      }
    }

    return withSecurityHeaders(assetResponse);
  }
};

