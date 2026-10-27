# Medha Program Management (MPM) — Setup

A clean standalone website for Medha's program data, connected to your Google Sheet.

## Security & headers

The site ships with two files that Cloudflare Pages and Netlify read automatically:

| File | What it does |
|---|---|
| `_headers` | A strict Content-Security-Policy plus `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` and `Cross-Origin-Opener-Policy` on every page. |
| `_redirects` | Any address opens the portal itself. |

Both hosting providers apply them with no extra setup, and both serve the site over HTTPS with a
valid certificate. The static files are served free and unlimited.

## The Gmail permission (for the Mail portal Inbox)

The Inbox reads the real Gmail of the account that owns the script. That needs one extra step:

1. **Project Settings** (gear) → tick **Show "appsscript.json" manifest file in editor** → open it
2. Replace its content with `backend/appsscript.json` from this folder (it lists the Gmail, Sheets and Drive scopes) → save
3. In the editor pick the function **`setupGmail`** → **Run** → approve the Gmail permission
4. **Deploy → Manage deployments →** edit → **Version: New version** → **Deploy** (the URL stays the same)

Without this the Inbox cannot read Gmail and the portal says so plainly instead of showing made-up mails.

## What's in the box

```
mpm-site/
├── index.html              ← main site
├── assets/
│   ├── styles.css          ← design
│   ├── api.js              ← read-only Google Sheets fetcher
│   ├── app.js              ← main app logic
│   └── icons.js            ← inline SVG icons
├── backend/
│   └── Code.gs             ← Apps Script backend (paste into script.google.com)
└── docs/
    └── SETUP.md            ← you are here
```

## Architecture: Sheet-first, Site-augments

**The Google Sheet is the source of truth.** The MPM site is a thin UI layer on top.

- The site reads every member/status from the sheet (live).
- Every action the site takes (mail send, status change, setting toggle) **writes back to the sheet**.
- If the site is offline, broken, or you're on a different device — open the sheet directly and do the work there. When you come back, hit ↻ Refresh on Members page and it'll catch up.

This means **no site-only data, no hidden state**. The sheet is canonical.

## Settings menu (the `…` button)

The `…` button at the bottom of the sidebar opens the settings menu — and it is **password protected** so nobody else can change anything by accident.

### Password Vault

Clicking `…` opens a **combination-lock vault**: a brushed-metal door with a draggable SVG-tooth dial.

- **Turn the dial** — drag the wheel to change the highlighted digit (one step = ±1)
- **Click a block** — pick which of the four digits you are turning
- **Or just type** — the masked field stays in sync with the dial
- **Unlock** — the right combination swings the door open with a light sweep; a wrong one shakes, flashes red and scrambles the wheels

**Default combination: `2026`** — change it in `assets/api.js`:

```js
SETTINGS_PASSWORD: "2026",
```

(or from the browser console: `Api.setConfig({ ...Api.getConfig(), settingsPassword: "your-new-pass" })`)

Once unlocked, the menu holds:

- **SHEET SYNC** — live sync toggle and status
- **Form settings** — the Form Control panel (below)
- **Connect backend** — Apps Script Web App URL. This is the only place the backend is connected from; the Mail portal's own backend card was removed so there is a single, unambiguous entry point.
- **Remove Files / Show Files** — hides the Files page from the sidebar (the page itself keeps working, and you can bring it back from this same menu, or with the **Undo** button on the message that appears).
- **FILES** — every file you added on the Files page is listed here. Press the **×** next to one to remove it from Files. You get **10 seconds** to press **Undo**; if you do nothing, the file is really deleted (from Google Drive too, when the backend is connected).

The menu stays open while you use anything it opens — close the window and the menu is still there,
so the vault code is not asked again. The small dot next to **Export** shows the connection state:
green = backend live, amber = read-only. Click it to open the backend settings.
- **Sign out**

## Form Control — control any Google / HTML form

