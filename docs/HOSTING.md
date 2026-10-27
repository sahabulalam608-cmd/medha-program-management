# Publish Medha Program Management — free hosting & backend setup

This is the same guide that lives inside the site at `guide.html`.
It covers two things:

1. **Publishing the site** on free static hosting (no build step, no server, no bill).
2. **Connecting the backend** — one Google Apps Script project that reaches both of your Sheets.

---

## The quick path — 3 steps, about 10 minutes

1. **Download and unzip.** Unzip `mpm-site-source.zip`. Open the folder that comes out and make
   sure you can see `index.html` sitting right there, next to an `assets` folder — *not* inside
   another folder. (This is the one thing that goes wrong: if the folder you drop has a
   sub-folder inside it, the site shows a 404.)
2. **Drop it on Cloudflare Pages** *(free, fastest, no card needed)*.
   - Open <https://dash.cloudflare.com> → sign in (a free account is enough).
   - **Workers & Pages** → **Create application** → **Get started** → **Drag and drop your files**.
   - Name the project, for example `medha-program`.
   - Drag the whole folder (or the zip) onto the box.
   - **Deploy site** → you get `https://medha-program.pages.dev`.

   Netlify, Firebase Hosting and GitHub Pages work exactly the same way — see Part 1.
3. **Connect the backend** *(only if you want mail, saving and uploads)*. Copy `backend/Code.gs`
   from the folder → paste into a new project at <https://script.google.com> → deploy it as a
   **Web app** (Execute as **Me**, Who has access **Anyone**) → copy the `/exec` URL → in the portal
   click **…**, dial `2026`, click **Connect backend**, paste the URL, **Save**.

### Security is already set up for you
The folder contains two files that Cloudflare Pages and Netlify read automatically:

| File | What it does |
|---|---|
| `_headers` | Adds a strict Content-Security-Policy, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy` and `X-Content-Type-Options` to every page. Nothing to configure. |
| `_redirects` | Makes any address open the portal itself. |

Your site also runs on HTTPS with a valid certificate out of the box, and the static files are
served free and unlimited from Cloudflare's network.

### Updating it later
Keep the folder on your computer. Cloudflare → your project → **Create a new deployment** → drag
the same folder again → **Save and Deploy**. The address never changes, and the portal picks up
the new code on the next reload (the service worker fetches code from the network first).

One Apps Script project, and it reaches **both** of your Sheets — Part 2 has the details.

---

## Part 1 — Publish the site (free)

The site folder contains `index.html` plus `assets/`, `backend/`, `docs/` and `sw.js`.
It is already built — there is nothing to compile, nothing to install.

> **The one thing people get wrong**
> The folder you drop must have `index.html` sitting **directly inside it**.
> If you drop a folder that contains a sub-folder called `mpm-site`, the site will 404.
> Open the folder and confirm `index.html` is the first thing you see.

### Option A — Cloudflare Pages (recommended — free, fastest, unlimited static traffic)

1. <https://dash.cloudflare.com> → sign in (free account, no card).
2. **Workers & Pages** → **Create application** → **Get started** → **Drag and drop your files**.
3. Project name, for example `medha-program`.
4. Drag the folder (or the zip) onto the box.
5. **Deploy site** → `https://medha-program.pages.dev`.

Free plan: 500 builds a month, 20,000 files per site (drag-and-drop is capped at 1,000 files),
25 MiB per file, 100 custom domains. Static asset requests are free and unlimited.

### Option B — Netlify Drop

1. Unzip `mpm-site-source.zip` on your computer. You get a folder (`mpm-site` or `mpm-site-source`).
2. Go to **https://app.netlify.com/drop**
3. Sign in / sign up with Google (free). You need an account — anonymous drops are temporary and get deleted.
4. Drag the whole folder onto the drop area. Wait ~10 seconds.
5. You get `https://<something>.netlify.app`. Open it — the portal appears.
6. Click the site name in the dashboard → **Change site name** → `medha-program`
   → your address becomes `https://medha-program.netlify.app`.

**Updating later:** keep the folder on your computer. Drag the same folder onto the drop zone again
(from the bottom of your Netlify site page). The new version replaces the old one, same address.

### Option C — Cloudflare Pages through Git (auto-deploy on every push)

