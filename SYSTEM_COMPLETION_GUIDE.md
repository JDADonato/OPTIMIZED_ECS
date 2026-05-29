# Eloquente System Completion Guide

Created: 2026-05-26
Based on: `FRD.md`, `ratedFRD_2026-05-26.md`, current codebase scan, and test results.

## Goal

Move the system from its current state:

```text
Overall system completion: 80.2 / 100
Functional FRD completion: 84.6 / 100
Production readiness: 72.5 / 100
Demo readiness: 91.0 / 100
```

to a safer launch-ready state of roughly:

```text
Overall system completion: 90%+
Production readiness: 88%+
```

The work should be done in phases. Do not start by adding new features. Finish the high-risk safety, payment, testing, and deployment gaps first.

## Phase 1: Critical Payment Safety

Purpose: make sure customers cannot accidentally or intentionally mark payments as verified without PayMongo or Accounting review.

### Steps

1. Audit the legacy manual payment flow.
   - Check `routes/web.php`.
   - Find `POST /api/bookings/pay`.
   - Check `BookingController::recordPayment`.
   - Check `resources/js/Pages/client/PaymentPage.jsx`.

2. Disable or replace `/api/bookings/pay`.
   - Best option: remove the customer-facing route.
   - Safer fallback: keep the route but change it to create a `Pending Review` proof record only.
   - It must never mark a payment as `Verified`, `Paid`, or settled directly from the customer side.

3. Make PayMongo the primary online payment path.
   - Keep checkout initialization through `PaymentController`.
   - Keep PayMongo webhook as the source of online payment truth.
   - Keep Accounting verification as the source of manual payment truth.

4. If manual payment proof is needed, build a proper review flow.
   - Customer uploads proof.
   - Payment status becomes `Pending Review`.
   - Accounting reviews proof.
   - Accounting approves or rejects.
   - Every action is audited.

5. Test the result manually.
   - Customer cannot mark a payment verified.
   - PayMongo checkout still works.
   - Accounting can still verify valid manual payments.
   - Rejected/manual pending states display clearly to the customer.

### Done When

- `/api/bookings/pay` cannot self-verify a payment.
- The old payment page is removed, hidden, or safely converted.
- Customer payment truth comes only from PayMongo webhook or Accounting review.

## Phase 2: Production Security Hardening

Purpose: remove risky development behavior before real users or real payments.

### Steps

1. Remove OTP logging.
   - Check `app/Http/Controllers/AuthController.php`.
   - Remove lines that log OTP verification codes.
   - Password verification codes in `ProfileController` should also never be logged.

2. Revisit CSRF protection.
   - Check `bootstrap/app.php`.
   - Current risk: `api/*` is broadly excluded from CSRF checks.
   - Keep PayMongo webhook exempt because it uses signature verification.
   - Protect authenticated browser mutation routes where possible.

3. Add route throttling.
   - Login
   - Register
   - OTP verify
   - OTP resend
   - Booking creation
   - Food tasting request
   - Upload routes
   - Checkout initialization
   - Password verification code send

4. Harden upload validation.
   - Use image MIME validation where image upload is expected.
   - Example target rule:

   ```php
   image|mimes:jpg,jpeg,png,webp|max:5120
   ```

5. Guard public endpoints.
   - Confirm public APIs do not expose internal costs, staff data, private booking data, or technical state.

6. Review role middleware coverage.
   - Client routes must stay client-only.
   - Marketing routes must stay Marketing/Admin.
   - Accounting routes must stay Accounting/Admin.
   - Admin routes must stay Admin-only.

### Done When

- OTP codes do not appear in logs.
- Authenticated mutating APIs are protected appropriately.
- Sensitive routes are throttled.
- Uploads accept only intended file types.
- Role access has tests or manual proof.

## Phase 3: Demo Data And Seeder Safety

Purpose: prevent fake analytics and demo clients from entering production.

### Steps

1. Review `database/seeders/DatabaseSeeder.php`.
   - Current risk: it calls `AnalyticsDemoSeeder::class` directly.

2. Add an environment guard.
   - Only seed analytics demo data when `APP_ENV=local`.
   - Refuse to run demo analytics data in `production`.

3. Separate required seed data from demo seed data.
   - Required: roles/default admin if needed, event types, menu items, packages, business rules.
   - Demo only: fake clients, fake bookings, fake payments, analytics volume data.

4. Add a clear command or comment for local demo seeding.
   - Example:

   ```bash
   php artisan db:seed --class=AnalyticsDemoSeeder
   ```

