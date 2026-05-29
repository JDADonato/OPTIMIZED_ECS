# System Suggestions

Date: 2026-05-21

This file lists recommended changes, additions, improvements, and removals after reviewing the current Laravel/Inertia system, routes, controllers, database shape, frontend pages, reports/analytics areas, payment/refund flows, upload handling, seeders, and documentation clutter.

The suggestions are grouped by priority. Each item includes the reason and a possible implementation plan.

## Priority 1: Fix Before Expanding Features

### 1. Re-enable CSRF For Session-Based API Routes

**Suggestion:** Remove the broad `api/*` CSRF exception in `bootstrap/app.php`.

**Reason:** Most `/api/*` routes are not stateless public APIs. They are session-authenticated web routes used by Inertia/React. Disabling CSRF for all of them exposes authenticated users to cross-site request attacks.

**Implementation plan:**

1. Keep only `webhook/paymongo` exempt from CSRF.
2. Confirm Axios/fetch requests include the CSRF token.
3. Add a small fetch wrapper for non-Axios calls.
4. Add feature tests that prove protected POST/PUT/DELETE routes reject missing CSRF.
5. Apply throttling to public endpoints such as availability, food tasting, login, register, and checkout initialize.

### 2. Remove Or Lock Down Legacy Client Payment Recording

**Suggestion:** Remove the client route `POST /api/bookings/pay` or change it into a proof-upload request that accounting must verify.

**Reason:** Real payment state should come from PayMongo webhooks/reconciliation or staff verification, not from a client request that can mark a payment as paid/verified.

**Implementation plan:**

1. Audit `BookingController::recordPayment`.
2. If no longer used, remove the route and frontend references.
3. If manual payment proof is needed, create `payment_proofs` with `Pending Review` status.
4. Let Accounting/Admin verify proof from their dashboard.
5. Add tests for client, accounting, and admin permissions.

### 3. Make PayMongo Events And Refunds First-Class Records

**Suggestion:** Add database tables for PayMongo events and refund attempts.

**Reason:** Webhooks can be delivered more than once, and refunds can partially fail. Without event/refund records, it is hard to audit, retry, or prove what happened.

**Implementation plan:**

1. Add `paymongo_events` table with provider event ID, type, payload hash, status, and processed timestamps.
2. Add unique index on provider event ID.
3. Add `refunds` table with booking/payment IDs, amount, reason, provider refund ID, status, requested_by, approved_by, and response metadata.
4. Update webhook handler to return success immediately for duplicate events.
5. Update refund flow to create a refund attempt before calling PayMongo.
6. Add tests for duplicate webhooks, amount mismatch, failed refund, and partial refund.

### 4. Stop Trusting Client-Supplied Booking Ownership And Totals

**Suggestion:** Remove `user_id` and final authoritative totals from the client booking payload.

**Reason:** A client should not be able to submit another user's ID or control the final booking amount. The server should calculate totals from stored package/menu/event data.

**Implementation plan:**

1. In `BookingController::store`, set `user_id` from `Auth::id()`.
2. Normalize selected menu items into IDs.
3. Recalculate package, menu, transport, labor, and surcharge totals server-side.
4. Store a pricing snapshot for historical bookings.
5. Reject payloads where submitted preview total differs from server total beyond rounding tolerance.
6. Add tests for standard booking, rush booking 1, rush booking 2, custom menu, and spoofed `user_id`.

### 5. Replace Plain OTP Logging And Storage

**Suggestion:** Hash OTP values and remove OTP values from logs.

**Reason:** OTPs are credentials. Logging them or storing them as plaintext creates account takeover risk.

**Implementation plan:**

1. Store OTP with `Hash::make`.
2. Verify with `Hash::check`.
3. Remove `error_log` and `Log::info` calls that include OTP values.
4. Add resend/verify rate limits.
5. Queue OTP mail instead of sending synchronously.
6. Add tests for expiry, reuse, throttling, and wrong code.

## Priority 2: Remove Or Separate Demo/Development Artifacts

### 1. Split Demo Seeders From Production Seeders

**Suggestion:** Move demo users/bookings/analytics seeding behind an explicit local/demo command.

**Reason:** The seeders include large demo datasets and demo emails. This is useful for development but risky if accidentally run in production.

**Implementation plan:**

