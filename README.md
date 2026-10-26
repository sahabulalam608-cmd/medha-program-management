# Medha Program Management (MPM)

Standalone website for Medha's program data, connected to Google Sheet.

## Quick start

1. The site is pure static (HTML/CSS/JS) — no build step.
2. Connect the backend: copy `backend/Code.gs` into a new Google Apps Script project, deploy as Web App, paste the `/exec` URL into the site settings (unlock with code `2026`).
3. Host on Cloudflare Pages / Netlify / GitHub Pages.

## Structure

```
├── index.html
├── guide.html
├── sw.js
├── assets/
│   ├── styles.css, mail.css, login.css, ...
│   ├── api.js, app.js, ...
│   ├── img/
│   └── vendor/docx.min.js
├── backend/Code.gs
└── docs/
    ├── SETUP.md
    └── HOSTING.md
```

See `docs/SETUP.md` and `docs/HOSTING.md` for full instructions.

## Cloudflare Pages setup

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com) → Workers & Pages → Create → Pages → Connect to Git
2. Select this repository
3. Production branch: `main`
4. Build command: (leave empty)
5. Build output directory: `/` (or leave empty)
6. Save and Deploy

After the first deploy, every push to `main` will auto-update the site.
