# Eloquente Catering System Production Deployment Checklist

Generated from a local codebase scan on 2026-05-24. Updated after Phase 7 QA on 2026-05-26.

Stack detected: Laravel 12, PHP 8.2+, Inertia React, Vite, PostgreSQL, Laravel Reverb, Laravel Echo, queued mail/notifications, PayMongo checkout/webhooks, database migrations for jobs/cache/sessions, optional Redis, public storage uploads, role-based dashboards.

Status rule for this checklist:

- `[x]` means the item is already present in the codebase, configured in the application, or verified by a local command during this scan.
- `[ ]` means the item still requires production setup, live credentials, server configuration, manual smoke testing, or additional implementation.

## Current Scan Summary

- [x] `composer validate --strict` passed.
- [x] `npm.cmd run build` passed.
- [x] `php artisan test` passed with high-risk payment, webhook, refund, role, reports, announcements, operations, security, and seeder coverage.
- [x] Route list generated successfully with 172 application routes.
- [x] Announcement CMS routes are shared by `Marketing,Admin`.
- [x] Production-grade feature tests are present for the highest-risk flows.
- [x] Critical security hardening items from Phases 1-3 are complete.

Scan evidence:

- `composer validate --strict`
- `npm.cmd run build`
- `php artisan test`
- `php artisan route:list --except-vendor`
- Code search across `app`, `bootstrap`, `config`, `routes`, `resources`, and `database`
- Migration inventory under `database/migrations`

## Highest Priority Pre-Launch Fixes

- [x] Remove OTP codes from logs before production.
- [x] Add rate limiting to login, register, OTP verify/resend, food tasting, booking creation, upload, and checkout initialization routes.
- [x] Revisit CSRF handling in `bootstrap/app.php`.
  - `api/*` is no longer globally excluded from CSRF.
  - PayMongo webhook remains exempt because it is protected by signature validation.
- [x] Harden upload validation in `app/Http/Controllers/FileUploadController.php`.
  - Current rule accepts only JPG, JPEG, PNG, or WEBP images up to 5 MB.
- [x] Add real automated tests for auth-adjacent security, booking, payment, announcements, role access, refunds, operations, and PayMongo webhook flows.
- [ ] Confirm no development-only `.env` values remain in production.
- [ ] Ensure production web server document root points to `public/`, never the project root.

## Environment Variables

- [x] `.env.example` contains production-oriented placeholders for app, database, Redis, mail, Reverb, and PayMongo settings.
- [ ] Generate and set a production `APP_KEY`.
  - Command: `php artisan key:generate --show`
- [ ] Set `APP_ENV=production`.
- [ ] Set `APP_DEBUG=false`.
- [ ] Set `APP_URL=https://your-real-domain`.
- [ ] Set `LOG_LEVEL=warning` or stricter.
- [ ] Configure production database:
  - `DB_CONNECTION=pgsql`
  - `DB_HOST`
  - `DB_PORT`
  - `DB_DATABASE`
  - `DB_USERNAME`
  - `DB_PASSWORD`
  - `DB_SSLMODE=require` when using Supabase or any managed PostgreSQL that requires TLS.
- [ ] Configure session cookies:
  - `SESSION_SECURE_COOKIE=true`
  - `SESSION_HTTP_ONLY=true`
  - `SESSION_SAME_SITE=lax` or `strict` depending on payment redirects and cross-site needs.
  - `SESSION_DOMAIN=.your-domain.com` only if sharing sessions across subdomains.
- [ ] Configure cache/session/queue backend:
  - Recommended: Redis for `CACHE_STORE`, `SESSION_DRIVER`, and `QUEUE_CONNECTION`.
  - If using database drivers, confirm `cache`, `sessions`, `jobs`, and `failed_jobs` tables exist.
- [x] Laravel config files support database and Redis cache/session/queue drivers.
- [ ] Configure mail provider:
  - Replace `MAIL_HOST=mailpit`.
  - Set SMTP/API credentials.
  - Verify `MAIL_FROM_ADDRESS` uses a domain you control.
  - Configure SPF, DKIM, and DMARC for deliverability.
