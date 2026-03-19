# Product Requirements Document (PRD)
## RAJAC Language Schools — Finance Management System
**Version:** 1.1
**Date:** 2026-03-19
**Status:** Living Document

---

## 1. Product Overview

The RAJAC Finance System is a full-stack web application that manages student enrollments, fee collection, financial transactions, teacher payments, and analytics for RAJAC Language Schools. The backend runs on Google Cloud Run (Node.js/Express), the frontend is deployed on Vercel (React/TypeScript), and Google Sheets serves as the primary database.

---

## 2. Current State (v1.0)

### Core Features
| Feature | Status | Notes |
|---|---|---|
| Student search & fee editing | ✅ Live | Search by ID or name |
| Payment recording by grade | ✅ Live | Cash / Bank / Other |
| Discount management | ✅ Live | Percentage-based |
| In/Out transaction tracking | ✅ Live | Revenue & expenses |
| Bank deposit logging | ✅ Live | |
| Teacher management | ✅ Live | Add / edit / delete / pay |
| Overdue payment detection | ✅ Live | Daily cron at 9 AM |
| Analytics dashboard | ✅ Live | Monthly charts |
| Google Form student intake | ✅ Live | Via Google Apps Script |
| Google Drive student import | ✅ Live | Excel upload |
| Undo last action (1-level) | ✅ Live | In-memory backup |
| Arabic / English bilingual UI | ✅ Live | |

### Known Issues Fixed in v1.1
- **Date restriction in In/Out**: Previously the backend always stamped `NOW()` regardless of the user-selected date. Fixed by passing the selected date through all layers (frontend form → api.ts → server.js route → financeService).
- **Last Action box**: Added a persistent pill in the header showing the last recorded action with an inline Undo button. Visible on desktop (md+).

---

## 3. Stakeholders

| Role | Responsibility |
|---|---|
| Finance Manager | Daily transaction recording, balance review |
| School Admin | Student enrollment, fee adjustments, reports |
| Teachers | Salary reference (view-only future scope) |
| System Operator | Deployment, Google Sheets management |

---

## 4. Recommended Feature Enhancements (Roadmap)

### Priority 1 — Critical / Near-Term

#### 4.1 Real Authentication & Role-Based Access
**Problem:** `requireAuth` middleware currently lets every request through. Any person with the URL can read or modify all financial data.
**Solution:**
- Implement JWT authentication with login form (username + bcrypt password)
- Two roles: `admin` (full access) and `staff` (no delete/undo)
- Store hashed credentials in the Config sheet or a dedicated sheet
- Session timeout after 8 hours of inactivity
- **Effort:** M | **Impact:** Critical

#### 4.2 Persistent Undo History (Multi-level)
**Problem:** Only one backup is kept in memory; server restart loses it.
**Solution:**
- Store up to 10 snapshots per session in Google Drive (as compressed JSON files)
- Label each snapshot with timestamp + action description
- Expose a history panel listing recent undoable actions
- **Effort:** M | **Impact:** High

#### 4.3 Payment Date Override
**Problem:** `studentService.recordPayment()` also stamps `moment()` for payment date with no way to backdate.
**Solution:** Accept an optional `paymentDate` field in `POST /api/payments/process` (same pattern applied to In/Out in v1.1).
**Effort:** S | **Impact:** High

#### 4.4 Student Installment Tracker (per-student view)
**Problem:** Overdue report is aggregate; no view per student shows which installments they paid.
**Solution:**
- Add a "Payment History" panel inside the student card in Fees section
- List all payments from Payments_Log for the selected student
- Show installment coverage progress bar
- **Effort:** M | **Impact:** High

---

### Priority 2 — Medium-Term

#### 4.5 WhatsApp Notification Activation
**Problem:** The WhatsApp reminder system exists in code but is stubbed out.
**Solution:**
- Integrate Twilio WhatsApp API (credentials already referenced in .env.example)
- Activate the 10 AM cron job for payment reminders
- Add a toggle in the UI to enable/disable per-student notifications
- Preview message template in Settings before activating
- **Effort:** M | **Impact:** High

#### 4.6 Monthly Financial Report (PDF Export)
**Problem:** There is no way to export a printable monthly or annual report.
**Solution:**
- Add "Export Report" button in Dashboard section
- Generate PDF via `jsPDF` or server-side `puppeteer` snapshot
- Include: student collection rate, in/out summary, bank balance, top expenses
- **Effort:** M | **Impact:** Medium

#### 4.7 Expense Categories
**Problem:** Out transactions have a free-text "Subject" with no structured categorization, making analytics imprecise.
**Solution:**
- Add a `Category` dropdown to the In/Out form (e.g. Salaries, Supplies, Rent, Utilities, Other)
- Store category in Google Sheet column
- Add category breakdown chart to Dashboard
- **Effort:** S | **Impact:** Medium

#### 4.8 In/Out Transaction Editing & Deletion
**Problem:** Once a transaction is saved there is no way to correct it (except full sheet undo).
**Solution:**
- Add Edit and Delete buttons on each transaction card in the Transactions section
- Update the corresponding row in the Google Sheet via row-index lookup
- Log the edit in an audit trail
- **Effort:** M | **Impact:** Medium