`… → Form settings` opens the Form Control panel. It manages a **registry of forms** — as many as you like, each with its own open/close state. The registry lives in the **`Settings`** tab of the Medha Program sheet, so every team member sees the same state.

Per form you control:

| Field | What it does |
|---|---|
| **Form name** | Label shown in the dropdown |
| **Form type** | `Google Form` · `HTML form / web page` · `Custom embed URL` |
| **Form link** | The Google Form URL, page URL or embed URL |
| **Response status** | `Open` / `Close` buttons + a toggle (ON/OFF) |
| **Open from** | Optional — the form stays closed until this moment |
| **Close at / Deadline** | Optional — the form closes itself after this moment |
| **Closed message (Bangla / English)** | What people see when the form is closed (emoji OK) |
| **Viewer preview** | Live preview of the closed state, plus a *Live status* line |
| **+ Add form** | Create another form entry (Application Form, Feedback Form, …) |
| **Save / Reload / Delete** | Write to the sheet, re-read it, or remove the form |

Storage keys in the `Settings` sheet:

```
FORM_APP_NAME | FORM_APP_TYPE | FORM_APP_LINK | FORM_APP_OPEN
FORM_APP_OPEN_FROM | FORM_APP_DEADLINE | FORM_APP_MSG_BN | FORM_APP_MSG_EN
```

Backend actions: `getFormSettings` · `saveFormSettings` · `deleteFormSettings` · `getFormState`.

## Payments admin (embedded)

`otanextchapter.online/admin` (the Medha 60-Day admin console) is linked from the portal's **Payments admin** page.

- **Open in this tab** — the console opens in the same browser tab; use the browser Back button to return to MPM.
- **Try inline** — embeds it inside the page if the console allows framing.
- The admin ID and password live in **one** place on the launcher card: edit them there and press **Save credentials** — they are stored on the device in `localStorage` under `mpm.payadmin.cred`.

Sign in once and the browser keeps you signed in.

---

## Medha Support (embedded)

The portal has a **Support** page (sidebar) that brings the Medha Support desk (`app.medha.pro/ops/support`) inside MPM.

| Layer | What it does |
|---|---|
| **Embedded frame** | The support portal renders in a full-height panel. If the app allows framing you work on it right there. |
| **Auto-detect** | If the app sends `X-Frame-Options` / `frame-ancestors`, the page detects it and swaps in a clean "opens in its own tab" panel instead of showing a broken frame. |
| **Credential helper** | Email + password are stored on the device with one-click **Copy** buttons, so logging in takes two clicks. |
| **Session** | Sign in once — the browser keeps you signed in, and the panel opens straight to your desk afterwards. |
| **Backend proxy** | With the Apps Script backend connected, MPM can call `app.medha.pro` server-side (with your session) — `supportLogin` · `supportRequest` · `supportDiscover` · `supportStatus`. |

### Finding the support API (one-time)

The support app's internal API shape isn't known ahead of time, so the backend discovers it automatically:

1. Deploy the backend and connect it in MPM.
2. On the Support page, press **Save & connect** — this calls `supportConnect()`, which:
   - tries every likely login endpoint (`/api/auth/login`, `/api/login`, `/api/session`, …) until one works
   - then tries every likely ticket endpoint (`/api/ops/support/tickets`, `/api/tickets`, `/api/support`, …)
   - stores both working paths and returns the tickets
3. The **Ticket list** tab then shows a native MPM-style ticket table — searchable, status-filterable, no new tab needed.

If it can't find the endpoints, run **`supportDiscover()`** then **`supportDiscoverTickets()`** once in the Apps Script editor and read the return value — it lists every path it tried with the status code and a response sample, so the right one is obvious.

`supportRequest({ path, method, body })` is a generic authenticated proxy, so once the paths are known the MPM UI can read *and write* support data (open a ticket, reply, change status) without leaving the portal.

### Security note