- [ ] Configure PayMongo live credentials:
  - `PAYMONGO_PUBLIC_KEY`
  - `PAYMONGO_SECRET_KEY`
  - `PAYMONGO_LIVE_PUBLIC_KEY`
  - `PAYMONGO_LIVE_SECRET_KEY`
  - `PAYMONGO_WEBHOOK_SECRET`
  - `PAYMONGO_BASE_URL=https://api.paymongo.com`
  - `PAYMONGO_PAYMENT_METHOD_TYPES=card,gcash,paymaya`
- [x] PayMongo config keys are wired in `config/services.php`.
- [ ] Configure PayMongo CA bundle if needed:
  - `PAYMONGO_CA_BUNDLE=storage/app/cacert.pem`
  - Confirm the file exists on the server, or leave unset if the host has a working CA store.
- [ ] Configure Reverb:
  - `BROADCAST_CONNECTION=reverb`
  - `REVERB_APP_ID`
  - `REVERB_APP_KEY`
  - `REVERB_APP_SECRET`
  - `REVERB_HOST`
  - `REVERB_PORT`
  - `REVERB_SCHEME=https`
  - `VITE_REVERB_APP_KEY`
  - `VITE_REVERB_HOST`
  - `VITE_REVERB_PORT`
  - `VITE_REVERB_SCHEME=https`
- [x] Reverb/Echo client bootstrap is present in `resources/js/bootstrap.js`.
- [ ] Configure storage:
  - `FILESYSTEM_DISK=public` or production cloud disk if moving uploads off local disk.
  - If using local public storage, run `php artisan storage:link`.
- [x] Local and public filesystem disks are configured in `config/filesystems.php`.

## Build And Release Commands

- [ ] Install PHP dependencies:
  ```bash
  composer install --no-dev --prefer-dist --optimize-autoloader
  ```
- [ ] Install Node dependencies:
  ```bash
  npm ci
  ```
- [x] Build frontend assets:
  ```bash
  npm run build
  ```
- [ ] Run migrations:
  ```bash
  php artisan migrate --force
  ```
- [ ] Create storage symlink:
  ```bash
  php artisan storage:link
  ```
- [ ] Cache production config:
  ```bash
  php artisan config:cache
  php artisan route:cache
  php artisan view:cache
  ```
- [ ] Restart application workers:
  ```bash
  php artisan queue:restart
  ```
- [ ] Verify health endpoint:
  ```bash
  curl https://your-domain/up
  ```
- [x] Health endpoint is configured in `bootstrap/app.php` as `/up`.

## Required Long-Running Processes

- [x] Queue configuration exists in `config/queue.php`.
- [x] Reverb is installed and the local `composer dev` script starts `reverb:start`.
- [ ] Web server/PHP-FPM serving the Laravel app.
- [ ] Queue worker for queued mail, notifications, announcements, and future jobs:
  ```bash
  php artisan queue:work --sleep=3 --tries=3 --timeout=90
  ```
- [ ] Laravel Reverb process for chat/realtime updates:
  ```bash
  php artisan reverb:start
  ```
- [ ] Process supervisor configured for queue workers and Reverb.
  - Use Supervisor, systemd, Forge daemon, Ploi daemon, Render background worker, Railway service, or equivalent.
- [ ] Scheduler entry, even though no custom scheduled tasks are currently defined:
  ```cron
  * * * * * cd /path/to/app && php artisan schedule:run >> /dev/null 2>&1
  ```

## Web Server Checklist

- [x] Laravel `public/` directory exists and contains built frontend assets under `public/build`.
- [ ] Document root is `/public`.
- [ ] HTTPS enabled and HTTP redirects to HTTPS.
- [ ] TLS certificate auto-renewal configured.
- [ ] Static assets served with compression and long cache headers:
  - `/build/*`
  - `/images/*`
  - `/storage/*`
- [ ] Upload size limit supports the app requirement of 5 MB image uploads.
- [x] Application upload validation currently enforces a 5 MB max file size.
- [ ] Reverse proxy supports WebSocket upgrade for Reverb.
- [ ] PHP-FPM or equivalent is configured with enough workers for expected traffic.
- [ ] Server denies direct access to:
  - `.env`
  - `storage/`
  - `bootstrap/cache/`
  - `vendor/`
  - `node_modules/`
  - `database/`

