# Medha Program Management

Program portal for **Online Tech Academy** — Bangladesh.
A static website that reads and writes the program's Google Sheets.

- **Live site:** `https://medha-program-management.pages.dev`
- **In-site guide:** open the site → sidebar `…` → **Publish & setup**
- **No build step.** Plain HTML, CSS and JavaScript — upload the folder as it is.

## What is in here

| Path | What it is |
|---|---|
| `index.html` | The portal shell (all 14 pages) |
| `guide.html` | The step-by-step guide (hosting + backend) |
| `assets/` | Scripts, styles and images |
| `assets/vendor/docx.min.js` | Used to build the Word result cards |
| `assets/appreciation.js` | The **Appreciation** page — certificate templates, preview, Word export |
| `assets/appreciation-img.js` | The three certificate marks (OTA emblem, Medha logo, signature) as data images |
| `assets/img/ota-emblem.png`, `assets/img/medha-logo-square.jpg`, `assets/img/signature.png` | The same artwork as plain files (fallback) |
| `sw.js` | Service worker — keeps the portal fast and offline-friendly |
| `backend/Code.gs` | The Google Apps Script backend (paste into script.google.com) |
| `docs/HOSTING.md` | How to publish (Cloudflare Pages, Netlify, Firebase, GitHub Pages) |
| `docs/SETUP.md` | How to connect the backend and the three spreadsheets |
| `_headers` | Security headers — Cloudflare Pages and Netlify read this automatically |
| `_redirects` | Sends every address to the portal |

## The Appreciation page

The sidebar item **Appreciation** replaces the old Feedback tab. It makes a
Certificate of Appreciation for the program members:

- pick the members (All / NCM PART-1 / NCM PART-2, search, one certificate each)
- the content is filled in from the member and can be edited
- two built-in templates — *Appreciation 1 — Brand Color* and *Appreciation 2 — Regular*
- **Download DOCX**, **Print / Save as PDF**, **Save to Google Docs**, **Email to members**, **Preview all**
- the file name is the Member ID and nothing else (`NCM-01.docx`)
- every run is written to the Appreciation history; the template library keeps your own files
  (deleting one asks for the master code `2026`)

**Save to Google Docs** needs the backend: re-deploy `backend/Code.gs` (it now
carries the `createAppreciationDocs` action). Without it the button says so
instead of failing silently.

## The three spreadsheets

| Spreadsheet | ID |
|---|---|
| Medha Program | `1f1lPFlXA8tRXtg5GfyetufaUYHYnZPn9AfCHiOwZwII` |
| NCM Part 1 | `1DIcYeYPIascTRDhthEq2fG5kCAtL_-t4_kbu5n-pDmE` |
| Medha Batch-01 Master | `1PZ4Ccbec-Qm5m_s4mFya_X24Ykd9HGgw0Mcmfpf9zZw` |

## Uploading this folder to GitHub

1. Unzip `medha-program-management.zip` — you get a folder with the files inside it.
2. Open the repository on GitHub → **Add file** → **Upload files**.
3. Drag the **contents of that folder** (the files *and* the `assets`, `backend`,
   `docs` folders) into the upload box. `index.html` has to end up directly in the
   repository root, and `assets/img/` has to stay a folder inside `assets`.
4. Write a commit message such as `Update the site` → **Commit changes**.

Cloudflare Pages redeploys by itself — the address stays the same.
Nothing here needs to be changed; upload it exactly as it is.

## Publishing to Cloudflare Pages

1. Push this folder to a Git repository.
2. Cloudflare → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**.
3. Build command: leave empty. Output directory: `/`.
4. The address becomes `https://<project>.pages.dev`.

The `_headers` file is applied automatically, so the site ships with a strict
Content-Security-Policy and the other standard security headers.

## Writing back to the sheets

The site is read-only until the Apps Script backend is connected
(site → `…` → `2026` → **Connect backend**). The backend runs as the sheet
owner, so no sheet needs to be made public.