The support credentials are stored in plain text (device `localStorage`, and Apps Script Script Properties when the backend is connected). Anyone with the source of this page can read them. For a public deployment, prefer one of:

- let the support app handle its own login (sign in once in the frame — no credentials stored here), or
- put Google-auth on the support app and drop the credential card, or
- keep the portal behind a private host / access list.

---

## Files

The sidebar has a collapsible **Files** bar (bottom, above Sheet Sync). Click it to reveal the two spreadsheet links, or hit **Open file manager** to jump to the full Files page.

The **Files** page has two sections:

- **Spreadsheets** — the Medha Program sheet and the NCM Part 1 sheet, always one click away
- **Documents** — your own uploads and links, each with open / rename / edit-link / delete

| Action | Without backend | With backend |
|---|---|---|
| Upload a file | stored in the browser (`localStorage`) | uploaded to the **`MPM Files`** Google Drive folder |
| Add a link | stored in the browser | stored in the portal's file index |
| Rename / edit link | works | works |
| Delete | works | Drive file is moved to trash |

Backend actions: `listFiles` · `addFile` · `uploadFile` · `updateFile` · `deleteFile`.

---

## Login gate

The portal opens with a sign-in screen (Medha logo, user name, password).

| User name | Password | Display name |
|---|---|---|
| `admin` | `medha2026` | Medha Admin |
| `ota` | `ota2026` | OTA Team |

**Change them in one place** → `assets/login.js`, the `AUTH_USERS` array at the top:

```js
const AUTH_USERS = [
  { username: "yourname", password: "yourpass", name: "Your Name" },
];
```

To switch the gate off entirely, set `const AUTH_USERS = null;` — the portal then opens straight into the dashboard.

The session is stored in `sessionStorage` + `localStorage`, so a signed-in browser skips the screen on the next visit. **Sign out** is under the `…` menu at the bottom of the sidebar.

> Note: this is a front-door gate, not server-side auth. The credentials are visible in the page source. If you need real protection, put the Apps Script backend behind Google auth (deploy the Web App with *Who has access: Anyone with a Google account*) and validate the session there.

---

## Two sheets, one site

The portal reads from **two** Google Sheets. Both links are pinned in the sidebar.

| Sheet | ID | What it holds |
|---|---|---|
| **Medha Program sheet** | `1f1lPFlXA8tRXtg5GfyetufaUYHYnZPn9AfCHiOwZwII` | `Members NCM-P1` · `Members NCM-P2` · `EmailLog` · `Settings` · `Agreements` |
| **NCM Part 1 sheet** | `1DIcYeYPIascTRDhthEq2fG5kCAtL_-t4_kbu5n-pDmE` | `NCM Master File` · `October/September/August/July Tracker` · refunds · 1-to-1 sessions |

> ### Where NCM PART-2 comes from
> The NCM PART-2 member list is read from the **Medha Batch-01 Master** spreadsheet
> (`1PZ4Ccbec-Qm5m_s4mFya_X24Ykd9HGgw0Mcmfpf9zZw`) — it is also listed on the **Files** page.
> Every tab of that spreadsheet is read and the rows are combined: the **Master File** tab
> supplies the profile details (name, email, course mail, phone, WhatsApp, address, Facebook,
> Medha email, transaction id); the other tabs (`payment check`, `Members Serial`, `Call Data`,
> `Task Data`, `13 Oct Attendance`, …) add whatever they carry. The tab names and the columns are
> found automatically, so the sheet can be reorganised freely.
>
> The Master File has no *Member ID* column, so the two lists are matched on the **email address**
> (then on the name) — that keeps the old member id and mail status while adding the richer
> details. Members that exist only in the old tab are kept, so nothing is ever lost.
>
> Reading it through the **Apps Script backend needs no sharing at all** (it runs as your own
> account). Reading it directly from the browser does need the spreadsheet shared as
> *Anyone with the link → Viewer*; without that the portal falls back to the older
> `Members NCM-P2` tab and shows a note explaining why.
>
> **You only need ONE Apps Script project, even with two Sheets.**
> The backend reaches both sheets with `SpreadsheetApp.openById()`, so the script does not need to be
> attached to either spreadsheet — a standalone project at script.google.com opens both. Paste the
> code once, deploy once, paste one Web App URL into the portal. See `docs/HOSTING.md` (or the
> in-site **Publish & setup** page) for the full walkthrough.
>
> Both IDs are already written into `backend/Code.gs` as the built-in defaults, so setting the
> Script Properties is optional — but it is good practice, and it is step 4 of the guide.

