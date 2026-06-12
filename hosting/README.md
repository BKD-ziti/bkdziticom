# BKDziti Free Hosting

Host your website on BKDziti's domain for **free**. No hosting fees, no domain registration required.

## How It Works

1. **No Separate Hosting** — Your website lives on `bkdziti.com/yourname/`
2. **No Domain Costs** — Use a subdirectory instead of purchasing your own domain
3. **Full Control** — Upload custom HTML, CSS, JavaScript, and assets
4. **Professional Infrastructure** — SSL-secured, reliable hosting with uptime monitoring

## Getting Started

### Step 1: Create Your Website Directory
Create a folder in `/hosting/` with your website name (e.g., `/hosting/yourname/`).

### Step 2: Add Your Files
Upload your website files:
```
hosting/
├── yourname/
│   ├── index.html
│   ├── style.css
│   ├── script.js
│   └── assets/
│       ├── images/
│       └── ...
```

### Step 3: Add to Hosted Sites List
Update the hosted sites registry so your site appears on the hosting landing page.

## File Requirements

- **index.html** is required (landing page for your site)
- All other files are optional (CSS, JS, images, etc.)
- Keep file sizes reasonable (all files recommended under 50MB total)
- Use relative paths for internal links

## Examples

### Minimal Site (HTML Only)
```html
<!DOCTYPE html>
<html>
<head>
    <title>My Awesome Site</title>
</head>
<body>
    <h1>Welcome!</h1>
    <p>This is my free hosted website on BKDziti.</p>
</body>
</html>
```

### Modern Site (HTML + CSS + JS)
```
yourname/
├── index.html
├── css/
│   └── style.css
├── js/
│   └── script.js
└── images/
    └── logo.png
```

## Link Structure

- Internal links: Use relative paths
  - Good: `<a href="about.html">About</a>`
  - Good: `<a href="css/style.css">`
  - Bad: `<a href="/hosting/yourname/about.html">`

- Links to BKDziti main site:
  - Good: `<a href="../../index.html">Back to BKDziti</a>`

## Support

For questions or to host your website, contact:
- Email: [admin@bkdziti.com](mailto:admin@bkdziti.com)
- Site: [BKDziti.com](https://www.bkdziti.com)

---

**© 2026 BKDziti LLC** — All Rights Reserved