## Database Checklist

- [ ] Use a dedicated production database, not the local/dev database.
- [ ] Run `php artisan migrate --force` once before traffic cutover.
- [x] Confirm these core table migrations exist in the codebase:
  - `users`
  - `bookings`
  - `payments`
  - `food_tastings`
  - `menu_items`
  - `packages`
  - `event_types`
  - `notifications`
  - `messages`
  - `conversations`
  - `announcements`
  - `announcement_reads`
  - `announcement_recipients`
  - `report_templates`
  - `report_runs`
  - `audit_logs`
  - `cache`
  - `sessions`
  - `jobs`
  - `failed_jobs`
- [x] Supabase/PostgreSQL RLS policy migrations are present in the codebase.
- [ ] If using Supabase/PostgreSQL RLS, verify migrations for RLS and policies have applied successfully on production.
- [ ] Confirm Laravel DB user permissions are enough for app reads/writes, migrations, locks, and queues.
- [ ] Enable daily backups and test restoring one backup.
- [ ] Define retention for audit logs, sessions, cache, failed jobs, and old notifications.
- [ ] Confirm timezone handling for event dates, payment due dates, and announcement start/end windows.

## PayMongo Checklist

- [ ] Switch to live PayMongo keys.
- [ ] Register webhook URL:
  ```text
  https://your-domain.com/webhook/paymongo
  ```
- [ ] Store the live `PAYMONGO_WEBHOOK_SECRET`.
- [x] Webhook signature validation is implemented in `PayMongoWebhookController`.
- [x] Webhook timestamp tolerance is configurable:
  - `PAYMONGO_WEBHOOK_TOLERANCE=300`
- [ ] Perform a small live or PayMongo-approved production test payment.
- [x] Webhook processing updates matched payments to `Paid` and records PayMongo references.
- [x] Amount/currency mismatch rejection is implemented.
- [x] Duplicate paid webhook handling is guarded by existing `Paid`/`Verified` status checks.
- [x] Refund flow routes exist for accounting/admin and are role-protected.
- [ ] Remove ngrok-only workflow from production operations.
  - `app/Console/Commands/PayMongoWebhookSync.php` is useful for local testing but should not be part of production deployment.

## Mail And Notifications Checklist

- [ ] Replace Mailpit with a real mail provider.
- [x] Registration OTP email sending is implemented.
- [x] Resend OTP email sending is implemented.
- [x] Payment reminder email/notification flow is implemented.
- [x] Announcement test email flow is implemented.
- [x] Announcement publish email delivery is implemented when `send_email` is enabled.
- [ ] Confirm queue worker processes mail jobs.
- [x] `failed_jobs` migration exists for failed queue job visibility.
- [x] Remove OTP code logging before launch.

## Realtime Chat And Broadcasting Checklist

- [ ] Configure Reverb production host and TLS.
- [x] `resources/js/bootstrap.js` reads `VITE_REVERB_*` values at build time.
- [x] Private channels in `routes/channels.php` are implemented:
  - `conversation.{conversationId}`
  - `staff.queue`
  - `marketing.dashboard`
  - `accounting.dashboard`
  - `client.{userId}`
- [x] Client chat UI and send-message flow are implemented.
- [x] Staff queue Echo listeners are implemented.
- [x] Payment processed broadcast event is implemented.
- [ ] Confirm browser console has no Reverb/Echo connection errors on HTTPS.

## Security Checklist

- [ ] No `.env` secrets committed or deployed to public web root.
- [ ] Rotate any credentials that were ever used in development screenshots, logs, or shared files.
- [ ] `APP_DEBUG=false`.
- [ ] Session cookie is secure on HTTPS.
- [x] Add route throttling to public forms and auth endpoints.
- [x] Restore CSRF protection for authenticated mutating API routes where possible.
- [x] PayMongo webhook is exempt from CSRF and protected by signature validation.
- [x] Enforce file MIME restrictions on uploads.
- [ ] Consider antivirus or image re-encoding for uploads.
- [ ] Add Content Security Policy after confirming external image/font/payment requirements.
- [x] Staff routes are role-protected:
  - Admin dashboard: `Admin`
  - Marketing dashboard: `Marketing,Admin`
  - Accounting dashboard: `Accounting,Admin`
  - Announcement CMS: `Marketing,Admin`
