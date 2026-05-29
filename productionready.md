# Production Readiness Plan

This document summarizes what still needs to be done before DAREV ECS is ready for real users, production traffic, payment operations, multiple deployment environments, and future scale. The review covered the Laravel/Inertia application structure, routes, controllers, database models/migrations, payment flow, refunds, realtime chat, file uploads, frontend behavior, and deployment assumptions.

## Readiness Summary

The system has the core product shape in place: authentication, role-based dashboards, booking creation, payment milestones, PayMongo checkout/webhooks, accounting verification, refunds, chat, marketing/admin tools, and a React customer experience.

The largest production blockers are security and operational correctness rather than missing screens. The app currently relies heavily on session-authenticated API routes in `routes/web.php`, has CSRF disabled for all `/api/*` routes, allows several sensitive workflows to trust client-submitted values, and lacks enough idempotency, pagination, queue/scheduler operations, and automated tests for real payment traffic.

Production readiness should be handled in phases. Phase 1 should close critical security and money-flow risks. Phase 2 should stabilize business workflows and data integrity. Phase 3 should improve scalability, observability, and deployment operations. Phase 4 should harden long-term maintainability.

## Phase 1: Critical Launch Blockers

### 1. Restore CSRF Protection For Session APIs

**Issue:** `bootstrap/app.php` excludes `api/*` from CSRF validation. Many `/api/*` routes are session-authenticated web routes, so a malicious site could trigger state-changing actions for a logged-in user.

**How to implement:**

- Change the CSRF exception list to only exclude the PayMongo webhook route.
- Keep `webhook/paymongo` exempt because PayMongo cannot provide Laravel CSRF tokens.
- Ensure every frontend request sends the CSRF token through Axios/fetch.
- Add tests proving POST/PATCH/DELETE API routes reject requests without CSRF and accept valid authenticated requests.

**Recommended target:**

```php
->withMiddleware(function (Middleware $middleware): void {
    $middleware->validateCsrfTokens(except: [
        'webhook/paymongo',
    ]);
})
```

### 2. Prevent Booking Ownership Spoofing

**Issue:** `BookingController::store()` validates and uses `user_id` from the request. A logged-in client should never be allowed to create a booking for another user by changing the submitted payload.

**How to implement:**

- Remove `user_id` from the client booking payload contract.
- Always set `user_id` from `Auth::id()` on the server.
- Add a feature test that posts a different `user_id` and confirms the created booking still belongs to the authenticated user.

### 3. Recalculate All Booking Totals On The Server

**Issue:** Booking creation only verifies price totals under some request shapes. The frontend can send `selected_menu`, `customMenu`, or other structures, and the backend may accept a client-provided `total_cost` without a full authoritative recalculation.

**How to implement:**

- Create one server-side booking pricing service that accepts package ID, event type ID, guest count, duration, selected menu IDs, and add-ons.
- Normalize all frontend menu formats into menu item IDs before calculation.
- Reject mismatches between submitted total and calculated total.
- Store both the calculated total and a pricing snapshot so future package/menu price edits do not mutate historical bookings.
- Add tests for standard booking, rush booking 1, rush booking 2, custom menu, discounts, and package/event-type pricing changes.

### 4. Lock Down Client Payment Recording

**Issue:** The legacy `recordPayment()` flow can mark payments as `Verified` from a client request. Real payments should be confirmed by PayMongo webhook/reconciliation or manually verified by accounting staff.

**How to implement:**

- Remove the client-accessible route or change it to a proof-upload flow that creates a `Pending Review` payment record.
- Only PayMongo webhook/reconciliation should auto-mark online payments as paid.
- Only Accounting/Admin roles should manually mark payments as verified.
- Add authorization tests for client, marketing, accounting, and admin roles.

### 5. Harden PayMongo Webhook Idempotency

**Issue:** The webhook validates signatures and updates payments, but event idempotency needs stronger database enforcement. Duplicate webhook delivery is normal in payment systems.

**How to implement:**

- Add a `paymongo_events` table or a unique nullable index for processed provider event IDs.
- Store event ID, event type, payment intent/source/checkout IDs, payload hash, processed timestamp, and processing status.
- In the webhook handler, insert the event record first inside a transaction. If the event already exists, return success without processing again.
- Keep row locks around the payment milestone update.
- Add tests for duplicate webhook delivery, out-of-order delivery, invalid signatures, expired timestamps, and missing metadata.

### 6. Make Refunds Auditable And Idempotent

**Issue:** Refund processing calls PayMongo for existing provider payments, but refund attempts are not tracked as first-class records. Partial failures can leave local and provider states difficult to reconcile.

**How to implement:**