5. Update deployment instructions.
   - Production migrations and seeders must not create fake customers/bookings/payments.

### Done When

- Running the default production seeder cannot insert `demo.eloquente.test` data.
- Demo data is local-only and clearly documented.

## Phase 4: Automated Tests For High-Risk Flows

Purpose: raise confidence before production launch.

Current test status:

```text
php artisan test
24 passed, 116 assertions
```

This is good progress, but the riskiest business flows still need tests.

### Add Tests In This Order

1. Payment safety tests.
   - Customer cannot verify payment through legacy/manual route.
   - Manual proof becomes pending review only.
   - Accounting can verify manual proof.
   - Customer cannot verify another customer's payment.

2. PayMongo webhook tests.
   - Valid signature updates payment.
   - Invalid signature is rejected.
   - Amount mismatch is rejected.
   - Currency mismatch is rejected.
   - Duplicate webhook does not double-pay.

3. Checkout tests.
   - Checkout initialization creates a PayMongo checkout session.
   - Failed checkout does not mark payment paid.
   - Cancelled checkout returns customer safely.
   - Existing paid payment cannot be paid again.

4. Refund tests.
   - Cancelled booking enters refund queue.
   - Refund case is created.
   - PayMongo refund success updates payment and refund case.
   - PayMongo refund failure keeps staff-friendly error state.
   - Non-refundable reservation fee is handled correctly.

5. Role access tests.
   - Client cannot access Marketing, Accounting, or Admin APIs.
   - Marketing cannot access Admin-only employee/customer management.
   - Accounting cannot access Admin-only configuration.
   - Admin can access all staff modules.

6. Booking tests.
   - Create booking with curated package.
   - Create booking with custom menu.
   - Create booking with budget-based menu.
   - Date lock prevents submission.
   - Pax limit prevents submission.
   - Booking update respects lock rules.

7. Reports and CMS tests.
   - Report template create/update/delete.
   - Report export authorization.
   - Announcement draft/publish/archive.
   - Announcement audience targeting.
   - Announcement email queue behavior.

### Done When

- `php artisan test` covers payment, webhook, refund, booking, role, CMS, and report risks.
- Tests pass consistently.
- The test suite is meaningful enough to run before every deployment.

## Phase 5: Status And UX Consistency

Purpose: make customer and staff screens speak the same business language.

### Steps

1. Create shared status display helpers.
   - Booking status mapper.
   - Payment status mapper.
   - Refund status mapper.
   - Live event status mapper.

2. Define customer-facing labels.
   - Use simple words.
   - Avoid raw database states.
   - Example payment labels:
     - `Payment Due`
     - `Being Checked`
     - `Paid`
     - `Overdue`
     - `Refunded`

3. Define staff-facing labels.
   - Staff can see more operational detail.
   - Avoid developer terms.
   - Example payment labels:
     - `Pending`
     - `Checkout Started`
     - `Paid Online`
     - `Verified`
     - `Overdue`
     - `Refunded`
     - `Failed`

4. Apply labels consistently.
   - Customer dashboard
   - Payment page/success/cancelled pages
   - Marketing dashboard
   - Accounting dashboard
   - Admin dashboard
   - Notifications
   - Emails

5. Remove technical labels.
   - Replace labels like `Status Payload`, `Temporal Constraints`, `Comm Link`, and similar wording.

6. Improve error messages.
   - Customers should not see raw validation fields like `package_id`.
   - Map backend validation errors to friendly messages.

### Done When

- One booking/payment state looks consistent across all dashboards.
- Customers never see technical database or developer wording.
- Staff screens use business language.

## Phase 6: Accounting, Refund, And Operations Polish

Purpose: complete the business workflow after booking approval and payment.

### Steps

1. Improve Accounting exception handling.
   - Make reconciliation exceptions clear.
   - Show what staff should do next.
   - Separate provider diagnostics from staff-facing messages.

2. Mature refund cases.
   - Add statuses such as `Requested`, `Approved`, `Processing`, `Refunded`, `Failed`, `Manual Review`.
   - Add reason, approval, notes, provider response, and timeline.
   - Add retry/manual fallback rules.

3. Improve payment reminders.
   - Manual reminders already exist.
   - Add scheduled reminders:
     - before due date
     - on due date
     - after overdue

4. Expand event preparation.
   - Current preparation tasks exist.
   - Add deeper operations tracking:
     - kitchen prep
     - crew/staffing
     - equipment
     - transport
     - setup/readiness
     - event sheet export

