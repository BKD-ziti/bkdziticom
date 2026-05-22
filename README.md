# bkdziti.com

This repo is a static site (plain HTML/CSS/JS) meant to be deployed on **Cloudflare Pages** via the **GitHub integration**.

## Recommended deploy (GitHub → Cloudflare Pages)

1. Cloudflare Dashboard → **Workers & Pages** → **Pages** → **Create a project**
2. Connect your GitHub repo `BKD-ziti/bkdziticom`
3. Build settings:
   - Framework preset: **None**
   - Build command: **(leave empty)**
   - Build output directory: **/**
4. Deploy. Cloudflare will auto-deploy on every push to `main`.

## Optional: deploy from your machine (Wrangler CLI)

If you prefer pushing a build manually:

1. Install Wrangler (Node.js required)
   - `npm i -g wrangler`
2. Authenticate
   - `wrangler login`
3. Deploy the current directory
   - `wrangler pages deploy .`

If you see issues during deploy, prefer the GitHub integration above (it does not require Wrangler locally).

## Contact form → SMS (Cloudflare Pages Functions + Twilio)

This repo includes a Cloudflare Pages Function at `POST /api/contact` that can forward form submissions to your work phone via Twilio.

### Cloudflare env vars (Pages → Settings → Environment variables)

Set these for **Production** (and Preview if you want it there too):

- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_FROM_NUMBER` (your Twilio number, E.164 format, e.g. `+12345678900`)
- `WORK_PHONE_NUMBER` (your phone, E.164 format)

If those aren’t set, the form will tell users to text/email instead.
