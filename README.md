# Eloquente Catering System

Eloquente Catering System is a Laravel 12, Inertia, React, and Vite application for managing catering inquiries, bookings, customer dashboards, staff workflows, payments, documents, chat, feedback, account lifecycle actions, and operational audit logs.

The app is built for four main roles:

| Role | Main workspace |
| --- | --- |
| Customer | Booking details, menu choices, payments, receipts, chat, feedback, and account settings |
| Marketing | Booking intake, customer coordination, event handoff, calendar, public content, availability, messages, and event history |
| Accounting | Payment verification, overdue balances, exceptions, refunds, receipts, ledger, and finance history |
| Admin | Role-based access to Admin, Customer, Marketing, and Accounting workspaces, plus accounts, reports, settings, audit, and cross-role controls |

## Tech Stack

| Layer | Technology |
| --- | --- |
| Backend | Laravel 12, PHP 8.2+ |
| Frontend | React 19, Inertia.js, Tailwind CSS |
| Database | PostgreSQL, usually Supabase for shared testing |
| Payments | PayMongo checkout and webhooks |
| Realtime | Laravel Reverb, Laravel Echo, Pusher protocol |
| Email/Jobs | Laravel notifications and queue workers |
| Documents | Dompdf + Blade branded PDF exports |
| Build tool | Vite 7 |

## Prerequisites

This repository includes a portable PHP runtime and `composer.phar`, so global PHP and Composer are not required for normal Windows development.

Install these separately:

| Tool | Version |
| --- | --- |
| Node.js | 18 or newer |
| Git | Current stable |
| ngrok | Optional, needed for PayMongo webhook testing |

## First-Time Setup

Clone and enter the repository:

```powershell
git clone https://github.com/JDADonato/OPTIMIZED_ECS.git
cd DAREVECS-main
```

Install dependencies:

```powershell
.\composer.bat install
npm install
```

Create your environment file:

```powershell
Copy-Item .env.example .env
.\php\php.exe artisan key:generate
```

Update `.env` for local development. At minimum, check these values:

```env
APP_ENV=local
APP_DEBUG=true
APP_URL=http://127.0.0.1:8080

DB_CONNECTION=pgsql
DB_HOST=your-supabase-host
DB_PORT=6543
DB_DATABASE=postgres
DB_USERNAME=your-username
DB_PASSWORD=your-password
DB_SSLMODE=require

SESSION_DRIVER=database
QUEUE_CONNECTION=database
CACHE_STORE=file

MAIL_MAILER=log
MAIL_FROM_ADDRESS=hello@eloquente.test
MAIL_FROM_NAME="${APP_NAME}"

VITE_REVERB_ENABLED=false
```

For shared Supabase testing, use port `6543` unless the team lead gives you a different connection mode.

Run pending migrations against the configured database:

```powershell
.\php\php.exe artisan migrate
```

Use `migrate` when setting up a new laptop or device that connects to an existing shared Supabase database. It applies only missing database structure changes, such as new tables, columns, and indexes. It does not delete bookings, accounts, or analytics records.

Only run migrations with seeders when the database is brand new or intentionally empty:

```powershell
.\php\php.exe artisan migrate --seed
```

`--seed` runs the baseline data setup for default accounts, event types, menu items, packages, and business rules. It is not required every time you set up another device against the same Supabase database.

Build once to verify frontend dependencies:

```powershell
npm.cmd run build
```

## Daily Development Startup

Use one PowerShell window from the repo root:

```powershell
.\refresh.bat
```

This starts:

| Service | Default URL/port | Purpose |
| --- | --- | --- |
| Laravel server | http://127.0.0.1:8080 | Main app |
| Vite | http://localhost:5173 | Frontend dev assets |
| Queue listener | background | Emails and queued notifications |
| Reverb | ws://localhost:8085 | Realtime chat and live refresh hints, if enabled |

Keep the terminal open while testing.

Press `Ctrl+C` in that same terminal to stop Laravel, Vite, the queue listener, and Reverb together.

You can also run the same refresh script through npm:

```powershell
npm.cmd run refresh
```

If you run `.\refresh.ps1` directly and PowerShell says the file is not digitally signed, use `.\refresh.bat` or `npm.cmd run refresh`. Those wrappers run the project script with a per-command execution policy bypass and do not change your Windows security settings globally.

