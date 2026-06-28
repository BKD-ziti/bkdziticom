# BKDziti Admin Control Center

This is the unified admin panel for managing both the store and sales prospects.

## Structure

- **index.html** — Main admin panel with authentication and section switching
- **admin-unified.js** — JavaScript for authentication, navigation, and section management
- **prospects.html** — Embedded prospects tracker interface

## Features

### Single Login
- One password for all admin sections
- Session management via `sessionStorage`
- Same authentication endpoint: `/api/prospects/auth`

### Store Management
- **Products Tab**: Add, edit, delete products with full customization
- **Orders Tab**: View and manage customer orders

### Prospects Tracker
- Track sales prospects across all stages
- Log calls and interactions
- Analyze conversion metrics
- Export data to PDF/CSV
- Email template generator

## Accessing Admin

- **Main URL**: `/admin/`
- **Store Only**: (Old URL `/store/admin/` redirects to `/admin/`)
- **Prospects Only**: (Old URL `/prospects/` redirects to `/admin/`)

All access routes to the admin panel now redirect to the unified control center at `/admin/`.

## Authentication

The admin panel uses the same authentication endpoint as the original prospects tracker:
- Endpoint: `/api/prospects/auth`
- Method: POST
- Payload: `{ key: "admin-password" }`
- Response: `{ ok: true, token: "..." }`

Both the store and prospects sections share the same password.

## Features Per Section

### Store Section
- Product management (CRUD operations)
- Pricing models (one-time, subscription, custom)
- Order tracking
- Product visibility toggle

### Prospects Section
- Add and manage prospects
- Heat level tracking (1-5 scale)
- Call logging with objections and notes
- Status management (cold, active, contacted, closed)
- Dashboard analytics
- Email template generator
- PDF/CSV export capabilities
- Call history and pipeline analytics
