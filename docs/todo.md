# Remaining Work

This file consolidates the still-useful remaining work from the old documentation set. Items that were outdated, already done, or not worth doing anymore were intentionally left out.

## 1. Production Payment And Refund Verification

### PayMongo End-To-End Test

Run a full payment test using the current PayMongo setup.

Steps:

1. Start the local app with the expected `APP_URL`.
2. Start ngrok or another public HTTPS tunnel.
3. Run the PayMongo webhook sync command or confirm the webhook manually in PayMongo.
4. Make a test checkout payment for each milestone:
   - reservation/immediate milestone
   - down payment/progress milestone
   - final milestone
5. Confirm PayMongo sends a signed webhook.
6. Confirm Laravel returns `200`.
7. Confirm `payments.status` changes to `Paid`.
8. Confirm booking status/live status/milestone state advances correctly.
9. Send a fake unsigned webhook and confirm it returns `401`.

Done when:

- Browser redirect works.
- Webhook is received and verified.
- Database payment and booking records update only from webhook confirmation.
- Failed/abandoned payments remain pending.

### Refund Test

Run a real test-mode refund against a PayMongo-paid payment.

Done when:

- Refund is created through PayMongo when provider payment ids exist.
- Local payment records are marked refunded only after PayMongo succeeds.
- Missing provider ids show clear staff-facing errors.
- Non-refundable reservation fee handling is correct.

## 2. Email And Notification Verification

The notification classes and announcement email flow exist, but production email behavior still needs real environment verification.

Tasks:

1. Configure production or staging SMTP credentials.
2. Send a test announcement email.
3. Create a booking and confirm staff receives the new booking notification.
4. Approve/reject a booking and confirm the client receives the right notification.
5. Send payment reminders and confirm email plus in-app behavior.
6. Check failed email handling in `storage/logs/laravel.log`.

Done when:

- Emails are delivered through the configured mail provider.
- Failed mail attempts are visible in logs.
- Staff can trust announcement and reminder sends.

Production operations checklist:

- Queue worker is running for queued email and notification jobs.
- Laravel scheduler is running so due announcements publish and event lifecycle jobs execute.
- Reverb is running for realtime chat updates.
- PayMongo webhook endpoint is reachable over HTTPS and signature verification is enabled.
- Mail delivery has been verified with real sender/domain credentials.

## 3. Browser Role Smoke Tests

Run a real browser pass after the latest backend and dashboard changes.

Test accounts/roles:

- Admin
- Marketing
- Accounting
- Client

Check each role:

1. Login redirects to the correct dashboard.
2. Dashboard loads without Inertia JSON errors.
3. Main tabs load without console 500 errors.
4. Navigation still works after refresh.
5. Notifications render.
6. Logout works.

Admin-specific checks:

- Analytics tab loads.
- Reports tab loads.
- Report preview works.
- Report template save works.
- CSV export downloads.

Marketing-specific checks:

- Calendar/booking list loads.
- Booking status changes work.
- Kitchen prep/export flow still handles `selected_menu` as array or legacy string.

Accounting-specific checks:

- Payment verification list loads.
- Ledger loads.
- Pending/complete filters work.
- Refund queue loads.

Client-specific checks:

- Booking wizard works.
- Dashboard remembers last event and tab.
- Payment section reflects paid and pending states.

## 4. Full Dashboard Component Split

The API and response foundations were added, but the large dashboard files still need a deeper component split.

Recommended order:

1. Split Admin dashboard tabs first:
   - dashboard overview
   - analytics
   - reports
   - configuration
   - users
   - bookings
   - refunds
   - audits
   - content
2. Split Accounting dashboard:
   - bookings/payments
   - ledger
   - refunds
3. Split Marketing dashboard:
   - calendar
   - bookings
   - settings
   - content
4. Split Client dashboard:
   - overview/status
   - details
   - menu
   - payments
   - messages
5. Lazy-load heavy tabs such as analytics, reports, and charts.
6. Extract shared dashboard shell, toolbar, pagination, table, and empty-state components.

Done when:

- Each dashboard file becomes mostly orchestration/state.
- Heavy tabs are loaded only when needed.
- Shared dashboard UI is reused instead of copied.

## 5. Server Pagination Rollout

Several endpoints now support opt-in pagination, but some screens still load legacy array responses for compatibility.

Tasks:

1. Switch admin users/customers/bookings screens to request `paginated=1`.
2. Switch marketing booking views to server pagination where the UI is list-based.
3. Switch accounting ledger to server pagination in the UI.
4. Add search/sort/filter controls where missing.
5. Keep calendar-style views optimized for date ranges rather than full-table loads.

Done when:

- Large tables no longer load all records at once.
- Pagination controls are driven by backend metadata.
- Existing filters continue to work.

## 6. Layout And File Structure Cleanup

The style reference identified structure issues that are still useful to resolve.

Tasks:

1. Consolidate duplicate client layout locations:
   - `resources/js/Layouts/ClientLayout.jsx`
   - `resources/js/Components/layout/ClientLayout.jsx`
2. Verify and remove unused routed pages/components only after confirming route usage:
   - `DashboardClient.jsx`
   - `client/ClientOverview.jsx`
   - `client/PackageCustomizer.jsx`
   - `PackageSelector.jsx`
   - `BudgetEstimator.jsx`
3. Normalize import casing so Windows-only casing mistakes do not fail on Linux deployments.
4. Keep `resources/js/app.jsx` as the active Vite entry unless the build config changes.

Done when:

- There is one client layout source of truth.
- Unused components are removed safely.
- Case-sensitive builds are less likely to fail.

## 7. Production Readiness Checks

Run these before real users use the system.

Tasks:

1. Change seeded/default passwords.
2. Confirm `.env` contains no test secrets in production.
3. Confirm real PayMongo keys and webhook secrets are configured.
4. Confirm mail credentials are configured.
5. Run migrations on the production database.
6. Run `npm.cmd run build`.
7. Run Laravel tests.
8. Confirm storage permissions for uploads and logs.
9. Confirm backup plan for Supabase/Postgres.
10. Monitor logs during first real booking and first real payment.

Done when:

- Real credentials are set.
- Test credentials are removed or locked down.
- Payments, refunds, email, booking, and dashboards have all passed a live/staging smoke test.

## 8. Future Feature Work Worth Keeping

These are still useful product improvements, but they should come after payment, email, pagination, and dashboard structure are stable.

- Customer post-event feedback form and email request.
- More actionable analytics filters and saved analytics views.
- More report widgets after the first report builder is stable.
- Scheduled commands for:
  - unpaid booking expiration
  - payment reminders
  - PayMongo reconciliation
  - feedback requests
  - scheduled announcement publishing