- Add a `refunds` table with `payment_id`, `booking_id`, `amount`, `reason`, `status`, `provider_refund_id`, `provider_payment_id`, `requested_by`, `approved_by`, timestamps, and raw provider response metadata.
- Create refund attempts before calling PayMongo.
- Mark attempts `processing`, `succeeded`, or `failed`.
- Use provider idempotency keys where supported.
- Do not overwrite payment status to `Refunded` until the refund succeeds or the full payment amount has been refunded.
- Support partial refunds explicitly or reject them consistently.
- Add tests for full refund, partial refund, failed provider call, duplicate refund request, and cancellation/refund permission rules.

## Phase 2: Security Hardening

### 1. Strengthen Authentication And OTP Handling

**Issues identified:**

- Login has no visible rate limiting.
- Password minimum is 6 characters.
- OTP codes are stored in plaintext.
- OTP values are logged through `error_log` / `Log::info`.
- OTP email sending is synchronous in some flows.

**How to implement:**

- Add Laravel rate limiting for login, register, OTP resend, OTP verify, password reset, and sensitive profile actions.
- Raise password rules to at least 10-12 characters, preferably using Laravel `Password` rules.
- Hash OTPs using `Hash::make()` and verify with `Hash::check()`.
- Remove all OTP values from logs.
- Queue OTP emails and run a production queue worker.
- Expire OTPs quickly and invalidate older OTPs when a new one is generated.
- Add tests for throttling, expiry, invalid OTP, reused OTP, and email-change verification.

### 2. Harden File Uploads

**Issue:** `FileUploadController` validates only `file|max:5120`. This allows unsafe file types and stores uploads publicly.

**How to implement:**

- Split upload endpoints by purpose: theme images, payment proof, profile media, documents.
- Add strict MIME and extension validation per purpose.
- For images, validate dimensions and re-encode server-side when possible.
- Store sensitive files on a private disk.
- Serve sensitive files through signed temporary URLs after authorization checks.
- Add malware scanning if production users can upload arbitrary files.
- Add tests for disallowed MIME types, oversized files, unauthorized access, and signed URL expiry.

### 3. Tighten Chat Authorization

**Issue:** Marketing/Admin users can currently access broad chat conversations. That may be acceptable for supervisors, but it should be explicit and auditable.

**How to implement:**

- Decide the policy: assigned staff only, assigned staff plus supervisors, or all staff.
- Encode the policy in `ChatController` and `routes/channels.php`.
- Add audit logs when staff view or claim conversations.
- Paginate conversation and message reads.
- Add tests for client access, assigned staff access, unassigned conversation preview, and unauthorized staff access.

### 4. Secure Environment Defaults

**Issues identified:**

- `.env.example` still includes local mail and Reverb defaults.
- `SESSION_ENCRYPT=false`.
- Secure cookie settings are not clearly production-ready.
- Default seed users use known passwords.

**How to implement:**

- Set production examples for `SESSION_ENCRYPT=true`, `SESSION_SECURE_COOKIE=true`, `SESSION_SAME_SITE=lax` or stricter where compatible, and HTTPS app URLs.
- Keep local-only values in `.env.local.example` if needed.
- Do not run demo seeders in production.
- Create a dedicated production seeder that creates no known-password accounts.
- Require first-login password reset for staff-created accounts.

## Phase 3: Payment And Booking Workflow Correctness

### 1. Formalize Payment Milestones

**Issue:** Payment milestone logic is business-critical and has already caused regressions with rush bookings. It should be centralized, versioned, and tested.

**How to implement:**

- Keep all milestone logic in one service, such as `PaymentCalculationService`.
- Store a payment schedule snapshot on booking creation, including rule version, percentages, labels, due dates, and amounts.
- For rush booking 1, generate an immediate combined reservation/downpayment milestone of 80%, then final 20%.
- For rush booking 2, generate one immediate 100% milestone.
- For standard bookings, generate reservation, downpayment, and final according to the business rules.
- Add database constraints so milestone amounts sum to booking total.
- Add tests for rounding, large totals, zero/invalid totals, rush boundaries, timezone boundaries, and paid/remaining dashboard display.

### 2. Make Booking Creation Transactional

**Issue:** Booking creation and payment schedule creation should succeed or fail together.

**How to implement:**

- Wrap booking creation, payment schedule generation, pricing snapshot creation, and initial audit records in one DB transaction.
- If payment schedule creation fails, roll back the booking.
- Add tests that simulate payment schedule failure and confirm no orphan booking remains.

### 3. Add Expiration And Reconciliation Jobs

**Issue:** Bookings have `expires_at`, but there is no clear scheduled command that expires unpaid bookings. PayMongo callbacks can also be missed or delayed.