1. Keep base lookup data in `DatabaseSeeder`.
2. Move operational demo data into `DemoDatabaseSeeder`.
3. Require `APP_ENV=local` or `--force-demo` for demo seeding.
4. Add a production seeder that creates no known-password users.
5. Document the difference in `README.md`.

### 2. Remove Old Handoff/Completion Documents From Main App Root

**Suggestion:** Move historical docs into `docs/archive/` or remove outdated ones.

**Reason:** The root directory contains many overlapping documents: `handoff.md`, `mavhandoff.md`, `FINAL_COMPLETION_REPORT.md`, `SYSTEM_FIXED.md`, `PROJECT_UPDATES.md`, `QUICK_REFERENCE.md`, and more. This makes it harder for new developers to know what is current.

**Implementation plan:**

1. Create `docs/`.
2. Keep current docs:
   - `README.md`
   - `productionready.md`
   - `optimizationplan.md`
   - `todoplan.md`
   - `suggestions.md`
   - latest handoff file
3. Move stale docs to `docs/archive/`.
4. Add `docs/INDEX.md` explaining which document to read first.

### 3. Remove Bundled Runtime Files From Git If Not Required

**Suggestion:** Reconsider committing `php/`, `composer.phar`, `.phpunit.result.cache`, and local helper scripts.

**Reason:** Bundled runtimes and generated caches increase repository size and can confuse deployment. They may be useful for a school/demo Windows setup, but production deployment should install dependencies/runtime separately.

**Implementation plan:**

1. Decide if the repo must remain portable on Windows for group members.
2. If yes, keep runtime but document it as development-only.
3. If no, remove `php/`, `composer.phar`, and local-only scripts from Git.
4. Add them to `.gitignore`.
5. Update setup instructions to use installed PHP/Composer.

## Priority 3: Improve Product Experience

### 1. Build A Personalized Booking Experience

**Suggestion:** Replace the current form-like wizard with a guided event-planning flow.

**Reason:** Booking is the most important conversion path. The current six steps work, but the process can feel like data entry. A better flow can reduce abandonment and make customers feel that the system is building their event plan with them.

**Implementation plan:**

1. Use the detailed plan in `todoplan.md`.
2. Add event vision, package recommendation, pricing preview, and review summary steps.
3. Add server-side draft persistence.
4. Add "Saved just now" and resume behavior.
5. Add booking funnel tracking events.
6. Run manual QA for mobile and desktop.

### 2. Add Customer Communication CMS

**Suggestion:** Add Marketing/Admin announcement management.

**Reason:** Staff currently need code changes or manual communication for announcements. A CMS lets staff publish service notices, promos, reminders, and updates to the customer homepage/dashboard and email.

**Implementation plan:**

1. Add `announcements`, `announcement_recipients`, and `announcement_reads`.
2. Add Admin/Marketing Content tab.
3. Add draft/schedule/publish/archive workflow.
4. Queue announcement emails.
5. Show customer-targeted announcement cards on home/dashboard.
6. Track read/dismiss/send status.

### 3. Add Post-Event Feedback

**Suggestion:** Email customers a feedback form after completed events.

**Reason:** This creates operational insight, testimonials, and service quality data. It also gives analytics real customer experience signals.

**Implementation plan:**

1. Add `feedback_requests` and `feedback_responses`.
2. Send tokenized feedback emails after event completion.
3. Create a public feedback form.
4. Add Admin/Marketing feedback review tab.
5. Add low-rating alerts.
6. Feed rating data into analytics.

### 4. Improve Customer Dashboard Next Actions

**Suggestion:** Make the client dashboard more action-first.

**Reason:** Customers should immediately know what they need to do next: pay, confirm details, schedule tasting, answer a staff message, or review event information.

**Implementation plan:**

1. Add a "Next best action" card at the top.
2. Prioritize unpaid milestones, pending staff requests, upcoming tasting, and missing event details.
3. Convert journey tracker steps into clickable actions.
4. Add due date urgency states.
5. Keep last selected event/tab behavior.

## Priority 4: Make Reports And Analytics Actually Useful

### 1. Replace Placeholder Reports With A Report Builder

**Suggestion:** Convert the Reports tab from static summary/export buttons into a configurable report builder.

