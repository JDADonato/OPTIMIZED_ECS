# Development Checklist

Date: 2026-05-21

This checklist consolidates `suggestions.md`, `productionready.md`, and `todoplan.md`. Items are grouped by category and ordered by importance.

Legend:

- **Right now**: do before adding major new features.
- **Implement**: planned product/technical work after critical fixes.
- **Optional**: useful improvements, but not blockers.

## 1. Security And Account Safety

### Right Now

- [ ] Re-enable CSRF protection for session-authenticated API routes.
- [ ] Keep only `webhook/paymongo` exempt from CSRF.
- [ ] Confirm all Axios/fetch requests send the CSRF token.
- [ ] Add rate limits for login, register, OTP verify, OTP resend, upload, checkout initialize, and availability checks.
- [ ] Remove OTP values from `error_log` and Laravel logs.
- [ ] Hash OTP values instead of storing plaintext codes.
- [ ] Increase password requirements beyond the current weak minimum.
- [ ] Set production-safe session/cookie defaults: encrypted sessions, secure cookies, proper same-site setting.

### Implement

- [ ] Queue OTP and email sending instead of sending synchronously.
- [ ] Add account throttling tests for login, register, OTP resend, and OTP verify.
- [ ] Add staff account lifecycle: invite, activate, suspend, reset password, force logout.
- [ ] Add role and permission documentation.
- [ ] Tighten chat authorization rules and audit staff conversation access.

### Optional

- [ ] Add two-factor authentication for staff/admin accounts.
- [ ] Add device/session management for users.

## 2. Payments, PayMongo, And Refunds

### Right Now

- [ ] Remove or lock down client-accessible payment recording through `POST /api/bookings/pay`.
- [ ] Ensure only PayMongo webhook/reconciliation or Accounting/Admin verification can mark payments as paid.
- [ ] Add tests for rush booking 1: combined 80% payment, then final 20%.
- [ ] Add tests for rush booking 2: one 100% payment.
- [ ] Add tests for standard booking payment milestones.
- [ ] Ensure paid and remaining balance calculations never concatenate strings or show `NaN`.

### Implement

- [ ] Add `paymongo_events` table for webhook idempotency.
- [ ] Add unique provider event ID handling.
- [ ] Add `refunds` table for refund attempts and provider refund references.
- [ ] Make refund processing auditable and retry-safe.
- [ ] Add PayMongo webhook tests for invalid signature, duplicate event, amount mismatch, and missing metadata.
- [ ] Add refund tests for full refund, partial refund, failed provider call, and duplicate refund request.
- [ ] Add payment reconciliation scheduled job for pending PayMongo checkouts.

### Optional

- [ ] Add a staff-facing PayMongo reconciliation dashboard.
- [ ] Add downloadable payment/refund audit reports.

## 3. Booking Correctness And Workflow

### Right Now

- [ ] Stop accepting `user_id` from the client booking payload.
- [ ] Always assign booking ownership from `Auth::id()`.
- [ ] Recalculate all booking totals server-side.
- [ ] Normalize selected menu payloads into trusted menu item IDs.
- [ ] Store a pricing snapshot for each booking.
- [ ] Make booking creation and payment schedule creation transactional.
- [ ] Protect booking status transitions through one service or state machine.

### Implement

- [ ] Create a backend pricing preview endpoint.
- [ ] Add server-side booking draft persistence.
- [ ] Add nearby-date suggestions when selected date is unavailable.
- [ ] Add scheduled job to expire unpaid bookings after `expires_at`.
- [ ] Add scheduled payment reminders before due dates.
- [ ] Add booking transition tests for pending, approved, confirmed, completed, cancelled, and refunded flows.

### Optional

- [ ] Add booking change request approval flow for major event changes.
- [ ] Add admin override reason fields for manual booking/payment changes.

## 4. Booking UI/UX Redesign

### Right Now

- [ ] Keep the current booking flow stable while backend correctness is fixed.
- [ ] Review validation copy and replace harsh/generic errors with helpful customer-facing messages.
- [ ] Ensure mobile booking screens have no overlap, clipped text, or hidden buttons.

### Implement

- [ ] Redesign booking into a more personalized event-planning flow:
  - Welcome / Event Vision
  - Date And Availability
  - Guest Count And Service Style
  - Recommended Package
  - Menu Personalization
  - Venue And Logistics
  - Review Your Event Plan
  - Account / Submit
- [ ] Add persistent "Your event plan" summary on desktop.
- [ ] Add collapsible event summary on mobile.
- [ ] Show "Saved just now" draft state.
- [ ] Let customers build a meaningful draft before requiring account creation.
- [ ] Add abandoned booking recovery email.
- [ ] Track booking funnel events: started, step completed, abandoned, resumed, submitted.