Use `http://127.0.0.1:8080` consistently while testing. Avoid mixing `localhost`, `[::1]`, and `127.0.0.1`, because switching hosts can make browser session cookies and CSRF tokens look stale.

If Vite asset requests fail with `ERR_CONNECTION_REFUSED`, the Vite dev server is not running. Start the app with `.\composer.bat run dev`, or build static assets with:

```powershell
npm.cmd run build
```

## Restart And Reset Instructions

### Restart Laravel/Vite/Reverb Cleanly

If the app gets stuck after code changes, use the one-command refresh:

```powershell
.\refresh.bat
```

The script stops the usual local dev ports for this app, clears Laravel caches, and restarts Laravel, Vite, the queue listener, and Reverb in one terminal.

Fallback manual commands:

```powershell
Get-Process php -ErrorAction SilentlyContinue | Stop-Process -Force
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force
.\php\php.exe artisan optimize:clear
.\composer.bat run dev
```

If PowerShell asks for confirmation when stopping Node during the fallback flow, press `A` for "Yes to All".

### Reset Laravel Caches Only

Use this when routes, config, sessions, or views feel stale:

```powershell
.\php\php.exe artisan optimize:clear
.\php\php.exe artisan config:clear
.\php\php.exe artisan route:clear
.\php\php.exe artisan view:clear
```

### Reset Frontend Build Artifacts

Use this when the browser is loading old compiled files:

```powershell
npm.cmd run build
```

Then hard-refresh the browser.

### Reset A Local Database

Only do this on a local database that you own. This deletes existing app data.

```powershell
.\php\php.exe artisan migrate:fresh --seed
```

Do not run `migrate:fresh` against a shared Supabase database unless the whole group agrees. It will drop tables and remove everyone else's test data.

### Reset A Test Staff Password

Use the Admin dashboard:

1. Sign in as an Admin.
2. Open `Accounts`.
3. Open the staff/admin account action menu.
4. Choose `Reset temporary password`.
5. Copy the temporary password from the modal.
6. The affected user signs in and is forced to create a new password.

Temporary passwords are time-limited, can be revealed again by Admin only while still valid, and are cleared after the user changes their password.

### Reset A Stuck Forced-Password Session

If a temporary-password user is stuck on the password update page:

1. Use the `Back to sign in` action on the page.
2. If needed, clear app caches:

```powershell
.\php\php.exe artisan optimize:clear
```

3. Restart the dev services.
4. Sign in again with the latest temporary password.

## Email And Queue Behavior

For local testing, `MAIL_MAILER=log` writes emails to Laravel logs instead of sending real inbox messages.

If `.env` uses a real SMTP provider and `QUEUE_CONNECTION=database`, queued emails require the queue worker. `.\composer.bat run dev` starts the queue listener automatically.

Common email statuses:

| Status | Meaning |
| --- | --- |
| sent | The mailer accepted the email immediately |
| queued | The email is waiting for the queue worker |
| skipped_no_email | The target account has no email address |
| failed | The app attempted delivery but the mailer failed |
| mail_not_configured | Required mail settings are missing |

Admin can check mail/session health from Admin Settings and system/preflight areas.

## Scheduled Jobs And Live Updates

The app has scheduled and background work that must run outside normal page requests:

| Command or service | Purpose |
| --- | --- |
| `php artisan schedule:run` | Runs due scheduled tasks in production |
| `php artisan queue:work` | Sends queued mail, notifications, and background jobs |
| `php artisan reverb:start` | Enables realtime chat and operational refresh hints when Reverb is enabled |
| `php artisan announcements:publish-due` | Publishes scheduled announcements and queues announcement emails |
| `php artisan uploads:purge-orphans` | Discards unattached temporary uploads after their expiry window |

Realtime events are treated as refresh hints only. The frontend still uses cached polling/focus refresh fallbacks, so a missed websocket event should not require users to reload manually.

## PayMongo Testing

Set the PayMongo keys in `.env`:

```env
PAYMONGO_PUBLIC_KEY=pk_test_...
PAYMONGO_SECRET_KEY=sk_test_...
PAYMONGO_WEBHOOK_SECRET=
PAYMONGO_CA_BUNDLE=storage/app/cacert.pem
```

Download the CA bundle if it is missing:

```powershell
Invoke-WebRequest -Uri "https://curl.se/ca/cacert.pem" -OutFile "storage\app\cacert.pem"
```