- [x] Clients are blocked from staff route groups by `auth` and `role` middleware.
- [x] Staff role separation is implemented with `role` middleware route groups.
- [ ] Disable or protect development commands on production hosts.
- [x] Public unauthenticated endpoints were identified in `routes/web.php`:
  - `/api/menu`
  - `/api/menu-items`
  - `/api/packages`
  - `/api/event-types`
  - `/api/pricing`
  - `/api/announcements`
  - `/api/bookings/availability/{date}`
  - `/api/bookings/disabled-dates`
  - `/api/food-tasting`
- [ ] Ensure public endpoints do not leak internal costs, staff data, customer data, or private booking details.

## Feature Smoke Test Checklist

Checked items in this section mean the route, controller, component, or integration flow exists in the system. They should still be manually smoke-tested after deployment.

### Public Website

- [x] Home page route/component exists.
- [x] About page route/component exists.
- [x] Amenities page route/component exists.
- [x] Menu page route/component exists and menu data endpoints are present.
- [x] Food tasting form route/API exists.
- [x] Booking wizard route/component exists.
- [x] Public package/event/menu endpoints exist.
- [x] Homepage announcement rendering and public announcement endpoint exist.

### Authentication

- [x] Client registration flow exists.
- [x] OTP email flow exists.
- [x] OTP verification flow exists.
- [x] Client login/redirect flow exists.
- [x] Logout flow exists.
- [x] Marketing login/redirect flow exists.
- [x] Accounting login/redirect flow exists.
- [x] Admin login/redirect flow exists.
- [x] Invalid login attempts are rate-limited.

### Booking Flow

- [x] Client booking creation route/controller exists.
- [x] Client dashboard booking data route exists.
- [x] Marketing booking view/status update routes exist.
- [x] Booking availability endpoint exists.
- [x] Disabled dates endpoint exists.
- [x] Event details update route exists.
- [x] Menu update route exists.
- [x] Cancellation route exists.
- [x] Booking history removal route exists.

### Payment Flow

- [x] Payment checkout initialization route/controller exists.
- [x] PayMongo checkout URL creation is implemented.
- [x] Successful payment page route exists.
- [x] Cancelled payment page route exists.
- [x] Webhook local payment update is implemented.
- [x] Accounting manual payment verification route exists.
- [x] Payment reminder flow exists.
- [x] Refund queue routes exist for accounting/admin.

### CMS Announcements

- [x] Marketing draft announcement route/UI exists.
- [x] Marketing publish announcement route/UI exists.
- [x] Admin create/publish announcement route/UI exists.
- [x] Published all-customer announcement homepage flow exists.
- [x] Targeted authenticated customer announcement flow exists.
- [x] Archive route removes announcements from public visibility.
- [x] Start/end date visibility scope exists.
- [x] Test email route/UI exists.

### Staff Dashboards

- [x] Admin dashboard summary/analytics routes exist.
- [x] Admin analytics filter UI exists.
- [x] Marketing event pipeline route/UI exists.
- [x] Marketing catalog/configuration routes/UI exist.
- [x] Accounting ledger route/UI exists.
- [x] Accounting payment queue route/UI exists.
- [x] Reports widgets/templates/run/export routes exist.
- [x] Staff audit log middleware/model/routes exist.

### Chat And Notifications

- [x] Client chat start flow exists.
- [x] Staff unassigned chat queue exists.
- [x] Staff claim chat flow exists.
- [x] Message broadcast/listener code exists.
- [x] Notification badge component/API exists.
- [x] Read-all notifications route exists.

## Automated Test Coverage

- [x] Auth/security tests:
  - Registration and OTP email do not log secret codes.
  - Resend OTP does not log secret codes.
  - Invalid login attempts are rate-limited.
- [x] Authorization tests:
  - Client cannot hit staff APIs.
  - Marketing cannot hit admin-only employee/customer APIs.
  - Accounting can hit accounting APIs.