**Reason:** The current report area still has placeholder text like "No reports yet. Click Generate Snapshot." A drag-and-drop report builder matches the mentor suggestion and gives admins the ability to see only the data they care about.

**Implementation plan:**

1. Add a widget registry with approved report blocks.
2. Add `report_templates` and `report_runs`.
3. Use `@dnd-kit/core` for drag-and-drop arrangement.
4. Let admins configure filters and widget settings.
5. Add CSV export first, PDF later.
6. Audit report exports.

### 2. Split Analytics Into Real, Filterable Sections

**Suggestion:** Replace the broad `/api/admin/analytics` response with focused, filterable analytics endpoints.

**Reason:** Current analytics includes forecast-like future visuals and broad cached data. Admin decisions need clear actuals, pipeline, and risk views based on real data.

**Implementation plan:**

1. Add global filters: date range, date basis, event type, package, status, payment status, city, pax range.
2. Create endpoints:
   - `/api/admin/analytics/summary`
   - `/api/admin/analytics/revenue`
   - `/api/admin/analytics/pipeline`
   - `/api/admin/analytics/menu-performance`
   - `/api/admin/analytics/customer-experience`
   - `/api/admin/analytics/operations`
3. Label metrics as actual, pending pipeline, overdue, or estimate.
4. Remove or clearly label forecast charts.
5. Add empty states when data is insufficient.

### 3. Add Operational Alert Panels

**Suggestion:** Add actionable alerts in Admin/Marketing/Accounting dashboards.

**Reason:** Charts are useful, but staff need to know what requires action today.

**Implementation plan:**

1. Add alerts for:
   - Pending bookings older than 48 hours.
   - Payments overdue.
   - Events within 7 days with missing details.
   - Refunds waiting for processing.
   - Low feedback ratings.
   - Unanswered customer messages.
2. Add compact alert cards on dashboard landing sections.
3. Link each alert to the relevant filtered tab.

## Priority 5: Scalability And Maintainability

### 1. Move Large Dashboard Pages Into Smaller Components

**Suggestion:** Split `DashboardAdmin.jsx`, `DashboardMarketing.jsx`, `DashboardAccounting.jsx`, and `ClientDashboard.jsx` into tab-level components.

**Reason:** These pages are large and hard to maintain. Splitting them makes future development easier and enables lazy loading heavy tabs.

**Implementation plan:**

1. Create folders:
   - `resources/js/Pages/admin/`
   - `resources/js/Pages/marketing/`
   - `resources/js/Pages/accounting/`
   - `resources/js/Pages/client/dashboard/`
2. Move each tab into its own component.
3. Extract shared dashboard shell and toolbar components.
4. Lazy-load heavy analytics/reports sections.
5. Keep APIs unchanged during the first refactor.

### 2. Paginate Every Growing API

**Suggestion:** Audit every `.get()` list endpoint and paginate anything that can grow.

**Reason:** Full-table reads slow down page changes and dashboards as real bookings/messages/payments grow.

**Implementation plan:**

1. Paginate marketing bookings, admin users/customers, ledger, pending payments, chat messages, conversations, notifications, and food tasting lists.
2. Add `per_page`, `search`, `sort`, and filter query params.
3. Update frontend tables to use server pagination.
4. Add indexes for common filters.

### 3. Standardize API Responses

**Suggestion:** Use consistent resource/response shapes for list APIs, errors, and success messages.

**Reason:** The frontend currently has to adapt to many response shapes. Standard responses reduce bugs and make features faster to build.

**Implementation plan:**

1. Create API resource classes for bookings, payments, users, announcements, feedback, and reports.
2. Use Laravel pagination response metadata consistently.
3. Standardize validation error display.
4. Document endpoint contracts.

### 4. Convert JSON Text Columns To Real JSON Columns

**Suggestion:** Convert fields like `theme_uploads` and selected menu-like data from text JSON strings to JSON columns with model casts.

**Reason:** Manual JSON encode/decode is fragile and hard to query. JSON columns make validation, casts, and future reports easier.

**Implementation plan:**

1. Add migrations for JSON columns.
2. Backfill existing text values.
3. Add model casts.
4. Update controllers to accept arrays.
5. Add tests for legacy and new data.

## Priority 6: Security And Operations

### 1. Harden File Uploads