### Optional

- [ ] Add A/B test variants for booking step order and copy.
- [ ] Add package recommendation explanations like "Best for weddings with 100+ guests."

## 5. File Uploads And Storage

### Right Now

- [ ] Replace generic `file|max:5120` validation with MIME-specific validation.
- [ ] Restrict upload types by purpose.
- [ ] Stop storing sensitive uploads publicly.

### Implement

- [ ] Split uploads into separate endpoints:
  - payment proof
  - theme inspiration image
  - profile image
  - document upload
- [ ] Store sensitive files on a private disk.
- [ ] Serve private files through signed temporary URLs.
- [ ] Re-encode uploaded images where possible.
- [ ] Add upload tests for invalid MIME, oversized files, unauthorized access, and signed URL expiry.

### Optional

- [ ] Add malware scanning for arbitrary user-uploaded files.
- [ ] Add image compression and responsive variants.

## 6. API, Database, And Scalability

### Right Now

- [ ] Identify all growing endpoints still using unpaginated `.get()`.
- [ ] Paginate large list APIs for bookings, payments, ledger, customers, employees, chat, notifications, and food tastings.
- [ ] Add missing indexes for high-traffic filters.

### Implement

- [ ] Separate Inertia web routes from API routes where appropriate.
- [ ] Standardize JSON response shapes and validation errors.
- [ ] Add Laravel API resource classes for major entities.
- [ ] Convert structured text JSON fields to real JSON/JSONB columns with model casts.
- [ ] Add database constraints for valid statuses, positive amounts, provider references, and milestone totals.
- [ ] Verify PostgreSQL RLS works with the deployed DB role.

### Optional

- [ ] Add API versioning for future external/mobile clients.
- [ ] Add cursor pagination for chat/messages if volume grows.

## 7. Reports And Analytics

### Right Now

- [ ] Hide, remove, or relabel forecast visuals that look like real future revenue.
- [ ] Replace reports placeholder text with a useful interim state or basic exports.
- [ ] Confirm analytics does not depend on demo data in production.

### Implement

- [ ] Add global analytics filters:
  - date range
  - date basis
  - event type
  - package
  - booking status
  - payment status
  - customer type
  - city/location
  - pax range
  - price range
- [ ] Split analytics endpoints:
  - summary
  - revenue
  - pipeline
  - menu performance
  - customer experience
  - operations
- [ ] Build shared analytics/report definitions:
  - settled revenue
  - pending revenue
  - overdue revenue
  - pipeline value
  - actual event count
- [ ] Build report widget registry.
- [ ] Add `report_templates` and `report_runs`.
- [ ] Build drag-and-drop report builder.
- [ ] Add CSV export first, PDF export later.
- [ ] Audit report exports and saved report changes.

### Optional

- [ ] Add resizable report widgets.
- [ ] Add scheduled report emails.
- [ ] Add dashboard widgets that users can pin.

## 8. Announcement CMS

### Right Now

- [ ] Decide announcement approval rules for Marketing vs Admin.
- [ ] Decide where announcements appear: homepage, client dashboard, email, or all.

### Implement

- [ ] Add `announcements` table.
- [ ] Add `announcement_recipients` table.
- [ ] Add `announcement_reads` table.
- [ ] Add Admin/Marketing Content tab.
- [ ] Add draft, scheduled, published, and archived states.
- [ ] Add audience targeting.
- [ ] Add email preview and test-send.
- [ ] Queue announcement email sending.
- [ ] Show targeted announcements to customers.
- [ ] Track read, dismissed, sent, failed, opened, and clicked states where possible.

### Optional

- [ ] Add rich text editor.
- [ ] Add reusable announcement templates.
- [ ] Add promotional banners with scheduling.

## 9. Customer Feedback

### Right Now

- [ ] Decide when feedback should be sent: after event date, after status `Completed`, or both.
- [ ] Decide rating categories and whether testimonials can be public.

### Implement

- [ ] Add `feedback_requests` table.
- [ ] Add `feedback_responses` table.
- [ ] Generate secure token feedback links.
- [ ] Email feedback requests after completed events.
- [ ] Add public feedback form.
- [ ] Add duplicate submission protection.
- [ ] Add token expiry.
- [ ] Add Admin/Marketing feedback review UI.
- [ ] Add low-rating alerts.
- [ ] Feed ratings into analytics.

### Optional

- [ ] Add testimonial approval and publish workflow.
- [ ] Add customer satisfaction trend report.

## 10. Customer Dashboard And Communication

### Right Now

- [ ] Keep last selected event and tab behavior working.
- [ ] Add or improve a visible "Next best action" section.
- [ ] Make unpaid payments, missing details, tastings, and unread messages obvious.