- [x] Booking and availability tests:
  - Availability conflict.
  - Capacity and disabled-date rejection.
  - Operations handoff and feedback creation.
- [x] Payment tests:
  - Checkout initialization.
  - PayMongo webhook valid signature.
  - PayMongo webhook invalid signature.
  - Amount mismatch rejection.
  - Idempotent duplicate webhook.
- [x] CMS announcement tests:
  - Draft.
  - Publish.
  - Archive.
  - Customer targeted visibility.
- [x] Upload tests:
  - Accept valid image.
  - Reject non-image file.
- [x] Report tests:
  - Template create/update/delete.
  - Report run/export authorization.

## Monitoring And Operations

- [ ] Centralize logs.
- [ ] Alert on HTTP 500 spikes.
- [ ] Alert on queue failures.
- [ ] Alert on failed PayMongo webhook processing.
- [ ] Alert on failed mail delivery.
- [ ] Monitor database connections and slow queries.
- [ ] Monitor disk space, especially `storage/`.
- [ ] Monitor Reverb process uptime.
- [ ] Define incident response contacts.
- [ ] Define payment reconciliation procedure.
- [ ] Define refund approval procedure.

## Backup And Recovery

- [ ] Daily automated database backups.
- [ ] Backup uploaded files if using local storage.
- [ ] Test restore into a staging database.
- [ ] Document restore steps.
- [ ] Keep a rollback-ready copy of the previous release.
- [ ] Use `php artisan down --secret=...` during risky migrations if needed.
- [ ] Verify `php artisan up` after maintenance.

## Deployment Runbook

These items stay unchecked until they are executed against the real production server/release.

1. [ ] Put app in maintenance mode if replacing an existing production release:
   ```bash
   php artisan down --secret="temporary-bypass-token"
   ```
2. [ ] Pull or upload the release.
3. [ ] Install dependencies:
   ```bash
   composer install --no-dev --prefer-dist --optimize-autoloader
   npm ci
   ```
4. [ ] Build frontend:
   ```bash
   npm run build
   ```
5. [ ] Verify `.env` production values.
6. [ ] Run database migrations:
   ```bash
   php artisan migrate --force
   ```
   If baseline catalog/config data must be seeded, run only the guarded default seeder:
   ```bash
   php artisan db:seed --force
   ```
   Do not run `php artisan db:seed --class=AnalyticsDemoSeeder` on staging or production. That command is local-only demo data for analytics screenshots and test dashboards.
7. [ ] Link storage:
   ```bash
   php artisan storage:link
   ```
8. [ ] Cache framework files:
   ```bash
   php artisan config:cache
   php artisan route:cache
   php artisan view:cache
   ```
9. [ ] Restart PHP-FPM/web service.
10. [ ] Restart queue workers:
    ```bash
    php artisan queue:restart
    ```
11. [ ] Restart Reverb.
12. [ ] Bring app back online:
    ```bash
    php artisan up
    ```
13. [ ] Run smoke tests from this checklist.
14. [ ] Watch logs during the first production hour.

## Rollback Checklist

- [ ] Keep previous release directory or artifact.
- [ ] Know whether migrations are backward-compatible before deploy.
- [ ] If rollback is needed:
  - [ ] Put app in maintenance mode.
  - [ ] Switch symlink or redeploy previous artifact.
  - [ ] Restore previous `.env` if changed.
  - [ ] Run rollback migration only if safe and planned.
  - [ ] Clear and rebuild caches.
  - [ ] Restart workers and Reverb.
  - [ ] Verify payment webhooks still point to the active release.

## Final Go-Live Gate

- [ ] All high priority pre-launch fixes completed.
- [ ] Production `.env` reviewed by owner.
- [ ] Database backup completed.
- [ ] PayMongo live webhook verified.
- [ ] Mail delivery verified.
- [ ] Queue worker verified.
- [ ] Reverb verified over HTTPS.
- [ ] Public booking flow verified.
- [ ] Staff dashboards verified.
- [ ] Payment flow verified.
- [ ] Security smoke tests completed.
- [ ] Monitoring and rollback plan ready.
