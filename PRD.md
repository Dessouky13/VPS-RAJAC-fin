# Product Requirements Document (PRD)
## RAJAC Language Schools — Finance Management System
**Version:** 2.0
**Date:** 2026-03-19
**Status:** Living Document

---

## 1. Product Overview

The RAJAC Finance System is a full-stack web application that manages student enrollments, fee collection, financial transactions, teacher payments, and analytics for RAJAC Language Schools.

| Layer | Technology | Hosting |
|---|---|---|
| Frontend | React 18 + TypeScript + Vite + Tailwind CSS + shadcn/ui | Vercel |
| Backend | Node.js + Express.js | User-owned VPS (Nginx reverse proxy) |
| Database | PostgreSQL 16 (Docker) | Same VPS |
| Auth | JWT (jsonwebtoken + bcryptjs) | Stateless, 8-hour tokens |

> **v2.0 Migration note:** All Google Sheets / Google Drive / Cloud Run dependencies have been fully removed and replaced with PostgreSQL on the user's own VPS. The Google Apps Script form intake remains active as a separate intake channel.

---

## 2. Architecture Overview

```
┌─────────────────────┐        HTTPS         ┌──────────────────────────────┐
│   Vercel (Frontend) │ ──────────────────▶  │  VPS — Nginx (port 80/443)   │
│   React + Vite      │                       │  └─▶ Express (port 3000)     │
└─────────────────────┘                       │      └─▶ PostgreSQL (5432)   │
                                              │           Docker volume       │
                                              └──────────────────────────────┘
```

### PostgreSQL Schema (10 tables)

| Table | Purpose |
|---|---|
| `users` | Admin / HR login credentials (bcrypt) |
| `config` | Installment dates, school settings |
| `students` | Enrollment records |
| `payments_log` | Individual payment events |
| `transactions` | In/Out ledger |
| `bank_deposits` | Cash → bank transfers |
| `teachers` | Teacher roster + salary |
| `academic_year_archives` | Year-reset snapshots (JSONB) |
| `backup_index` | Backup metadata (up to 5 versions) |
| `backup_data` | Full backup JSONB rows |

---

## 3. Current State (v2.0 — Production-Ready)

### Core Features

| Feature | Status | Notes |
|---|---|---|
| Student search & fee editing | ✅ Done | Search by ID or name |
| Payment recording | ✅ Done | Cash / Visa / InstaPay / Check |
| Discount management | ✅ Done | Percentage-based, atomic DB transaction |
| In/Out transaction tracking | ✅ Done | With backdated date support |
| Bank deposit logging | ✅ Done | |
| Teacher management | ✅ Done | Add / edit / delete / pay |
| Teacher salary progress | ✅ Done | Progress bar on each teacher card |
| Overdue payment detection | ✅ Done | On-demand + schedulable cron |
| Analytics dashboard | ✅ Done | Income, expenses, collection rate |
| Student enrollment (single) | ✅ Done | Form with fee preview |
| Student enrollment (bulk Excel) | ✅ Done | Upload + process |
| Student update (single + bulk) | ✅ Done | Edit form + Excel bulk update |
| JWT authentication | ✅ Done | Login + 8h token + auto-refresh |
| Role-based access (Admin / HR) | ✅ Done | HR sees Students only |
| Multi-version backup (5 slots) | ✅ Done | Stored in PostgreSQL, survives restart |
| Undo last action | ✅ Done | Restores from latest backup |
| Academic year reset | ✅ Done | Archives to DB, resets payment data |
| Download master sheet | ✅ Done | XLSX generated from PostgreSQL |
| Silent token refresh | ✅ Done | Refreshes when <15 min remaining |
| Security headers | ✅ Done | helmet.js |
| HTTP request logging | ✅ Done | morgan |
| Crypto-random IDs | ✅ Done | All IDs use crypto.randomBytes |
| Arabic / English bilingual UI | ✅ Done | Full RTL support |
| Dark / light theme | ✅ Done | |
| Role-aware sidebar navigation | ✅ Done | Admin sees all 7 sections, HR sees 1 |
| Admin quick-stats bar | ✅ Done | Students / Cash / Overdue chips |
| Last action pill + inline Undo | ✅ Done | Header pill, desktop |

### User Roles