**How to implement:**

- Add scheduled commands for:
  - Expiring unpaid bookings after `expires_at`.
  - Sending payment reminders before due dates.
  - Reconciling pending PayMongo checkouts/payment intents.
  - Cleaning abandoned uploads and stale booking drafts.
- Configure production `php artisan schedule:run` every minute.
- Add queue worker monitoring and failed job alerts.

### 4. Protect Status Transitions

**Issue:** Booking status can be changed from multiple controllers. Some transitions, such as cancellation and completion, affect accounting and refunds.

**How to implement:**

- Create a `BookingStatusService` or state machine.
- Define allowed transitions by role and current state.
- Trigger side effects from one place: payment cancellation, refund eligibility, notifications, audit logs, and availability release.
- Add tests for every allowed and rejected transition.

## Phase 4: Database And Scalability

### 1. Add Pagination Everywhere Lists Can Grow

**Issues identified:**

- Some accounting, admin, marketing, chat, customer, and ledger endpoints still return all matching records.
- This will slow down dashboards and increase memory usage as real bookings accumulate.

**How to implement:**

- Paginate all booking, payment, ledger, customer, employee, conversation, message, notification, and audit endpoints.
- Add filters and search indexes for common queries.
- Return resource-shaped responses with pagination metadata.
- Update React pages to use server pagination, infinite scroll, or explicit "Load more" controls.

### 2. Normalize JSON/Text Fields

**Issue:** Several structured fields are stored as encoded text and decoded manually, such as selected menus, outsourced services, and uploads.

**How to implement:**

- Convert structured columns to JSON/JSONB where supported.
- Add model casts.
- Add migration scripts that safely convert existing text JSON.
- Validate JSON shape before saving.
- Add tests for old data compatibility and new data writes.

### 3. Enforce Database Constraints

**How to implement:**

- Add foreign key constraints where missing.
- Add check constraints for positive money amounts, valid percentages, and valid statuses.
- Add unique constraints for provider references and idempotency keys.
- Add indexes for high-traffic dashboard filters:
  - `bookings(user_id, event_date)`
  - `bookings(status, event_date)`
  - `payments(status, due_date)`
  - `payments(booking_id, status)`
  - `chat_messages(conversation_id, created_at)`
  - `notifications(user_id, read_at, created_at)`

### 4. Verify PostgreSQL RLS In Production

**Issue:** Row-level security support exists, but production safety depends on the database role, policies, and session context actually being enforced.

**How to implement:**

- Use a non-owner application DB role that cannot bypass RLS.
- Enable `FORCE ROW LEVEL SECURITY` where appropriate.
- Verify `SetPostgresSessionContext` runs for every request type that touches protected tables.
- Add integration tests that prove one client cannot read another client's bookings directly through queries.

## Phase 5: API Structure And Frontend Performance

### 1. Separate Web Routes From APIs

**Issue:** API-like endpoints are currently defined in `routes/web.php`, mixing session pages, JSON endpoints, public cache APIs, and role APIs.

**How to implement:**

- Move stateless or externally consumed APIs to `routes/api.php`.
- Keep Inertia page routes in `routes/web.php`.
- Use Sanctum or session auth intentionally, not accidentally.
- Add API versioning for stable mobile/external clients, such as `/api/v1/...`.
- Standardize JSON errors and validation responses.

### 2. Add Rate Limits To Public And Expensive Endpoints

**How to implement:**

- Apply throttles to login, register, OTP, PayMongo webhook, availability checks, pricing/menu APIs, chat send, file upload, and checkout initialize.
- Use stricter limits for unauthenticated endpoints.
- Add application-level caching for public catalog data.

### 3. Continue Frontend Bundle And Image Optimization

**Issues identified:**

- Some page chunks remain large, especially booking and admin/dashboard views.
- Seed and marketing content use remote image URLs.

**How to implement:**

- Dynamically import heavy admin charts and modals only when visible.
- Split large dashboard pages into smaller route or panel chunks.
- Self-host production image assets through storage/CDN.
- Generate responsive image sizes and use `loading="lazy"` where appropriate.
- Add width/height or aspect-ratio to prevent layout shifts.
- Keep customer dashboard tab/event selection persistence, but avoid storing sensitive personal data indefinitely in localStorage.

## Phase 6: Observability And Operations

### 1. Add Error Monitoring And Structured Logging

**How to implement:**

- Add Sentry, Bugsnag, or equivalent for backend and frontend errors.
- Use structured logs with request IDs, user IDs, role, route, booking/payment IDs, and provider reference IDs.
- Redact OTPs, passwords, tokens, PayMongo secrets, personal documents, and full payloads containing sensitive data.
- Add alerts for failed payments, failed refunds, webhook failures, queue failures, and scheduler failures.