1. Put the folder in a Git repository (GitHub or GitLab).
2. **Workers & Pages** → **Create application** → **Connect to Git** → pick the repository.
3. Build command: leave it **empty**. Output directory: **`/`** (or the folder name inside the repo).
4. Every push publishes a new version by itself.

### Option D — Firebase Hosting (same Google account)

1. **https://console.firebase.google.com** → **Add project** (use your existing Google account).
2. **Hosting** → **Get started** → pick the project.
3. `firebase login` then `firebase deploy --only hosting` from the folder, or use the console's manual upload.
4. Your address: `https://<project>.web.app`

Free (Spark) plan: 10 GB storage, 10 GB/month transfer. No credit card needed.

### Option E — GitHub Pages

1. Create a **public** repository and upload the folder's contents.
2. **Settings** → **Pages** → Source: **Deploy from a branch** → `main` / `root` → **Save**.
3. Your address: `https://<you>.github.io/<repo>`

> GitHub's terms say Pages is not meant for sites that mainly handle sensitive transactions
> such as passwords. MPM's login is only a front-door gate and the real work happens in your
> own Google account, but Netlify / Cloudflare / Firebase avoid that grey area.

### Which one?

| Host | Best when | Address |
|---|---|---|
| **Cloudflare Pages** | You want it live in 2 minutes, free and unlimited | `*.pages.dev` |
| **Netlify Drop** | Same thing, different dashboard | `*.netlify.app` |
| **Firebase Hosting** | You want one Google account for everything | `*.web.app` |
| **GitHub Pages** | You already live in GitHub | `*.github.io` |

All four are free. All four serve the site over HTTPS. All four need no build command.

---

## Part 2 — Connect the backend (one Apps Script, both Sheets)

Without the backend the portal still shows every member, every score and every result card —
it is simply **read-only**. With it, mail sending, attendance marking, score saving, agreement
saving, Drive uploads and emailing result cards all switch on.

> **You only need ONE Apps Script project.**
> Your data lives in two separate Google Sheets, but a single Apps Script project reaches both.
> The backend opens each one by its spreadsheet ID, so which sheet the script is attached to
> does not matter. Paste the code once, deploy once, paste one URL into the portal — both sheets work.

### What each sheet is used for

| Spreadsheet | What it holds | ID (already built into the code) |
|---|---|---|
| **Medha Program** | Member lists (`Members NCM-P1`, `Members NCM-P2`), mail log (`EmailLog`), settings, `Agreements` tab | `1f1lPFlXA8tRXtg5GfyetufaUYHYnZPn9AfCHiOwZwII` |
| **NCM Part 1** | Master file + monthly trackers (October / September / August / July) with attendance and scores | `1DIcYeYPIascTRDhthEq2fG5kCAtL_-t4_kbu5n-pDmE` |

There is a third spreadsheet too — **Medha Batch-01 Master**
(`1PZ4Ccbec-Qm5m_s4mFya_X24Ykd9HGgw0Mcmfpf9zZw`) — which holds the **NCM PART-2** member list.
It is listed on the portal's **Files** page.

- **With the backend connected** the portal reads it through Apps Script, using your own Google
  account. No sharing setting is needed — it just works.
- **Without the backend** the portal reads it directly, which does need the spreadsheet shared as
  *Anyone with the link → Viewer*. If it is not shared, the portal keeps using the older
  `Members NCM-P2` tab and says so on the page.

Every tab of that spreadsheet is read and combined: the **Master File** tab supplies the profile
details (name, email, course mail, phone, WhatsApp, address, Facebook, Medha email, transaction
id), and the other tabs — `payment check`, `Members Serial`, `Call Data`, `Task Data`,
`13 Oct Attendance` and the rest — add whatever they carry. Set it as `BATCH01_SHEET_ID` in
Script Properties (step 4).

Both IDs are already written into `backend/Code.gs`, so you do not have to type them anywhere.
You can still set them as Script Properties if you prefer to be explicit.

### The exact steps

1. **Copy the code.** Open `backend/Code.gs` in a text editor, select all (`Ctrl+A`), copy (`Ctrl+C`).
2. **Create ONE project.** Go to **https://script.google.com** → **New project**.
   Do *not* choose "New from spreadsheet" — a standalone project can reach both sheets.