| Role | Access |
|---|---|
| `admin` | All sections: Overview, Fee Management, Students, Due Payments, Transactions, Balances, Teachers; Admin dropdown (backup, year reset, master sheet download, delete all) |
| `hr` | Students section only; no admin dropdown |

---

## 4. Known Bugs & Issues

### B-1 — Payments section uses mock data ⚠️ HIGH
**File:** `Frontend/src/components/sections/payments.tsx`
**Problem:** The Payments section renders hardcoded mock payment rows rather than fetching from `GET /api/students/:id/payments` or the `payments_log` table.
**Fix:** Replace mock data with `apiGet('/payments/recent')` or similar. Either add a backend route `GET /api/payments?limit=50` or fetch from existing data. Alternatively, fold this section into Fees (payment history per student).

### B-2 — Mobile has no navigation ⚠️ HIGH
**File:** `Frontend/src/components/layout/navigation.tsx`
**Problem:** The sidebar uses `hidden lg:flex` — on screens narrower than 1024px the nav is completely invisible and there is no hamburger menu or drawer fallback. Users on phones or tablets cannot switch sections.
**Fix:** Add a mobile drawer (shadcn `Sheet`) triggered by a hamburger button in the header. The `Navigation` component should accept an `open`/`onClose` prop and render as a `<Sheet>` on mobile.

### B-3 — `alert()` / `confirm()` dialogs in header ⚠️ MEDIUM
**File:** `Frontend/src/components/layout/header.tsx`
**Problem:** Year reset and undo use native browser `alert()` / `confirm()`. These block the thread, have no styling, and on some browsers (and all React Native WebViews) they are suppressed.
**Fix:** Replace with shadcn `AlertDialog` components. Year reset in particular needs a proper multi-step modal (enter year → choose keep/delete → confirm).

### B-4 — No error boundary ⚠️ MEDIUM
**Problem:** If any section component throws a runtime error, the entire app white-screens. There is no `<ErrorBoundary>` wrapping the section renderer.
**Fix:** Wrap the `renderSection()` output in a React `ErrorBoundary` that shows a friendly "Something went wrong — reload section" card.

### B-5 — `getTeachers()` data normalization ⚠️ MEDIUM
**File:** `Frontend/src/lib/api.ts` line ~428
**Problem:** `return { ok: true, data: res.teachers || res.data || [] }` — `res.teachers` is accessed on the raw `ApiResponse` wrapper which never has a `.teachers` key at the top level. The backend returns `{ success: true, teachers: [...] }` but `apiGet` wraps it, so the teachers array ends up in `res.data` (via the `|| res.data` fallback). Works by accident. If the response shape changes it will silently return `[]`.
**Fix:** Remove the `res.teachers` branch; rely only on `res.data` which `apiGet` already normalizes.