### Implement

- [ ] Convert journey tracker steps into direct actions.
- [ ] Add due-date urgency states.
- [ ] Add operational alerts for staff dashboards:
  - old pending bookings
  - overdue payments
  - events within 7 days missing details
  - refunds waiting
  - unanswered messages
  - low feedback ratings
- [ ] Improve chat authorization and pagination.

### Optional

- [ ] Add customer notification preferences.
- [ ] Add SMS reminders if budget/provider allows.

## 11. Frontend Structure And Maintainability

### Right Now

- [ ] Avoid adding more large sections directly into `DashboardAdmin.jsx`, `DashboardMarketing.jsx`, `DashboardAccounting.jsx`, or `ClientDashboard.jsx`.
- [ ] Keep new features in separate components from the start.

### Implement

- [ ] Split dashboards into tab-level components.
- [ ] Create shared dashboard shell/toolbar components.
- [ ] Lazy-load heavy analytics and report sections.
- [ ] Continue image optimization and self-host critical production assets.
- [ ] Add empty/loading/error states consistently.

### Optional

- [ ] Add Storybook or a lightweight component preview page.
- [ ] Add a shared design token file for dashboard and marketing styles.

## 12. Testing And QA

### Right Now

- [ ] Replace example tests with real feature tests.
- [ ] Add tests for rush booking payment schedules.
- [ ] Add tests for booking ownership spoof prevention.
- [ ] Add tests for paid/remaining balance calculations.

### Implement

- [ ] Add factories for users, bookings, payments, menu items, packages, announcements, feedback, and reports.
- [ ] Add auth tests: login, register, OTP, email change, password change, throttling.
- [ ] Add role permission tests for Client, Marketing, Accounting, and Admin.
- [ ] Add PayMongo checkout and webhook tests using HTTP fakes.
- [ ] Add refund tests.
- [ ] Add upload tests.
- [ ] Add analytics/report filter tests.
- [ ] Add browser/E2E tests for booking, payment, accounting verification, and admin updates.
- [ ] Run tests and frontend build in CI.

### Optional

- [ ] Add visual regression screenshots for key pages.
- [ ] Add load testing for dashboard APIs.

## 13. Operations, Deployment, And Monitoring

### Right Now

- [ ] Define required production services: PHP, web server, database, Redis, queue worker, scheduler, storage, mail, Reverb/websocket, PayMongo.
- [ ] Create safe environment templates for local, staging, and production.
- [ ] Remove or isolate demo seeders from production flow.

### Implement

- [ ] Add scheduler commands:
  - expire unpaid bookings
  - send payment reminders
  - reconcile PayMongo checkouts
  - send feedback requests
  - publish scheduled announcements
  - cleanup stale drafts/uploads
- [ ] Configure queue workers and failed job monitoring.
- [ ] Add error monitoring and structured logging.
- [ ] Add health checks for app, DB, cache, queue, mail, storage, PayMongo, and Reverb.
- [ ] Add backup and restore procedures.
- [ ] Document deployment steps.

### Optional

- [ ] Add zero-downtime deployment workflow.
- [ ] Add uptime monitoring.
- [ ] Add automated database restore drills in staging.

## 14. Cleanup And Documentation

### Right Now

- [ ] Keep `suggestions.md`, `productionready.md`, `todoplan.md`, `optimizationplan.md`, and `checklist.md` as current planning docs.
- [ ] Mark outdated docs as archived or superseded.

### Implement

- [ ] Create `docs/`.
- [ ] Move stale handoff/completion docs into `docs/archive/`.
- [ ] Add `docs/INDEX.md` explaining which docs to read first.
- [ ] Decide whether bundled `php/`, `composer.phar`, and local helper scripts should remain in Git.
- [ ] If removed, update setup docs and `.gitignore`.

### Optional

- [ ] Add ADRs for major decisions:
  - payment flow
  - booking flow redesign
  - analytics/report architecture
  - announcement CMS
  - feedback system

## Recommended Overall Order

1. Security and payment correctness.
2. Booking ownership, server-side pricing, transactional booking creation.
3. PayMongo webhook/refund idempotency.
4. Upload hardening, rate limits, OTP cleanup.
5. Queue, scheduler, reconciliation, reminders.
6. Tests for booking, payments, refunds, auth, roles, and uploads.
7. Booking UI/UX redesign and draft persistence.
8. Customer dashboard next actions and staff operational alerts.
9. Announcement CMS.
10. Feedback system.
11. Real analytics filters and endpoint split.
12. Reports builder.
13. Dashboard code splitting and API standardization.
14. Production deployment, monitoring, backups, and documentation cleanup.