#### 4.9 Student Status Transitions
**Problem:** Students remain "Active" even after full payment; no "Inactive" lifecycle management.
**Solution:**
- Auto-set status to "Paid" when `Remaining_Balance ≤ 0`
- Add manual "Inactive" toggle for withdrawn students
- Filter overdue report to exclude Inactive students
- **Effort:** S | **Impact:** Medium

---

### Priority 3 — Long-Term / Strategic

#### 4.10 Multi-Branch / Multi-School Support
**Problem:** System is hard-coded for one school and one master spreadsheet.
**Solution:**
- Support configuring multiple `GOOGLE_MASTER_SHEET_ID` values (one per branch)
- Add a branch selector on the login screen
- Consolidate cross-branch analytics in a super-admin view
- **Effort:** L | **Impact:** Strategic

#### 4.11 Parent Portal (Read-Only)
**Problem:** Parents have no self-service visibility into fees owed or payment history.
**Solution:**
- Issue parents a secure token link (e.g. `https://rajac-fin.vercel.app/portal?token=…`)
- Show their child's fee status, payment history, upcoming installment dates
- Token expires after 24 hours or single use
- **Effort:** L | **Impact:** High

#### 4.12 Automated Bank Reconciliation
**Problem:** Bank deposits are manually entered; no way to verify against actual bank statements.
**Solution:**
- Upload bank statement CSV/Excel
- Auto-match deposits to Bank_Deposits sheet rows
- Flag unmatched entries for manual review
- **Effort:** L | **Impact:** Medium

#### 4.13 Teacher Payroll Module Expansion
**Problem:** Teacher payments record amount but no payslip, tax breakdown, or monthly summary.
**Solution:**
- Add monthly salary schedule per teacher
- Track advances vs. final salary
- Generate a simple payslip PDF
- Show payroll expense line in monthly analytics
- **Effort:** M | **Impact:** Medium

#### 4.14 Mobile-Responsive In/Out Entry
**Problem:** The transaction form is usable on mobile but the layout is not fully optimized for small screens.
**Solution:**
- Add a simplified Quick Entry bottom sheet for mobile
- One-tap type selector (IN green / OUT red)
- Auto-open keyboard on amount field
- **Effort:** S | **Impact:** Medium

#### 4.15 Dark-Mode Last Action Box (Mobile)
**Problem:** The last-action pill is hidden on `< md` screens.
**Solution:**
- Show it as a slim top bar below the header on small screens, auto-dismissible
- **Effort:** S | **Impact:** Low

---

## 5. Non-Functional Requirements

| Category | Requirement |
|---|---|
| Performance | All API calls < 3 seconds under normal load |
| Reliability | Graceful degradation if Google Sheets API is rate-limited (retry with exponential backoff) |
| Security | Implement auth before any public-facing URL sharing; all secrets via environment variables |
| Auditability | Every write operation must be logged with timestamp + actor (currently implemented via auditLog middleware) |
| Backup | Daily automatic backup snapshot to Google Drive (not just in-memory) |
| Availability | Backend on Cloud Run auto-scales to 0; cold-start < 5 seconds |

---

## 6. Technical Debt Items

| Item | File | Priority |
|---|---|---|
| Replace `moment.js` with `date-fns` (moment is in maintenance mode) | All services | Low |
| Add Zod validation on all backend request bodies | server.js | Medium |
| Remove `console.log` in production API calls | api.ts lines 117, 118 | Low |
| Replace `alert()` / `confirm()` dialogs in header with proper modal | header.tsx | Medium |
| Add proper TypeScript types to backend services | services/*.js | Low |
| Implement exponential back-off for Google Sheets API calls | googleSheets.js | High |
| Persist undo backup to Google Drive instead of memory | googleSheets.js | High |
| Add E2E tests (Playwright) for critical payment flows | — | Medium |

---

## 7. Google Sheets Health Checklist

The following must be verified after any major change:

- [ ] `Master_Students` sheet has correct headers in row 1
- [ ] `In_Out_Transactions` sheet accepts the `Date` column value correctly
- [ ] Service account email has **Editor** access on the master spreadsheet
- [ ] `Config` sheet contains `Number_of_Installments` and `Installment_N_Date` keys
- [ ] `GOOGLE_MASTER_SHEET_ID` env var matches the actual spreadsheet ID
- [ ] Google Apps Script trigger is active (`onFormSubmit`) in the linked Google Form
- [ ] After deployment: hit `POST /api/init` once to ensure all sheet tabs exist

---

## 8. Deployment Checklist

### Backend (Cloud Run)
```
1. Update GOOGLE_MASTER_SHEET_ID if spreadsheet changed
2. docker build -t rajac-backend .
3. gcloud run deploy --region us-central1
4. Verify CORS origin includes the Vercel frontend domain
5. POST /api/init to re-initialize any missing sheets
```

### Frontend (Vercel)
```
1. Set VITE_API_BASE_URL to the new Cloud Run URL in Vercel environment variables
2. git push origin main (Vercel auto-deploys)
3. Verify /api health check returns 200 from browser console
```

---

## 9. Change Log

| Version | Date | Changes |
|---|---|---|
| 1.0 | 2025 | Initial production release |
| 1.1 | 2026-03-19 | Fix backdated In/Out transactions; add Last Action header pill with inline Undo; wire LastActionContext across payments and transactions sections |