### B-6 — `finance.updated` custom event race condition ⚠️ LOW
**Problem:** If a section dispatches `window.dispatchEvent(new CustomEvent('finance.updated'))` before the dashboard/stats bar has mounted and registered its listener, the update is lost.
**Fix:** This is acceptable for now since sections are always mounted before actions can be performed. Long-term: switch to a proper reactive store (Zustand or React Query's `invalidateQueries`).

### B-7 — No client-side file size validation on Excel uploads ⚠️ LOW
**Files:** `students.tsx` upload handlers
**Problem:** A very large Excel file will be sent to the backend with no upfront warning. The backend's `multer` limit will reject it with a 413 but the error message shown to users is generic.
**Fix:** Add a `if (file.size > 5_000_000) return setError('File too large (max 5 MB)')` guard before calling the upload API.

### B-8 — VITE_API_BASE_URL missing gives silent failure ⚠️ LOW
**File:** `Frontend/src/lib/api.ts` line 6–13
**Problem:** We removed the Cloud Run fallback URL. If `VITE_API_BASE_URL` is not set at Vercel build time, `API_BASE` is empty string, all API calls go to the Vercel domain root, and every request 404s. The only indication is a console warning.
**Fix:** In `apiGet` / `apiSend`, if `API_BASE_URL` is empty or equals `/api`, return `{ ok: false, message: 'Backend URL not configured. Set VITE_API_BASE_URL.' }` immediately without making a fetch.

### B-9 — Token refresh timer doesn't start after page reload ⚠️ LOW
**File:** `Frontend/src/contexts/AuthContext.tsx`
**Problem:** On page reload the `useEffect([token])` runs once. If the token is valid but `< 15 min` from expiry at load time, the interval fires after 60 s. Fine in practice for an 8-hour token, but edge case if user loads with a nearly-expired token.
**Fix:** In the `useEffect`, after the expiry check, immediately check if `secondsLeft < REFRESH_THRESHOLD_S` and call `refreshToken()` synchronously before starting the interval.

---

## 5. Feature Roadmap

### Priority 1 — Complete in Next Sprint

#### 5.1 Mobile Navigation Drawer
**Problem:** No navigation on screens < 1024px wide (see B-2).
**Solution:**
- Add hamburger `Menu` button in the header (mobile only, `lg:hidden`)
- Render `Navigation` inside a shadcn `Sheet` (slide-in from left)
- Auto-close drawer on section select
- **Effort:** S | **Impact:** Critical

#### 5.2 Payments Section — Real Data
**Problem:** Payments section shows mock rows (see B-1).
**Solution:**
- Add backend route `GET /api/payments/recent?limit=50` that returns last 50 rows from `payments_log` joined with student name
- Replace mock data in `payments.tsx` with real API call
- Or: remove the Payments section from nav and fold payment history into the Fees section student card (simpler)
- **Effort:** S | **Impact:** High

#### 5.3 Student Payment History Panel
**Problem:** No per-student payment history visible in the Fees section.
**Solution:**
- Below the student card in `fees.tsx`, add a collapsible "Payment History" section
- Call `GET /api/students/:id/payments` (already exists in backend)
- Show a table: Date | Amount | Method | Processed By
- Add installment coverage progress bar (paid / total)
- **Effort:** S | **Impact:** High

#### 5.4 Admin User Management UI
**Problem:** Adding/removing users (admin/hr accounts) requires direct API calls with no UI.
**Solution:**
- Add a "Users" tab in the Admin dropdown or a dedicated Settings section (admin only)
- List existing users with role badges
- Add User form: username, password, role, display name
- Delete user (with last-admin guard)
- Change password option
- Backend routes already exist (`GET/POST /api/auth/users`, `DELETE /api/auth/users/:username`)
- **Effort:** S | **Impact:** High

---

### Priority 2 — Medium-Term

#### 5.5 Payment Date Backdating (Student Payments)
**Problem:** `recordPayment()` in `studentService.js` stamps `NOW()` for `payment_date`, ignoring any user-selected date.
**Solution:**
- Add optional `paymentDate` field to `POST /api/payments/process` request body
- Pass through `studentService.recordPayment()` and use in the INSERT
- Add date picker to the payment form in `fees.tsx`
- **Effort:** S | **Impact:** High

#### 5.6 Transaction Edit & Delete
**Problem:** Once a transaction is saved, there is no correction path.
**Solution:**
- Add Edit and Delete buttons on each transaction row in `transactions.tsx`
- Backend: `PUT /api/finance/transaction/:id` and `DELETE /api/finance/transaction/:id`
- Log the edit in an audit note (append to existing notes field)
- **Effort:** M | **Impact:** Medium

#### 5.7 Expense Categories
**Problem:** OUT transactions have a free-text Subject — no structured categorization for analytics.
**Solution:**
- Add `Category` column to `transactions` table (migration)
- Add category dropdown to In/Out form: Salaries, Supplies, Rent, Utilities, Other
- Show category breakdown (pie/bar) in the Dashboard overview
- **Effort:** S | **Impact:** Medium

#### 5.8 Monthly Financial Report (PDF Export)
**Problem:** No printable monthly or annual report.
**Solution:**
- Add "Export PDF" button in Dashboard section (admin only)
- Generate via server-side `pdfkit` or `puppeteer` snapshot
- Include: student collection rate, income vs expense summary, bank balance, top expense categories
- **Effort:** M | **Impact:** Medium

#### 5.9 Student Status Management
**Problem:** Students stay "Active" after full payment; no Inactive/Withdrawn lifecycle.
**Solution:**
- Auto-set status to `"Paid"` when `remaining_balance ≤ 0`
- Add manual `"Inactive"` / `"Withdrawn"` toggle in student update form
- Exclude Inactive students from overdue report and active counts
- **Effort:** S | **Impact:** Medium

#### 5.10 Database Backup Download
**Problem:** Admins can create in-app backups (stored in PostgreSQL) but cannot download a file for off-site storage.
**Solution:**
- Add "Download Backup" option to Admin dropdown
- Backend: `GET /api/admin/backup/:id/download` — streams backup JSON as `.json` or `.xlsx` file
- Also expose "Restore from file" upload for disaster recovery
- **Effort:** M | **Impact:** Medium

#### 5.11 Error Boundary
**Problem:** Section crashes white-screen the whole app (see B-4).
**Solution:**
- Wrap `renderSection()` in a React `ErrorBoundary` class component
- Show a "Section failed to load" card with a Retry button
- Log error to console
- **Effort:** S | **Impact:** Medium

---

### Priority 3 — Long-Term / Strategic

#### 5.12 WhatsApp Payment Reminders
**Problem:** WhatsApp reminder system is stubbed out.
**Solution:**
- Integrate Twilio WhatsApp or WhatsApp Business Cloud API
- Activate overdue cron at 9 AM to send reminders to students with `daysOverdue > 0`
- Add per-student notification opt-out toggle
- Preview message template in Settings before activating
- **Effort:** M | **Impact:** High

#### 5.13 Parent Portal (Read-Only)
**Problem:** Parents have no self-service visibility into fees.
**Solution:**
- Generate time-limited secure token links per student
- Display: fee status, payment history, upcoming installment dates
- No login required — token embedded in URL
- **Effort:** L | **Impact:** High

#### 5.14 Multi-Branch Support
**Problem:** System is hard-coded for one school instance.
**Solution:**
- Add `branch_id` column to all main tables
- Branch selector on login screen
- Super-admin cross-branch analytics view
- **Effort:** L | **Impact:** Strategic

#### 5.15 Teacher Payroll Expansion
**Problem:** Teacher payments record amount but no payslip or monthly schedule.
**Solution:**
- Add monthly salary schedule per teacher
- Track advances vs. final salary
- Generate a simple payslip PDF
- Show payroll expense line in monthly analytics
- **Effort:** M | **Impact:** Medium

#### 5.16 Automated Bank Reconciliation
**Problem:** Bank deposits are manually entered; no statement cross-check.
**Solution:**
- Upload bank statement CSV/Excel
- Auto-match deposits to `bank_deposits` table rows
- Flag unmatched entries for manual review
- **Effort:** L | **Impact:** Medium

---

## 6. Non-Functional Requirements

| Category | Requirement |
|---|---|
| Performance | All API calls < 2 seconds under normal load; PostgreSQL query indexes on `students.name`, `payments_log.student_id`, `transactions.date` |
| Reliability | Promise.allSettled in financial summary — one failing query never crashes the response |
| Security | JWT_SECRET required at startup (process.exit if missing); bcrypt cost 10; helmet headers; rate limiting on auth routes |
| Auditability | Every write logs timestamp + actor via `processed_by` column; morgan HTTP logs on backend |
| Backup | Up to 5 in-DB backup slots; backup survives server restart; download option (5.10) needed for true off-site DR |
| Availability | Backend behind Nginx; Docker Compose `restart: unless-stopped`; PostgreSQL healthcheck before backend starts |
| Token Security | 8-hour JWT expiry; silent refresh when < 15 min remain; auto-logout on refresh failure |

---

## 7. Technical Debt

| Item | File | Priority |
|---|---|---|
| Replace `moment.js` with `date-fns` (moment in maintenance mode) | `financeService.js`, `paymentDueService.js` | Low |
| Add Zod / joi validation on all backend request bodies | `server.js` | Medium |
| Replace `alert()` / `confirm()` with shadcn `AlertDialog` | `header.tsx` | Medium (see B-3) |
| Add proper TypeScript types to backend services | `services/*.js` → `.ts` migration | Low |
| Implement E2E tests (Playwright) for critical payment flows | — | Medium |
| Add React `ErrorBoundary` | `Index.tsx` | Medium (see B-4) |
| Fix `getTeachers()` normalization | `api.ts` | Medium (see B-5) |
| Mobile navigation drawer | `navigation.tsx` + `header.tsx` | High (see B-2) |
| Payments section real data | `payments.tsx` | High (see B-1) |
| API base URL guard for empty env var | `api.ts` | Low (see B-8) |

---

## 8. VPS Deployment Checklist

### First-Time Setup

```bash
# 1. Install Docker + Docker Compose
curl -fsSL https://get.docker.com | sh

# 2. Clone repo
git clone <your-repo> /opt/rajac-finance
cd /opt/rajac-finance/Backend

# 3. Create .env from example
cp .env.example .env
# Edit .env: set POSTGRES_PASSWORD, JWT_SECRET, FRONTEND_URL

# 4. Start services
docker compose up -d

# 5. Verify
docker compose ps          # both postgres + backend should be "healthy"
curl localhost:3000/health  # should return { ok: true }
```

### Nginx Reverse Proxy (`/etc/nginx/sites-available/rajac`)

```nginx
server {
    listen 80;
    server_name api.yourdomain.com;

    location / {
        proxy_pass         http://localhost:3000;
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
    }
}
```

Then: `certbot --nginx -d api.yourdomain.com` for HTTPS.

### Required Environment Variables

| Variable | Example | Required |
|---|---|---|
| `POSTGRES_PASSWORD` | `str0ng-p@ssword` | ✅ |
| `JWT_SECRET` | 64-char random string | ✅ |
| `FRONTEND_URL` | `https://your-app.vercel.app` | ✅ (CORS) |
| `POSTGRES_HOST` | `localhost` | defaults to `localhost` |
| `POSTGRES_DB` | `rajac` | defaults to `rajac` |
| `POSTGRES_USER` | `rajac` | defaults to `rajac` |
| `ADMIN_USERNAME` | `admin` | defaults to `admin` |
| `ADMIN_PASSWORD` | your password | defaults to `Admin@2025` ⚠️ change this |
| `HR_USERNAME` | `hr` | defaults to `hr` |
| `HR_PASSWORD` | your password | defaults to `Hr@2025` ⚠️ change this |
| `PORT` | `3000` | defaults to `3000` |

### Frontend (Vercel)

```
1. Set VITE_API_BASE_URL = https://api.yourdomain.com  (no trailing slash)
2. git push origin main  →  Vercel auto-deploys
3. Verify: open browser console, confirm no CORS errors on login
```

### Updates / Re-deploys

```bash
cd /opt/rajac-finance
git pull
docker compose up -d --build backend
# PostgreSQL data is in a named volume — untouched by rebuild
```

---

## 9. Database Health Checklist

Run after major changes or migrations:

- [ ] `docker compose ps` — both services `Up (healthy)`
- [ ] `docker exec -it rajac-postgres psql -U rajac -c '\dt'` — all 10 tables present
- [ ] `POST /api/auth/login` returns a valid JWT
- [ ] `GET /api/analytics` returns data (not 500)
- [ ] Config table has `Number_of_Installments` and `Installment_1_Date` through `Installment_4_Date`
- [ ] Admin and HR default users exist (or custom users configured via env vars)
- [ ] `FRONTEND_URL` in `.env` matches the actual Vercel domain (CORS)

---

## 10. Google Apps Script Intake

The Google Form → Google Apps Script intake channel remains active and independent of the backend migration. The Apps Script posts directly to `POST /api/students` (or a dedicated intake endpoint) on the VPS.

**Configuration needed in Apps Script:**
- Update `BACKEND_URL` constant to the new VPS URL (replace old Cloud Run URL)
- No other changes required — the endpoint contract (`name`, `year`, `totalFees`, `phoneNumber`) is unchanged

See `GoogleAppsScript-Intake.gs` for the current script.

---

## 11. Change Log

| Version | Date | Changes |
|---|---|---|
| 1.0 | 2025 | Initial production release (Google Sheets backend) |
| 1.1 | 2026-03-19 | Fix backdated In/Out transactions; add Last Action header pill with inline Undo |
| 2.0 | 2026-03-19 | **Full architecture migration:** Remove all Google Sheets / Drive / Cloud Run dependencies. Replace with PostgreSQL 16 on VPS via Docker Compose. Add JWT auth + RBAC (admin/hr). Multi-version persistent backup (5 slots). Helmet, morgan, crypto IDs, token refresh. Full frontend redesign: role-aware sidebar, admin quick-stats bar, dashboard overview, per-section UI polish, Login page redesign. Update Student tab added. |