5. Improve food tasting workflow.
   - Add staff queue/calendar.
   - Add confirmation/reschedule flow.
   - Add tasting outcome notes.
   - Link outcome to booking review.

6. Improve feedback workflow.
   - Current feedback request/response exists.
   - Add staff review for low ratings.
   - Add testimonial approval if ratings are high.
   - Add retention notes to customer profile.

### Done When

- Accounting can resolve payment exceptions confidently.
- Refunds have a clear case lifecycle.
- Approved bookings move naturally into operations preparation.
- Completed events move naturally into feedback and retention.

## Phase 7: Deployment Readiness

Purpose: prove the system works outside local development.

### Steps

1. Prepare production environment variables.
   - `APP_ENV=production`
   - `APP_DEBUG=false`
   - `APP_URL`
   - production database credentials
   - production mail credentials
   - PayMongo live/test credentials as appropriate
   - Reverb credentials
   - queue/cache/session configuration

2. Verify mail delivery.
   - Registration OTP
   - Password change verification code
   - Payment reminder
   - Announcement test email
   - Announcement publish email

3. Verify queue worker.
   - Mail jobs process.
   - Announcement email jobs process.
   - Failed jobs are visible.

4. Verify PayMongo.
   - Checkout session creation.
   - Successful payment webhook.
   - Failed/cancelled payment behavior.
   - Webhook secret validation.
   - Refund test if PayMongo environment allows it.

5. Verify Reverb/chat.
   - Customer sends message.
   - Staff receives message.
   - Staff claims conversation.
   - Read/unread counts update.
   - Browser console has no connection errors.

6. Verify storage.
   - Run storage link if needed.
   - Profile image uploads display correctly.
   - Uploaded files are not publicly exposing private paths.

7. Run production build.

   ```bash
   npm run build
   ```

8. Run Laravel checks.

   ```bash
   php artisan test
   php artisan route:list --except-vendor
   php artisan config:cache
   php artisan route:cache
   php artisan view:cache
   ```

9. Run manual smoke test.
   - Public pages
   - Register/login/logout
   - Profile photo and password code
   - Booking creation
   - Customer dashboard
   - PayMongo checkout
   - Marketing review
   - Accounting verification/refund
   - Admin users/configuration/reports
   - Announcement publish
   - Chat
   - Notifications

### Done When

- App works on a staging or production-like server.
- Mail, queue, PayMongo, storage, and Reverb are verified.
- Production build passes.
- Smoke test passes from customer and staff roles.

## Phase 8: Launch Gate

Purpose: decide if the system is ready for real users.

### Launch Checklist

1. Critical payment route is safe.
2. OTPs are not logged.
3. Demo seeder is production-guarded.
4. CSRF and throttling are reviewed.
5. Upload validation is hardened.
6. PayMongo checkout and webhook are tested.
7. Mail delivery is tested.
8. Queue worker is running.
9. Reverb/chat is tested.
10. Role access tests pass.
11. Refund workflow is understandable to Accounting.
12. Status labels are consistent.
13. Customer-facing validation messages are friendly.
14. Database backup is configured.
15. Rollback plan exists.
16. Monitoring is configured for:
    - HTTP 500 errors
    - failed jobs
    - failed mail
    - failed PayMongo webhooks
    - disk/storage issues
    - Reverb downtime

### Final Acceptance Rule

The system can be considered launch-ready when:

```text
php artisan test passes
npm run build passes
manual smoke test passes
payment safety issue is closed
production services are verified
no demo data can enter production accidentally
```

## Suggested Work Order

Follow this exact order for best progress:

1. Payment safety
2. OTP/security cleanup
3. Seeder guard
4. CSRF/throttling/upload hardening
5. Payment and role tests
6. PayMongo webhook/refund tests
7. Status label cleanup
8. Accounting/refund polish
9. Operations/feedback polish
10. Staging deployment smoke test
11. Final launch checklist

## Target Completion Milestones

| Milestone | Target Rating | What Must Be True |
|---|---:|---|
| After Phase 1 | 83% overall | Customer self-verification payment risk is removed |
| After Phase 2-3 | 85% overall | Security and demo-data production risks are controlled |
| After Phase 4 | 88% overall | High-risk payment, role, refund, and booking tests exist |
| After Phase 5-6 | 90% overall | Staff/customer workflow is consistent and business-ready |
| After Phase 7-8 | 92%+ overall | Staging/production services are verified and launch checklist passes |