### Members page
The member list is a **join** of both sheets:
- identity + mail status (`Status`, `SentAt`) from the Medha Program sheet
- profile + money (`Phone`, `WhatsApp`, `Plan`, `Tag`, `Team category`, `Amount`, `Payment status`, `Payment date`, `July–Oct_SF`) from the NCM Master File

Click any row → drawer with **Profile** / **Payment** / **Attendance & Scores** tabs. The payment tab is the fallback for the Payments view; the attendance tab is the fallback for Classes & attendance.

### Payments page
Built from the NCM Master File: amount, payment status, payment date, channel, team, plan and the `July_SF → Oct_SF` monthly subscription columns — searchable and filterable, with the same row-click profile drawer.

### Class & attendance page
Renders the NCM monthly tracker grid — the same sheet, the same columns, editable from the site.

| Group | Columns | Type |
|---|---|---|
| Member | SL, Member ID, Name | read-only |
| Class Attendance & Feedback | Class 1, Class 2, Feedback 1, Feedback 2 | `Punctual` / `Late` / `Absent` dropdown |
| Activity & Exam | Workshop Task 1, Workshop Class 1, Exam & Review Class 1 | number |
| Attendance Summary | Punctual Count, Late Count, Absent Count, Attendance %, Remarks | auto (sheet formula) |
| Score Summary (100) | Attendance (10) auto · Assignment (20) · Workshop (20) · Email & Feedback (5) · Monthly Exam (30) · Professional Behaviour (10) · Payment Compliance (5) · Total (100) auto · Grade auto · Result Card auto | mixed |

Month tabs switch between **October / September / August / July Tracker**. Writes go to the exact sheet cell (row + column resolved server-side) and the auto-calculated columns refresh right after.

### Scores & results page

Two steps, and the **result card is fully automatic — there is no template to write**.

1. **Mark the scores** — type the six score columns in the yellow grid. Attendance (10), Total (100), Grade and Remarks recalculate live using the exact formulas the tracker sheet uses. A single click is enough to type: focusing a cell selects what is in it, and Enter jumps to the next row in the same column.
2. **Choose the members** — tick the members you want a card for.

Below the table the **Result card** panel shows the live preview and the export buttons. Every field on the card (name, ID, month, attendance, all six scores, total, grade, percentage, authority remark, rank, date) is pulled straight from the tracker. The authority remark comes from the same grade rule the sheet's `Result Card` column uses, so the card and the sheet always agree.

Output: **Download DOCX** (one card per page, exact NCM format), **Print / Save as PDF**, and — with the backend connected — **Save to Google Docs** and **Email to members**.

---

## Two ways to run

### Mode 1 — Free, read-only (no backend needed)

The site already reads from your public Google Sheet directly:

- Sheet ID is hardcoded: `1f1lPFlXA8tRXtg5GfyetufaUYHYnZPn9AfCHiOwZwII`
- Tabs read: `Members NCM-P1`, `Members NCM-P2`
- Works on any static host (GitHub Pages, Netlify, Vercel, Cloudflare Pages, etc.)

Just open `index.html` in a browser or host it.

### Mode 2 — Full functionality (mail, write, schedule)

Deploy `backend/Code.gs` to Apps Script once, then paste the Web App URL into the site (click `…` next to workspace name → paste URL → Save).

