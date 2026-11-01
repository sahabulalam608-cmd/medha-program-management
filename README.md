# Medha Program Management

Program portal for **Online Tech Academy** — Bangladesh, rewritten as a modern React + TypeScript application with Vite and Tailwind CSS.

## Features

- **Overview Dashboard:** Real-time cohort KPIs, attendance percentages, fees collected in Bangladeshi Taka (৳), honors distribution (A+/A/B/C/F), and recent activity feeds.
- **Batches & Cohorts:** Multi-batch tracking for NCM Part-1 and NCM Part-2 / Medha Batch-01 Master.
- **Member Directory:** Searchable, filterable student roster with detailed profile drawers (phone, WhatsApp, Medha login email, address, study group, payment status) and 1-click copy.
- **Classes & Attendance Tracker:** Comprehensive session matrix (Class 1, Class 2, Feedback 1 & 2, Workshop Attendance, Workshop Class 1, Exam & Review Class 1) with instant Punctual/Late/Absent status editing and percentage calculation.
- **Scores & Results:** Full 100-mark evaluation matrix (Attendance /10, Assignment /20, Workshop /20, Email /5, Monthly Exam /30, Professional Behavior /10, Payment Compliance /5) with automatic grade calculation and printable official academic Result Cards.
- **Payments & PayAdmin:** bKash and Nagad payment tracking with transaction IDs (TrxID), payment compliance audit, and automated score syncing.
- **Agreements:** Student enrollment NDAs and codes of conduct, signature tracking, and contract previews.
- **Tasks & Workshops:** Deliverables tracking with GitHub repository links and inline submission grading.
- **Feedback:** Student session ratings (1-5 stars), instructional pace indicators, takeaways, and suggestions.
- **Evidence & Reports:** Pass rate analytics, mean scores, top performer honors, and at-risk student intervention rosters.
- **Broadcast Mail Portal:** Mass mailer with presets (Orientation Welcome, Task Announcement, Monthly Result Card, Payment Reminder) and delivery history logs.
- **Files & Resources:** Curriculum PDFs, lecture slides, and cloud recording drive links.
- **Support Desk:** Student ticket management with real-time response threads and priority filters.
- **Security & Google Sheets Sync:** Combination lock dial (master code: `2026`) guarding Google Sheets spreadsheet IDs and Google Apps Script configuration.

## Development

```bash
npm install
npm run dev
```

Build for production:
```bash
npm run build
```

Deploy trigger