For local or staging webhook testing, start the app, then run in another PowerShell window:

```powershell
.\php\php.exe artisan paymongo:webhook-sync
```

Useful options:

```powershell
.\php\php.exe artisan paymongo:webhook-sync --no-disable-old
.\php\php.exe artisan paymongo:webhook-sync --ngrok-path C:\path\to\ngrok.exe
```

The command is guarded in production. If it is ever intentionally used there, it requires:

```powershell
.\php\php.exe artisan paymongo:webhook-sync --force-production
```

If multiple teammates share the same PayMongo test account, only the latest synced ngrok URL receives webhooks unless `--no-disable-old` is used.

## Generated Documents

Generated PDFs use branded Blade templates rendered through Dompdf. Current document exports include:

| Document | Route |
| --- | --- |
| Payment receipt | `/documents/payments/{payment}/receipt.pdf` |
| Event preparation checklist | `/documents/bookings/{booking}/preparation.pdf` |
| Calendar export | `/documents/calendar.pdf` |
| Management report PDF | `/api/admin/report-runs/{run}/export?format=pdf` |
| Management report CSV | `/api/admin/report-runs/{run}/export?format=csv` |

See `docs/document-inventory.md` for ownership, audience, renderer, limits, and test coverage.

## Default Seed Accounts

After seeding, typical local demo accounts are:

| Role | Username | Password | Dashboard |
| --- | --- | --- | --- |
| Admin | `admin` | `password123` | `/dashboard/admin` |
| Marketing | `marketing` | `password123` | `/dashboard/marketing` |
| Accounting | `accounting` | `password123` | `/dashboard/accounting` |
| Client | `client` | `password123` | `/dashboard/client` |

New staff/admin accounts created through Admin use generated temporary passwords instead of a shared default password.

## Important Features

- Customer booking flow with event details, menu planning, payment schedule, receipts, chat, and feedback.
- Marketing workspace with Today, Bookings, Guest Inquiries, Calendar, Event Handoff, Messages, Public Content, Availability, and Event History.
- Accounting workspace with Today, Payments, Refunds, Ledger & Receipts, and Event History.
- Admin role-based workspace access for Admin, Customer, Marketing, and Accounting modules without silent impersonation.
- Admin navbar search for pages, customer accounts, staff accounts, and booking contacts, with assisted navigation into the matching workspace.
- Customer account versus booking contact labeling so account/support screens lead with the registered account while booking, payment, and handoff workflows lead with the booking contact.
- Branded server-generated PDFs for receipts, prep lists, calendar reports, and reports.
- Modern staff chat with compact inbox queues, cached thread reopening, optimistic sending, moderation feedback, customer helper shortcuts, remembered conversation/filter selection, message grouping, and CSRF-safe requests.
- Notification center with New/Read tabs, explicit mark-read/delete-read actions, time grouping, and customer-aware redirects.
- Account safety features including deactivation, reactivation, temporary password reset, forced password change, forgot password, OTP hashing, and audit entries.
- Detailed System & Audit trail that records who acted, what changed, where it happened, the affected record, changed fields, device, and network context without storing sensitive values.
- Operational lifecycle preservation: customer history hiding, catalog archiving, payment schedule voiding, refund case actions, guest lead/tasting lifecycle states, and upload ownership/cleanup.
- Live operational UI with Reverb hints, cached polling fallback, quiet sync states, compact notification feedback, and notification sound opt-in.
- Admin full-surface workspace pattern, collapsible staff sidebar, role-local settings, and reusable operational UI components.
- Security headers, CSP report mode for development, production preflight checks, PostgreSQL guardrails, and environment diagnostics.

## Documentation Map

Old handoff, scratch-plan, and outdated rating files were removed after their still-useful details were folded into the current documentation set.

| File | Purpose |
| --- | --- |
| `README.md` | Setup, startup, features, troubleshooting, and production notes |
| `FRD.md` | Functional requirements baseline |
| `latestratedFRD.md` | Latest requirement completion rating |
| `testcase.md` | End-to-end and role-based test cases |
| `instructions.md` | Manual workflow walkthrough for testing |
| `QA.md` | Consolidated QA result summary |
| `docs/completed.md` | Durable summary of completed work |
| `docs/todo.md` | Remaining production and cleanup work |
| `docs/rulesforstaffui.md` | Staff/Admin UI design rules |
| `docs/overhaulstaffui.md` | Staff UI overhaul reference |
| `docs/document-inventory.md` | Generated document ownership and route inventory |
| `docs/backend-surface-audit.md` | Backend surface notes |
| `tablerules.md` | Shared table layout and alignment rules |