## Backend setup (one-time, ~5 min)

1. Go to <https://script.google.com> → **New project**
2. Replace `Code.gs` with the file from `backend/Code.gs`
3. **Project Settings** (⚙️ icon) → **Script Properties** → **Add** (both):
   - Property: `SHEET_ID` · Value: `1f1lPFlXA8tRXtg5GfyetufaUYHYnZPn9AfCHiOwZwII`
   - Property: `NCM_SHEET_ID` · Value: `1DIcYeYPIascTRDhthEq2fG5kCAtL_-t4_kbu5n-pDmE`
   - Property: `BATCH01_SHEET_ID` · Value: `1PZ4Ccbec-Qm5m_s4mFya_X24Ykd9HGgw0Mcmfpf9zZw`
4. **Project Settings** → **Time zone** → `Asia/Dhaka`
5. Save. In the editor, run **`setupProgramSheets`** from the dropdown — first run will ask for permissions, click **Review permissions → Allow**.
6. **Deploy** → **New deployment**:
   - Type: **Web app**
   - Description: `MPM v1`
   - Execute as: **Me** (your account)
   - Who has access: **Anyone** (or your team if you want auth)
7. Copy the **Web app URL** (looks like `https://script.google.com/macros/s/AKfy.../exec`)
8. Open the MPM site, click `…` next to "Medha workspace" at the bottom-left, paste the URL → **Save & connect**

## What the backend enables (over read-only)
- **Mail portal** — actual Gmail send to recipients
- **Mail badge** — live unread count from inbox
- **Email History** — every send is logged to `EmailLog` tab
- **Form Control** — toggle Application/Feedback forms open/closed, set deadlines & messages
- **Sync from Gmail** — reads Sent folder and updates sheet Status
- **Schedule mail** — programmatic triggers for future sends
- **Class & attendance writes** — mark Punctual/Late/Absent and enter scores straight into the NCM tracker sheet

All write operations go through the Apps Script backend → no CORS issues, no API keys to manage.

## Sheet playbook: do everything from the sheet directly

The site is a luxury, not a dependency. Here's how to do every task from the sheet only.

### 1. Add a new member
1. Open the right tab — `Members NCM-P1` or `Members NCM-P2`
2. Scroll to the first empty row
3. Fill: `SL` (next number), `Member ID` (unique), `Name`, `Email`
4. Leave `Status` empty → defaults to "Not set" on the site (not "Pending" until send triggers)
5. Hit ↻ Refresh on the site → new member appears

### 2. Mark someone as Sent (without using the site)
1. Open the row in the sheet
2. Click the `Status` cell (col E)
3. Pick `Sent` from the dropdown
4. In `SentAt` (col F), type: `21-10-2026 13:55` (current time, Asia/Dhaka)
5. Done. The site's "Recent activity" updates within 30s on refresh.

### 3. Skip / hold a recipient
- `Status = Skip` → excluded from any future send
- `Status = Hold` → excluded + flagged for manual review

### 4. Bulk update (e.g. mark 30 people as Sent after a session)
1. Click row-number header `2` → drag to row `31` (selects all 30 rows)
2. Click `Status` cell on row 2 (single cell to "fill series")
3. Type `Sent` → press `Ctrl+Enter` (Chrome) — fills all selected
4. Add the same timestamp in `SentAt` similarly

### 5. Open or close the Application form
1. Open the `Settings` tab
2. Find the row with key `FORM_OPEN`
3. Change value to `YES` (open) or `NO` (closed)
4. Site reflects within 30s on refresh

### 6. Set a form deadline
1. `Settings` tab → row with key `FORM_DEADLINE`
2. Type: `21-10-2026 23:59` (date + time in `dd-MM-yyyy HH:mm`)
3. Even if `FORM_OPEN=YES`, the form auto-closes at this time

