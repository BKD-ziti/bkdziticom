# BKDziti Deployment Checklist

Complete all steps below before pushing to production. Everything must be tested locally first.

---

## Required Environment Variables

Set these in **Cloudflare Pages → Settings → Environment Variables** (both Production and Preview).

| Variable | Required | Description |
|---|---|---|
| `RESEND_API_KEY` | ✅ | From resend.com dashboard |
| `RESEND_FROM` | optional | Default: `BKDziti <contact@bkdziti.com>` (domain must be verified in Resend) |
| `CONTACT_TO` | optional | Default: `AlexZornes@BKDziti.com` |
| `STRIPE_SECRET_KEY` | ✅ | `sk_live_...` for production, `sk_test_...` for staging |
| `STRIPE_WEBHOOK_SECRET` | ✅ | From Stripe Webhooks dashboard (`whsec_...`) |
| `ADMIN_KEY` | ✅ | Long random string — your admin panel password |

---

## Step 1: Resend (Contact Form + Order Emails)

1. Go to [resend.com](https://resend.com) → create an account
2. **Verify your domain** (bkdziti.com):
   - Resend → Domains → Add Domain → enter `bkdziti.com`
   - Add the provided DNS records (DKIM, SPF, DMARC) to your DNS provider
   - Wait for verification (usually a few minutes)
3. **Create an API key**: Resend → API Keys → Create API Key (full access)
4. Add `RESEND_API_KEY` to Cloudflare environment variables

> **Test:** After deployment, submit the contact form at `/contact.html` and verify email arrives at `AlexZornes@BKDziti.com`.

---

## Step 2: Cloudflare KV Namespace (Store Data)

The store uses Cloudflare KV to persist products and orders.

```bash
# Install wrangler if not already installed
npm install -g wrangler

# Authenticate
wrangler login

# Create production KV namespace
wrangler kv:namespace create "STORE_KV"
# → Copy the id output, paste into wrangler.jsonc as "id"

# Create preview KV namespace (for wrangler dev)
wrangler kv:namespace create "STORE_KV" --preview
# → Copy the preview_id output, paste into wrangler.jsonc as "preview_id"
```

Update `wrangler.jsonc` with the real IDs:
```json
"kv_namespaces": [
  {
    "binding": "STORE_KV",
    "id": "PASTE_REAL_ID_HERE",
    "preview_id": "PASTE_REAL_PREVIEW_ID_HERE"
  }
]
```

---

## Step 2b: Cloudflare R2 (Media Hosting)

Images and videos are served from R2 bucket **`bkdziti-media`**.  
The worker intercepts `/assets/images/*` requests, serves from R2 (with long-cache headers), and falls back to static assets for anything not yet uploaded.

### 2b-1: Create the bucket in the Cloudflare dashboard

1. Go to **dash.cloudflare.com** → your account → **R2 Object Storage**
2. Click **Create bucket**
3. Bucket name: `bkdziti-media`
4. Location: leave as default (auto)
5. Click **Create bucket**

No public URL needed — the worker proxies everything through `bkdziti.com/assets/images/`.

### 2b-2: Link the bucket to your Pages project

The binding is already in `wrangler.jsonc`:
```json
"r2_buckets": [
  { "binding": "MEDIA", "bucket_name": "bkdziti-media" }
]
```

In **Cloudflare Pages → your project → Settings → Functions**:
- Under **R2 bucket bindings**, add binding `MEDIA` → bucket `bkdziti-media`
- Apply to both Production and Preview environments

### 2b-3: Upload all media files

Run from the repo root. Each command uploads one file; the R2 key is just the filename (no path prefix).

```powershell
# Authenticate first (one-time, opens browser)
npx wrangler login

# ── Videos (excluded from static assets — R2 is the only source) ──────────
npx wrangler r2 object put bkdziti-media/Datamosh-Dream.webm   --file "assets/images/Datamosh-Dream.webm"   --content-type video/webm
npx wrangler r2 object put bkdziti-media/Datamosh-Dream1.webm  --file "assets/images/Datamosh-Dream1.webm"  --content-type video/webm
npx wrangler r2 object put bkdziti-media/EatMyBallsAdCompressed.webm --file "assets/images/EatMyBallsAdCompressed.webm" --content-type video/webm
npx wrangler r2 object put bkdziti-media/bkdziti_intro.webm    --file "assets/images/bkdziti_intro.webm"    --content-type video/webm
npx wrangler r2 object put bkdziti-media/food2.webm            --file "assets/images/food2.webm"            --content-type video/webm
npx wrangler r2 object put bkdziti-media/store.webm            --file "assets/images/store.webm"            --content-type video/webm
npx wrangler r2 object put bkdziti-media/store0.webm           --file "assets/images/store0.webm"           --content-type video/webm
npx wrangler r2 object put bkdziti-media/store1.webm           --file "assets/images/store1.webm"           --content-type video/webm
npx wrangler r2 object put bkdziti-media/ziti.webm             --file "assets/images/ziti.webm"             --content-type video/webm
npx wrangler r2 object put bkdziti-media/MP4-converted.webm    --file "assets/images/MP4-converted.webm"    --content-type video/webm

# ── Photos / large images ─────────────────────────────────────────────────
npx wrangler r2 object put bkdziti-media/BKDziti_pfp_2.PNG     --file "assets/images/BKDziti_pfp_2.PNG"     --content-type image/png
npx wrangler r2 object put bkdziti-media/EatMyBalls2.PNG       --file "assets/images/EatMyBalls2.PNG"       --content-type image/png
npx wrangler r2 object put bkdziti-media/IMG_0326.JPG          --file "assets/images/IMG_0326.JPG"          --content-type image/jpeg
npx wrangler r2 object put bkdziti-media/IMG_1123.PNG          --file "assets/images/IMG_1123.PNG"          --content-type image/png
npx wrangler r2 object put bkdziti-media/IMG_2336.JPG          --file "assets/images/IMG_2336.JPG"          --content-type image/jpeg
npx wrangler r2 object put "bkdziti-media/IMG_2339(1).JPG"     --file "assets/images/IMG_2339(1).JPG"       --content-type image/jpeg
npx wrangler r2 object put "bkdziti-media/IMG_2340(1).JPG"     --file "assets/images/IMG_2340(1).JPG"       --content-type image/jpeg
npx wrangler r2 object put bkdziti-media/IMG_2456.JPG          --file "assets/images/IMG_2456.JPG"          --content-type image/jpeg

# ── Other images (also uploaded so R2 serves them with immutable caching) ─
npx wrangler r2 object put bkdziti-media/BKDziti_Logo_Transparent.png --file "assets/images/BKDziti_Logo_Transparent.png" --content-type image/png
npx wrangler r2 object put bkdziti-media/EatMyBalls.png        --file "assets/images/EatMyBalls.png"        --content-type image/png
npx wrangler r2 object put bkdziti-media/IMG_8386-0_downscaled.png --file "assets/images/IMG_8386-0_downscaled.png" --content-type image/png
npx wrangler r2 object put bkdziti-media/IMG_1633.png          --file "assets/images/IMG_1633.png"          --content-type image/png
npx wrangler r2 object put bkdziti-media/image0.jpeg           --file "assets/images/image0.jpeg"           --content-type image/jpeg
npx wrangler r2 object put bkdziti-media/card.png              --file "assets/images/card.png"              --content-type image/png
npx wrangler r2 object put "bkdziti-media/BKDziti Business Card.png" --file "assets/images/BKDziti Business Card.png" --content-type image/png
npx wrangler r2 object put bkdziti-media/BKDzitiBusinessCard.png --file "assets/images/BKDzitiBusinessCard.png" --content-type image/png
npx wrangler r2 object put bkdziti-media/favicon.svg           --file "assets/images/favicon.svg"           --content-type image/svg+xml
npx wrangler r2 object put bkdziti-media/favicon.ico           --file "assets/images/favicon.ico"           --content-type image/x-icon
npx wrangler r2 object put bkdziti-media/favicon-16x16.png     --file "assets/images/favicon-16x16.png"     --content-type image/png
npx wrangler r2 object put bkdziti-media/favicon-32x32.png     --file "assets/images/favicon-32x32.png"     --content-type image/png
npx wrangler r2 object put bkdziti-media/favicon-96x96.png     --file "assets/images/favicon-96x96.png"     --content-type image/png
npx wrangler r2 object put bkdziti-media/favicon-128.png       --file "assets/images/favicon-128.png"       --content-type image/png
npx wrangler r2 object put bkdziti-media/favicon-196x196.png   --file "assets/images/favicon-196x196.png"   --content-type image/png
npx wrangler r2 object put bkdziti-media/apple-touch-icon.png  --file "assets/images/apple-touch-icon.png"  --content-type image/png
npx wrangler r2 object put bkdziti-media/android-chrome-192x192.png --file "assets/images/android-chrome-192x192.png" --content-type image/png
npx wrangler r2 object put bkdziti-media/android-chrome-512x512.png --file "assets/images/android-chrome-512x512.png" --content-type image/png
npx wrangler r2 object put bkdziti-media/web-app-manifest-192x192.png --file "assets/images/web-app-manifest-192x192.png" --content-type image/png
npx wrangler r2 object put bkdziti-media/web-app-manifest-512x512.png --file "assets/images/web-app-manifest-512x512.png" --content-type image/png
npx wrangler r2 object put bkdziti-media/site.webmanifest      --file "assets/images/site.webmanifest"      --content-type application/manifest+json

# ── PDFs ──────────────────────────────────────────────────────────────────
npx wrangler r2 object put bkdziti-media/AZ_resume.pdf         --file "assets/images/AZ_resume.pdf"         --content-type application/pdf
npx wrangler r2 object put "bkdziti-media/Cover Letter Generic Redux.pdf" --file "assets/images/Cover Letter Generic Redux.pdf" --content-type application/pdf
```

### 2b-4: Verify uploads

```powershell
# List all objects in the bucket
npx wrangler r2 object list bkdziti-media
```

You should see all uploaded files. Then deploy the beta branch and open any `/assets/images/` URL — response headers should include `cache-control: public, max-age=31536000, immutable`.

> **Important:** Deploy the beta branch **only after** uploading the videos above. The `.assetsignore` in beta excludes `*.webm` and `*.mp4` from static assets, so those files must be in R2 or they will 404.

---

## Step 3: Stripe (Payment Processing)

1. Go to [dashboard.stripe.com](https://dashboard.stripe.com)
2. **Get secret key**: Developers → API Keys → Secret key (`sk_live_...`)
3. **Create a webhook**:
   - Stripe → Developers → Webhooks → Add endpoint
   - URL: `https://bkdziti.com/api/store/stripe-webhook`
   - Events to listen for: `checkout.session.completed`
   - Copy the **Signing secret** (`whsec_...`)
4. Add to Cloudflare environment variables:
   - `STRIPE_SECRET_KEY` = `sk_live_...`
   - `STRIPE_WEBHOOK_SECRET` = `whsec_...`

> **Test mode first:** Use `sk_test_...` and `whsec_...` from a test webhook. Use Stripe's [test card](https://stripe.com/docs/testing): `4242 4242 4242 4242`, any future date, any CVC.

---

## Step 4: Admin Key

Generate a strong random key:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
Add the output as `ADMIN_KEY` in Cloudflare environment variables.

The admin panel is at `/store/admin/index.html`. Keep this URL private.

---

## Step 5: Local Testing with Wrangler Dev

After setting up KV namespace IDs, test locally with the full Worker:

```bash
# Fill in .dev.vars with real credentials
cp .dev.vars .dev.vars.real  # keep a local copy

# Start wrangler dev (runs the full Worker + KV)
npx wrangler dev

# Site will be at http://localhost:8787
```

### Test Checklist (local)

- [ ] **Contact form**: Submit `/contact.html` → check email arrives
- [ ] **Admin login**: Go to `/store/admin/` → enter ADMIN_KEY → should reach dashboard
- [ ] **Add products**: Create 2-3 test products in admin panel
- [ ] **Store browsing**: Go to `/store/` → products should appear → add to cart
- [ ] **Checkout**: Go to cart → checkout → enter test customer info → click Pay
- [ ] **Stripe test payment**: Use card `4242 4242 4242 4242` → complete payment
- [ ] **Order confirmation**: Should redirect to `/store/confirmation.html` → verify order details
- [ ] **Receipt emails**: Check both customer receipt and admin notification arrived
- [ ] **Order in admin**: Check `/store/admin/` Orders tab → new order should appear
- [ ] **Order lookup**: Go to `/store/orders/` → enter customer email → order appears
- [ ] **Order status update**: In admin, change order status → verify it updates
- [ ] **Responsive layout**: Test store on mobile viewport (375px)

---

## Step 6: Deploy to Production

```bash
# Deploy via Cloudflare Pages (auto from GitHub push)
git add .
git commit -m "Add store and fix contact form"
git push origin main
```

Cloudflare Pages auto-deploys on push to `main`. Monitor the build in the Cloudflare dashboard.

### Post-deploy verification

- [ ] Contact form at `bkdziti.com/contact.html` — submit and verify email
- [ ] Store at `bkdziti.com/store/` — products load correctly
- [ ] Stripe test purchase (use test key first, then switch to live)
- [ ] Order emails arrive (customer receipt + admin notification)
- [ ] Admin panel accessible at `bkdziti.com/store/admin/`

---

## DNS Notes

- The `from` email in Resend must use a verified domain. `contact@bkdziti.com` requires `bkdziti.com` to be verified in Resend.
- Until domain is verified, you can temporarily use `onboarding@resend.dev` as the `RESEND_FROM` value.

---

## File Structure Summary

```
_worker.js                    ← Main Cloudflare Worker (all API routes)
wrangler.jsonc                ← Cloudflare config (add real KV IDs here)
.dev.vars                     ← Local env vars (gitignored — never commit)
store/
  index.html                  ← Public storefront
  cart.html                   ← Shopping cart
  checkout.html               ← Checkout (redirects to Stripe)
  confirmation.html           ← Post-payment confirmation
  orders.html                 ← Customer order lookup
  admin/
    index.html                ← Admin panel (login + product/order management)
assets/
  css/store.css               ← Store styles
  js/store.js                 ← Store frontend JS
  js/store-admin.js           ← Admin panel JS
```

## API Routes (handled by _worker.js)

| Route | Method | Description |
|---|---|---|
| `/api/contact` | POST | Contact form submission |
| `/api/store/products` | GET | List active products |
| `/api/store/products/:id` | GET | Single product |
| `/api/store/checkout` | POST | Create Stripe checkout session |
| `/api/store/verify-session` | GET | Verify Stripe session after payment |
| `/api/store/orders/:id` | GET | Get order (requires ?email=) |
| `/api/store/customer-orders` | GET | Customer's orders by email |
| `/api/store/stripe-webhook` | POST | Stripe payment webhook |
| `/api/store/admin/auth` | POST | Admin login |
| `/api/store/admin/products` | GET/POST | List / create products |
| `/api/store/admin/products/:id` | PUT/DELETE | Update / delete product |
| `/api/store/admin/orders` | GET | List all orders |
| `/api/store/admin/orders/:id` | GET/PUT | View / update order status |
