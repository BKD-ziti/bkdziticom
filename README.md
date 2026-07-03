# bkdziti.com

The source for BKDziti's site — a Cloudflare Worker serving a static HTML/CSS/JS site, backed by KV (store data) and R2 (media). All request routing, the contact form, the store API, and the admin/content system live in a single file: **`_worker.js`**.

## Stack

- **Static site** — plain HTML/CSS/JS, no build step, no framework.
- **`_worker.js`** — the Cloudflare Worker entry point (set as `main` in `wrangler.jsonc`). Handles the contact form, the full store API, the content/admin API, R2 media passthrough, and a branded 404 — then falls through to static assets for everything else.
- **`STORE_KV`** (KV namespace) — products, orders, reviews, and admin-editable content (articles, socials, featured posts, resources, hosted-sites list).
- **`MEDIA`** (R2 bucket, `bkdziti-assets`) — all files under `assets/images/` (images, video, PDFs) are served from R2, not bundled as static assets (see `.assetsignore`).

## Deploy

Bindings (KV namespace ID, R2 bucket name) live in `wrangler.jsonc` — that file is the source of truth for how this Worker is provisioned.

**Manual deploy (Wrangler CLI):**
```
npm i -g wrangler
wrangler login
wrangler deploy
```

**Git-based deploy:** if this repo is connected to Cloudflare via Workers Builds (Workers & Pages → connect repo), Cloudflare will read `wrangler.jsonc` directly and auto-deploy on push to `main`. No separate build command is needed — it's a static site plus one Worker file.

Static-asset routing (`/consulting/` → `/consulting/index.html`, legacy redirects, etc.) is handled by the `_redirects` file at the repo root, same convention as Cloudflare Pages.

## Environment variables

Set these in the Cloudflare dashboard (Workers → Settings → Variables) or a local `.dev.vars` file for `wrangler dev`:

| Variable | Used for |
|---|---|
| `RESEND_API_KEY` | Sending contact-form and store quote-request emails via [Resend](https://resend.com) |
| `RESEND_FROM` | *(optional)* Override the "from" address — defaults to `contact@bkdziti.com` |
| `CONTACT_TO` | *(optional)* Where contact-form submissions land — defaults to `AlexZornes@BKDziti.com` |
| `STRIPE_SECRET_KEY` | Creating Stripe Checkout sessions for store purchases |
| `STRIPE_WEBHOOK_SECRET` | Verifying incoming Stripe webhook signatures (order fulfillment) |
| `ADMIN_KEY` | Bearer-token password gating `/admin/` and all `/api/store/admin/*` + `/api/content/*` write routes |

If `RESEND_API_KEY` isn't set, the contact form fails gracefully and tells visitors to text or email directly instead.

> The contact form used to send SMS via Twilio — that's no longer accurate. It sends email via Resend now (see `handleContact` in `_worker.js`).

## Site structure

```
index.html              Homepage
services.html           Full service list + pricing
consulting.html         Consulting/strategy engagement page (renamed from food-consulting.html)
media-production.html   Videography & photography
portfolio.html          Case studies
faq.html                FAQ
contact.html            Contact form
privacy-policy.html     Legal
terms-of-service.html   Legal
secret.html             Resume/cover letter (noindex — not part of the public site nav story)
404.html                Branded 404

articles/                Articles hub + 6 individual guides
store/                   Storefront, cart, checkout, order confirmation, order lookup
store/admin/              Redirects to /admin/ (the old store-only panel was consolidated)
admin/                   Full admin panel — products, orders, articles, socials, featured posts, resources, hosted-sites registry

hosting/                 Legacy local copy of the free-hosting landing page — superseded by the
                         hosting.bkdziti.com subdomain; /hosting/* now 301s there via _redirects,
                         so these local files are no longer reachable on the live domain.
```

`assets/js/data.js` is the single source of truth for the nav menu and social links — edit it once, it propagates everywhere via `PAGE_CONFIG`/`site.js`.

## Editing site content (no code required)

Nearly all copy on the site can be edited from **/admin/ → Site Content**, from any device:

- **Static text** (heroes, homepage sections, pricing) is tagged in the HTML with `data-bkd-edit="key"`. The Worker rewrites those elements at serve time from KV (`content:site-text`) — SEO-safe, no flash of old content. To make a new element editable, add `data-bkd-edit="unique.key"` (and an optional human-friendly `data-bkd-label`) and it appears in the admin automatically.
- **Content sections** (every page that renders from `PAGE_CONFIG.sections`) are editable per-field (label, title, body, button, media). Overrides are merged client-side by `site.js` from the injected `window.BKD_EDITS`.
- Only fields that differ from the code defaults are stored — clear a field back to its original text and the page returns to what's in the repo. `?bkd_raw=1` on any URL shows the page without overrides.
- Article cards on /articles/ are managed in the **Articles** panel; products and prices in the store are managed in **Products**.

The code in this repo stays the source of truth for design and default copy; KV holds only the deltas.


## Redirects

`_redirects` (root) handles legacy URLs:
- `/food-consulting[.html]` → `/consulting[.html]` — from the 2026 rebrand away from food-only positioning.
- `/blog/*` → `/articles/*` — from an earlier blog → articles rename.
- `/hosting[/*]` → `https://hosting.bkdziti.com` — hosting now lives on its own subdomain/project.