### 7. Edit closed-message (what users see when form is closed)
1. `Settings` tab → rows `CLOSED_MSG_BN` / `CLOSED_MSG_EN`
2. Type any message — emojis ✅
3. Both shown together; user sees their language on top

### 8. Feedback form (if used)
- Same as #5–7 but with `FB_FORM_OPEN`, `FB_FORM_DEADLINE`, etc.

### 9. See who actually got mail
1. Open `EmailLog` tab
2. Sort Timestamp column Z→A
3. Each row: who, what subject, when, status, full body

### 10. Filter / sort in the sheet
- Use the dropdown arrows in row 1 of each tab
- Filter `Status = Sent` to see who got mail
- Filter `Status = Pending` to see who's left
- Sort by `SentAt` desc to see most recent first
- Or `Data → Create a filter` for saved views

### 11. Re-apply dropdowns if rows lost validation
- Sometimes pasted rows lose the data validation dropdown
- Run `setupProgramSheets()` in the Apps Script editor
- It re-applies the dropdown to all rows and rebuilds headers
- Idempotent — safe to run any time

---

**Tip**: Bookmark the sheet — it's the canonical workspace. The site is just a polished view of it.

## The two mail surfaces

### Mail portal (3-column workspace)
Mail portal has **two tabs** at the top: `Inbox` and `Program Mail`.

**Inbox tab** — 3-column workspace:
- **Left rail** — Mail portal header (`N unread • Gmail + Sheet`), `+ Compose` button, box switcher (`Inbox` / `Sent` / `Archive`), and the live **Apps Script config** snippet with webhook status.
- **Middle** — the mail list. Each row: avatar, sender, category tag (`payment` / `agreement` / `support` / `otp`), subject, preview snippet, timestamp, and an unread dot. `Search mails` filters live.
- **Right drawer** — `New mail • via Apps Script`. To (single email *or* a batch group), Subject, body, send-language, batch group. Draft autosaves to `localStorage` (`Draft saved locally • Not persisted`) and `Send via Sheet` posts through the backend.

Clicking **Compose** slides the drawer in; the list column narrows automatically.