**Suggestion:** Replace the generic `/api/upload` endpoint with purpose-specific upload endpoints.

**Reason:** The current upload controller accepts any file with only a size limit and stores it publicly. This is risky for payment proofs, event inspiration images, and future document uploads.

**Implementation plan:**

1. Create separate endpoints for payment proof, theme inspiration, profile image, and document upload.
2. Add strict MIME rules.
3. Re-encode images where possible.
4. Store sensitive files on a private disk.
5. Serve private files through signed URLs.
6. Add upload tests.

### 2. Add Queue And Scheduler Operations

**Suggestion:** Add scheduled commands and document queue workers.

**Reason:** Email, reminders, abandoned booking recovery, payment reconciliation, feedback requests, and announcements should not depend on users loading pages.

**Implementation plan:**

1. Add commands:
   - expire unpaid bookings.
   - send payment reminders.
   - reconcile PayMongo pending checkouts.
   - send feedback requests.
   - publish scheduled announcements.
2. Configure `schedule:run`.
3. Configure queue workers or Horizon.
4. Add failed job monitoring.

### 3. Add Real Test Coverage

**Suggestion:** Replace example tests with feature tests for business-critical flows.

**Reason:** Current tests are only examples. The riskiest areas are payments, refunds, booking ownership, roles, uploads, and analytics.

**Implementation plan:**

1. Add factories for users, bookings, payments, menu items, packages, and feedback.
2. Add payment milestone tests.
3. Add PayMongo webhook tests with `Http::fake`.
4. Add role permission tests.
5. Add upload validation tests.
6. Add at least one browser/E2E flow for booking and payment.

## Suggested Removal List

These should be removed, archived, or isolated after confirmation:

1. **Legacy message routes** if the newer chat system fully replaces them.
   - Reason: two messaging systems increase maintenance and permission bugs.
   - Plan: add deprecation tests, update frontend references, remove legacy routes/controllers.

2. **Placeholder report UI.**
   - Reason: it looks unfinished and does not help admins.
   - Plan: replace with report builder or hide until ready.

3. **Forecast charts labeled like real future revenue.**
   - Reason: misleading operationally.
   - Plan: remove or relabel as estimate and require enough historical data.

4. **Development/demo seed data in normal seed flow.**
   - Reason: risky in production.
   - Plan: move to demo-only seeder.

5. **Outdated root documentation.**
   - Reason: creates confusion.
   - Plan: archive under `docs/archive`.

6. **Generic public upload endpoint.**
   - Reason: security risk.
   - Plan: replace with purpose-specific upload endpoints.

## Suggested Addition List

1. Announcement CMS.
2. Feedback system.
3. Report builder.
4. Analytics filter service.
5. Booking draft server persistence.
6. Payment/refund idempotency tables.
7. Operational alerts.
8. Audit exports and report export logs.
9. Health checks for DB, cache, queue, mail, storage, PayMongo, and Reverb.
10. Feature flags for incomplete modules.

## Recommended Implementation Order

1. Security and payment correctness:
   - CSRF, booking ownership, server-side totals, payment route lockdown, OTP cleanup.
2. Operational foundation:
   - Queue, scheduler, idempotency tables, upload hardening, tests.
3. Booking redesign:
   - Drafts, pricing preview, better steps, abandonment recovery.
4. Communication features:
   - Announcement CMS and feedback emails.
5. Data features:
   - Real analytics filters, operational alerts, report builder.
6. Cleanup:
   - Archive docs, remove legacy messaging, split large pages, remove demo seed risk.

## Quick Wins

These can be done quickly and will noticeably improve the project:

- Hide or relabel forecast analytics so they are not mistaken for actual revenue.
- Archive outdated docs into `docs/archive`.
- Add a visible "Next action" card to the client dashboard.
- Add rate limits to login, register, OTP, upload, checkout, and availability.
- Remove OTP values from logs.
- Add MIME validation to uploads.
- Add tests for rush booking 1 and rush booking 2 payment schedules.
- Replace reports placeholder with a clear "Reports builder coming next" state or first useful CSV exports.

## Final Recommendation

The system should not keep expanding by adding more large tabs into existing dashboard files. The best path is to first secure the money/account flows, then create shared foundations for content, feedback, analytics, and reports. After that, new features will be easier to build and less likely to break payment or dashboard behavior.