3. **Paste.** Click `Code.gs`, select all, paste. Save (`Ctrl+S`). Rename the project to `Medha Program Backend`.
4. **Check the two IDs.** **Project Settings** (gear) → **Script Properties** → add:
   ```
   SHEET_ID     = 1f1lPFlXA8tRXtg5GfyetufaUYHYnZPn9AfCHiOwZwII
   NCM_SHEET_ID = 1DIcYeYPIascTRDhthEq2fG5kCAtL_-t4_kbu5n-pDmE
   ```
   Set **Time zone** to `Asia/Dhaka`.
5. **Run the one-time setup.** Pick `setupProgramSheets` from the function dropdown → **Run**.
   Approve the permission prompt (*Google hasn't verified this app* → **Advanced** → **Go to (project name)** → **Allow**).
   It creates the `Agreements` tab and the Status dropdown.
6. **Deploy as a web app.** **Deploy** → **New deployment** → gear → **Web app**:
   - Description: `Medha Program Management`
   - Execute as: **Me**
   - Who has access: **Anyone**
7. **Paste the URL into the portal.** Click the **…** button at the bottom of the left sidebar →
   dial the combination `2026` → **Connect backend** → paste the URL (it ends in `/exec`) → **Save**.

The sidebar badge then reads *Backend connected*, and the sheet becomes the single source of truth:
write in the portal and the sheet updates; write in the sheet and the portal updates within 30 seconds.

> **Changing the code later**
> After editing `Code.gs` you must publish a **new deployment version**
> (Deploy → Manage deployments → edit → Version: **New version**). Editing the code alone does not change the live URL.

---

## Part 3 — Where to find things

| I want to… | Where |
|---|---|
| Change a member's score | **Scores & results** → Mark the scores → click the cell and type. Total, Grade and Remarks fill in as you type. |
| Mark attendance | **Classes & attendance** → every attendance cell is a dropdown (Punctual / Late / Absent). |
| Track who signed the agreement | **Agreements** → click the Status cell in a row to set Signed / Pending / Declined. |
| Send program mail | **Mail portal** → **Program Mail** tab. |
| Make result cards | **Scores & results** → mark scores → tick the members → **Download DOCX**. Everything is filled in automatically. |
| See a member's full profile | **Members** → click any row → the drawer shows phone, WhatsApp, address, course mail, Medha login email, Facebook and transaction id. |
| See who paid | **Payments** → one row per member, Part 1 and Part 2 together. Every NCM Part 2 member joined by paying **9,919 taka**, and that is what the row shows. |
| Open the payment console | **Payments admin** — two consoles, each with "Open in this tab" and "New tab". |
| Open the support desk | **Support** — same two buttons. |
| Change a password or the backend | The **…** button at the bottom of the sidebar → dial combination `2026`. |
| Hide the Files page | The same **…** menu → **Sidebar → Remove Files**. To bring it back: press **…**, dial `2026`, choose **Sidebar → Show Files** — or just press **Undo** on the message that appears. |
| Remove a file | The **…** menu → **FILES** section → the **×** next to the file. It leaves the Files page at once, and you have **10 seconds** to press **Undo**. |

---

## Part 4 — Good to know

- **The sheet is the source of truth.** The portal is a fast window onto it.
- **Mobile numbers are shown with the leading 0.** The sheet stores them as plain numbers
  (`1734806516`); the portal displays `01734806516` everywhere — result card, member profile,
  payments table, DOCX and PDF. The sheet value is never altered.

  If you would rather the sheet itself carried the 0, put this in the phone column
  (`=IF(A2="","",IF(LEFT(A2,1)="0",A2,"0"&A2))`) — but then it must be stored as **text**
  so Sheets does not turn `01734806516` back into a number and drop the zero.
- **Scores typed without the backend stay in your browser** as a draft, and can be exported as
  CSV from the same page to paste into the sheet. With the backend connected they save straight to the tracker.
- **Everything stays in your own accounts.** The website is only the front end; the data lives in
  your Google Sheets and your Google Drive.
- **Logins.** Portal admin `admin` / `medha2026`; read-only staff `ota` / `ota2026`;
  settings dial `2026`.
- **After you redeploy**, the portal picks up the new files on the very next reload —
  the service worker fetches code from the network first, so there is no stale version.