**Sent box = Email History.** Clicking `Sent` in the left rail swaps the middle column to the full log view:
- Sticky toolbar: `🔄 Refresh Logs`, `📥 Sync from Gmail`, live `Portal quota left: N · Est. free: … · Checked: …`, and the note *প্রতিটি লগে প্রাপকের সব ইমেইল ঠিকানা দেখা যাবে*
- One card per send: type (`Gmail Sync: Members NCM-P2`, `Program Mail: NCM PART-1`), source tag (`Gmail` / `Portal`), subject, `To: <email> · <count> · <status>`, and a timestamp
- The purple ▾ button expands the card to show **Subject**, **Recipients (n)** with every address, **Status / Source**, **Time**, **Mail body (as sent)** (rendered HTML, loaded live from the Gmail Sent folder when the body wasn't stored at send time), and **Notes**
- Every send is appended to the `EmailLog` sheet, so the history survives even if the site is gone

### Program Mail tab
Carries the whole legacy workflow:

- Gradient hero + program selector (`NCM PART-1` / `NCM PART-2` / `Others`)
- Live stats: **Total · To Send · Not Decided · Quota Left**
- Actions: `↻ Refresh`, `✓ Select all → To Send`, `All → Not Decided`, `📥 Sync from Gmail`, `⏱ Auto sync 10 min`
- Filter row: status filter, sent-from / sent-to date range, name / email / ID search
- **Compose** card: Subject + `✨ AI Subject`, `✨ Improve body` / `📝 Fix spelling` / `💎 Polish` / `🔑 Test API key`, side-by-side **Bangla & English editors** with a full formatting toolbar (bold / italic / underline / lists / colour / font / size), `⇄ Translate` between the two, `Send body language` switch, common attachment + per-member folder attachment, auto-note checkbox, banner/footer options
- Send row: `👁 Preview`, `💾 Save Draft`, `📂 Load Draft`, `🧪 Test Send`, `Send to "To Send" list`, `⏹ Stop`, plus a live progress bar
- `⏰ Schedule` + `View schedules`, watcher last-check line, **Last sent** summary
- Members table with a **Decision** dropdown (`Not Decided` / `To Send` / `Sent` / `Skip` / `Hold`). Rows marked `To Send` turn green so you can see the send list at a glance.

### Sheet fallback for both
Program Mail's Decision state maps straight onto the sheet's `Status` column, so the send list survives even if the site is down — mark `To Send` by hand in the sheet (`Status` dropdown), then send once the site is back. The `EmailLog` sheet is the durable copy of the mail history.

---

## Sheet structure (current)

`Members NCM-P1` / `Members NCM-P2` — same columns:

| Col | Field | Editable | Notes |
|---|---|---|---|
| A | SL | yes | Just a counter (1, 2, 3…) |
| B | Member ID | yes | Must be **unique**. Format like `NCM-01`, `NCM-P2-01` |
| C | Name | yes | Full name, any string |
| D | Email | yes | Must include `@` — invalid rows hidden from the site |
| E | Status | dropdown | `Pending` / `Sent` / `Skip` / `Hold` |
| F | SentAt | yes | When mail was delivered, format `dd-MM-yyyy HH:mm:ss` |

`EmailLog` (auto-created):
| Timestamp | Type | Recipients Count | Recipients | Subject | Status | Sent By | Notes | Body |

`Settings` (auto-created on first save):
| Key | Value |
| FORM_OPEN | `YES` / `NO` |
| FORM_DEADLINE | e.g. `21-10-2026 23:59` |
| FORM_OPEN_FROM | e.g. `20-10-2026 09:00` |
| CLOSED_MSG_BN | Bengali message shown when form closed |
| CLOSED_MSG_EN | English message shown when form closed |
| (same keys with `FB_` prefix for Feedback form) |

`Members NCM-P1` example data:
- `1` · `NCM-101 (Example)` · `Md Sahabul Alam` · `sahabulota@gmail.com` · `Sent` · `2026-10-19 14:44:08`
- `2` · `NCM-01` · `Israt Jahan` · `isratjahan348065@gmail.com`
- ...

`Members NCM-P2` example data:
- `1` · `NCM-P2-010101 (Example)` · `Md Sahabul Alam` · `sahabulota@gmail.com` · `Sent`
- `2` · `NCM-P2-01` · `Sohel Razzak` · `to.rubai@gmail.com` · `Sent`
- ...

The site filters out rows where `Member ID` contains "example" so the demo row doesn't pollute the real list.

## Deploy the static site

Three free options:

### GitHub Pages
```bash
cd mpm-site
git init && git add . && git commit -m "MPM v1"
# create empty repo on GitHub, then:
git remote add origin https://github.com/<you>/medha-mpm.git
git push -u origin main
# Settings → Pages → Source: main → / (root)
```

### Netlify (drag & drop)
1. Visit <https://app.netlify.com/drop>
2. Drag the `mpm-site` folder
3. Done — live URL in seconds

### Vercel
```bash
npm i -g vercel
cd mpm-site && vercel --yes
```

## Customizing

- **Logo / name**: edit `<div class="logo">` in `index.html`
- **Colors**: edit `:root { --primary: ... }` in `assets/styles.css`
- **Sheet ID**: change `SHEET_ID` / `NCM_SHEET_ID` constants in `assets/api.js`
- **Tab names**: change `SHEET_TABS` array in `assets/api.js`
- **Views**: edit the `VIEWS` map at the top of `assets/app.js`

## CORS note

The site uses JSONP (`<script>` injection) to read Google Sheets cross-origin — no CORS proxy needed, no API keys, fully free. For full functionality, the Apps Script backend proxies Gmail/Sheets writes and reads.

## License

MIT — use freely within Online Tech Academy / Medha.