### 2. Add Health Checks

**How to implement:**

- Create `/health` for app boot status.
- Create `/health/deep` for authenticated/internal checks of database, cache, queue, storage, mail, Reverb, and PayMongo reachability.
- Use deployment probes to restart unhealthy workers.

### 3. Add Backup And Recovery Procedures

**How to implement:**

- Schedule encrypted database backups.
- Backup uploaded private/public storage.
- Test restore regularly in staging.
- Document RPO/RTO targets.
- Keep PayMongo reconciliation reports so payment state can be rebuilt if necessary.

## Phase 7: Testing And QA

The current test coverage is not enough for production payment software.

**Required test suites:**

- Authentication: login, register, OTP, email change, password change, throttling.
- Authorization: client/marketing/accounting/admin permissions for every dashboard and API.
- Booking: ownership, pricing, menu changes, status transitions, availability, expiration.
- Payments: milestone generation, PayMongo checkout initialize, success fallback, webhook signature, duplicate webhook, reconciliation.
- Refunds: full refund, partial refund, failed refund, duplicate refund, cancellation side effects.
- Uploads: MIME validation, private access, signed URL authorization.
- Chat: conversation access, message send, broadcast auth, pagination.
- Dashboard APIs: pagination, filters, paid/remaining totals, empty states.
- Browser/E2E: customer booking flow, payment redirect simulation, accounting verification, admin updates.

**How to implement:**

- Use Laravel feature tests for backend behavior.
- Use model factories for bookings, payments, users, menu items, and packages.
- Mock PayMongo HTTP calls with `Http::fake()`.
- Add Playwright tests for key user journeys.
- Run tests and frontend build in CI before deploy.

## Phase 8: Deployment And Environment Readiness

### 1. Define A Production Deployment Contract

**How to implement:**

- Document required services: PHP-FPM, web server, PostgreSQL, Redis, queue worker, scheduler, storage, mail provider, Reverb/websocket service, and PayMongo credentials.
- Use `composer install --no-dev --optimize-autoloader`.
- Use `npm ci` and `npm run build`.
- Run `php artisan migrate --force`.
- Run `php artisan optimize`.
- Ensure `php artisan storage:link` is configured where public storage is needed.
- Use a zero-downtime deploy strategy if possible.

### 2. Create Separate Environment Templates

**How to implement:**

- Keep `.env.example` generic and safe.
- Add `.env.local.example`, `.env.staging.example`, and `.env.production.example` if helpful.
- Never include real secrets or reusable demo credentials.
- Document which variables are required for each environment.

### 3. Define Staff And Admin Operations

**How to implement:**

- Add staff account lifecycle: invite, activate, suspend, reset password, force logout.
- Add role and permission documentation.
- Add audit views for sensitive actions.
- Add data retention and privacy workflows for real customers.

## Suggested Implementation Order

1. Restore CSRF protection, add rate limits, and remove client-side payment verification.
2. Fix booking ownership and force authoritative server-side pricing for every booking.
3. Add PayMongo webhook/refund idempotency tables and tests.
4. Make booking creation and payment schedule generation transactional.
5. Add scheduler commands for booking expiration, reminders, and payment reconciliation.
6. Harden OTP, passwords, uploads, cookies, environment defaults, and staff account handling.
7. Paginate all growing API reads and add missing database constraints/indexes.
8. Add production queue, scheduler, health checks, monitoring, logs, and backups.
9. Expand automated tests and CI.
10. Finalize deployment documentation and staging validation.

## Production Go/No-Go Checklist

- [ ] CSRF enabled for all session-authenticated API routes except PayMongo webhook.
- [ ] Clients cannot spoof `user_id`, booking totals, payment status, or refund state.
- [ ] Payment schedules are correct and tested for standard, rush booking 1, and rush booking 2.
- [ ] PayMongo webhook and refund flows are idempotent and auditable.
- [ ] Booking creation is transactional.
- [ ] Uploads are MIME-restricted, authorized, and private when sensitive.
- [ ] Login, OTP, checkout, upload, and public APIs are rate-limited.
- [ ] All large dashboard/list endpoints are paginated.
- [ ] Queue workers and scheduler are deployed and monitored.
- [ ] Production `.env` uses secure cookies, encrypted sessions, real mail, Redis, HTTPS, and real PayMongo credentials.
- [ ] Error monitoring, logs, health checks, backups, and restore testing are active.
- [ ] Feature, integration, and E2E tests cover booking, payment, refund, auth, roles, uploads, and chat.

