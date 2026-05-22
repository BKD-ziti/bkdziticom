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

