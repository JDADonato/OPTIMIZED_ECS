# Phase 3 QA Report: Demo Data And Seeder Safety

Date: 2026-05-26

## Scope

Phase 3 focused on preventing fake analytics/demo data from entering staging or production while keeping required system seed data available.

Required seed data remains available:
- default staff/client seed accounts
- event types
- menu items
- packages
- business rules

Demo-only data is now guarded:
- analytics demo clients
- fake demo bookings
- fake demo payments
- generated `demo_%` menu filler rows
- `demo.eloquente.test` records

## Implementation Summary

1. `database/seeders/DatabaseSeeder.php`
   - Default seeding now runs required baseline data first.
   - `AnalyticsDemoSeeder` is called only when `APP_ENV=local`.
   - Non-local environments print a skip message instead of inserting analytics demo records.
   - The older operational demo data helper is also guarded so it cannot seed demo bookings outside local.

2. `database/seeders/AnalyticsDemoSeeder.php`
   - Direct execution is blocked outside `APP_ENV=local`.
   - In `production`, it throws a `RuntimeException` to clearly refuse unsafe demo seeding.
   - In other non-local environments, it exits without creating demo rows.

3. `database/migrations/0001_01_02_000005_create_menu_and_business_tables.php`
   - Changed `packages.type` from the old enum to a string for fresh installs and tests.
   - This matches the current event-type slug model such as `formal-wedding` and `corporate-seminar`.

4. `deploymentchecklist.md`
   - Added production seeding guidance.
   - Explicitly documents that `AnalyticsDemoSeeder` is local-only.

5. `tests/Feature/SeederSafetyTest.php`
   - Added regression coverage for default seeder safety and direct demo seeder protection.

## QA Test Cases

| Test Case | Expected Result | Status |
|---|---|---|
| Run default seeder outside local/test environment simulation | Required catalog/config data is seeded | Passed |
| Check default seeder for demo users | No `@demo.eloquente.test` users are created | Passed |
| Check default seeder for demo bookings | No `@demo.eloquente.test` bookings are created | Passed |
| Check default seeder for generated demo menu rows | No `demo_%` dish IDs are created | Passed |
| Run `AnalyticsDemoSeeder` in `testing` environment | Seeder exits without creating demo data | Passed |
| Force `AnalyticsDemoSeeder` under `production` environment | Seeder throws and refuses to run | Passed |
| Full Laravel regression suite | Existing system tests still pass | Passed |
| Frontend production build | Build still passes | Passed |

## Commands Run

```bash
php artisan test --filter=SeederSafetyTest
php artisan test
npm.cmd run build
```

Results:
- `SeederSafetyTest`: 3 passed, 12 assertions
- Full backend suite: 40 passed, 203 assertions
- Frontend build: passed with the existing large chunk warning

## Manual Deployment Notes

Production/staging:

```bash
php artisan migrate --force
php artisan db:seed --force
```

Do not run this on staging or production:

```bash
php artisan db:seed --class=AnalyticsDemoSeeder
```

Local demo only:

```bash
php artisan db:seed --class=AnalyticsDemoSeeder
```

## Data Safety Note

This phase does not erase your current local mock/demo data automatically. It only prevents default and production seeding paths from creating fake analytics/demo records by accident.

If you run `AnalyticsDemoSeeder` locally, that seeder intentionally refreshes its own generated demo analytics dataset.