## Staff UI Guidelines

Admin and staff interfaces follow the rules in `docs/rulesforstaffui.md`.

Key points:

- Operational Admin tabs should use the page itself as the work surface, not nested card containers.
- Page headers should not be repeated inside the tab body.
- Tables should follow `tablerules.md`: centered headers, body alignment by data type, left-aligned money, centered actions, and responsive spacing that avoids unnecessary desktop horizontal scroll.
- Normal live/saved/syncing states should be quiet; offline, stale, failed, and blocking loading states should be visible.
- Use consistent action wording such as `Open`, `Save changes`, `Archive`, `Deactivate access`, `Hide from my history`, `Download PDF`, and `Download spreadsheet`.

## Verification Commands

Run these before pushing important changes:

```powershell
npm.cmd run build
.\php\php.exe artisan test
.\php\php.exe artisan preflight:scan --json
.\php\php.exe artisan route:list --except-vendor
git diff --check
```

Line-ending warnings such as `CRLF will be replaced by LF` are Git normalization warnings, not code failures.

## Troubleshooting

### CSRF token mismatch or 419

Use a single host consistently while testing. Do not mix `localhost`, `127.0.0.1`, and `[::1]` in the same session.

Recommended local URL:

```text
http://127.0.0.1:8080
```

Then restart and clear caches:

```powershell
.\php\php.exe artisan optimize:clear
.\composer.bat run dev
```

### Reverb WebSocket errors

If realtime is not needed locally, keep:

```env
VITE_REVERB_ENABLED=false
```

If realtime is needed, run the app through `.\composer.bat run dev` so Reverb starts on port `8085`.

### Boolean database errors on PostgreSQL

Make sure the latest code is pulled and migrations are applied:

```powershell
git pull
.\php\php.exe artisan migrate
```

The app casts boolean fields for PostgreSQL, but old code or missing migrations can still cause `boolean = integer` or datatype mismatch errors.

### Emails say queued but no inbox message arrives

Start the queue worker or use the normal dev command:

```powershell
.\composer.bat run dev
```

For local non-SMTP testing, set:

```env
MAIL_MAILER=log
QUEUE_CONNECTION=sync
```

### Payment succeeded but app still says pending

Usually the PayMongo webhook did not reach the app.

1. Make sure ngrok is running.
2. Run `.\php\php.exe artisan paymongo:webhook-sync`.
3. Check the ngrok inspector at `http://127.0.0.1:4040`.
4. Accounting can manually verify payments when needed.

### Scheduled announcement did not publish

Make sure the scheduler is running:

```powershell
.\php\php.exe artisan schedule:run
```

For a direct local check, run:

```powershell
.\php\php.exe artisan announcements:publish-due
```

Queued announcement emails still require the queue worker unless `QUEUE_CONNECTION=sync`.

### Images or uploaded files are stale during testing

Temporary uploads are registered and attached to bookings or other supported records. To purge expired unattached uploads locally:

```powershell
.\php\php.exe artisan uploads:purge-orphans
```

## Git Workflow

Before starting:

```powershell
git pull
```

After changes:

```powershell
npm.cmd run build
.\php\php.exe artisan test
git status --short
git add .
git commit -m "Describe the update"
git push
```

## Notes For Production

- Do not commit real `.env` secrets.
- Use real SMTP/provider credentials.
- Keep a queue worker running.
- Keep the Laravel scheduler running.
- Run Reverb if realtime chat/live refresh is enabled.
- Verify PayMongo webhooks are reachable.
- Use production PayMongo keys only after final business approval.
- Point the web server document root to `public/`.
- Keep `APP_DEBUG=false`.
- Use HTTPS and set `SESSION_SECURE_COOKIE=true`.
- Use `DB_CONNECTION=pgsql` for the production PostgreSQL database.
- Run migrations with `--force`.
- Run the production preflight scan before launch:

```powershell
.\php\php.exe artisan preflight:scan --json
```

Production deletion policy is preservation-first: business records are deactivated, archived, hidden, or voided instead of physically deleted unless the record is explicitly disposable, such as draft cleanup, notification dismissal, password reset token cleanup, or orphan upload cleanup.
