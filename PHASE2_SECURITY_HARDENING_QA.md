# Phase 2 Security Hardening QA Report

Date: 2026-05-26
Scope: `SYSTEM_COMPLETION_GUIDE.md` Phase 2 only
Result: Passed

## Phase 2 Objective

Remove risky development behavior before real users or real payments:

- stop OTP codes from being written to logs
- restore CSRF protection for browser API mutations
- add throttling to sensitive public/auth/payment routes
- harden upload validation
- confirm role-protected routes still behave safely

## Implementation Verified

| Area | Result |
|---|---|
| OTP logging | Registration/resend OTP logs no longer include the secret code |
| CSRF protection | `api/*` is no longer globally exempted from CSRF verification |
| PayMongo webhook | `webhook/paymongo` remains CSRF-exempt because it uses PayMongo signature validation |
| Frontend fetch safety | Same-origin mutating `fetch()` requests automatically receive `X-CSRF-TOKEN` and `X-Requested-With` headers |
| Route throttling | Added throttles to login, register, OTP verify/resend, food tasting, booking creation, checkout initialization, upload, and password code routes |
| Upload validation | `/api/upload` now accepts only JPG, JPEG, PNG, or WEBP images up to 5 MB |
| Role access | Existing role middleware remains in place; Phase 1 and Phase 2 tests confirm customers cannot use Accounting verification routes |

## Automated Test Cases

| Test Case ID | Test Case | Expected Result | Actual Result | Status |
|---|---|---|---|---|
| PH2-QA-001 | Register a new user and send OTP | OTP email is queued; logs contain only safe metadata, not the OTP | Passed | Passed |
| PH2-QA-002 | Resend OTP for an unverified user | New OTP email is queued; logs contain only safe metadata, not the OTP | Passed | Passed |
| PH2-QA-003 | Upload a non-image file to `/api/upload` | Upload is rejected with validation error | Passed | Passed |
| PH2-QA-004 | Upload a valid image to `/api/upload` | Upload succeeds and returns a `/storage/uploads/...` URL | Passed | Passed |
| PH2-QA-005 | Repeat invalid login attempts | Sixth request is rate-limited | Passed | Passed |
| PH2-QA-006 | Inspect CSRF configuration | `api/*` is not globally exempted; PayMongo webhook remains exempted | Passed | Passed |
| PH2-QA-007 | Inspect frontend fetch wrapper | Same-origin mutation requests automatically receive CSRF and AJAX headers | Passed | Passed |

## QA Commands Run

### Focused Phase 2 Suite

```bash
php artisan test --filter=SecurityHardeningTest
```

Result:

```text
Tests: 6 passed (30 assertions)
```

### Full Regression Suite

```bash
php artisan test
```

Result:

```text
Tests: 36 passed (188 assertions)
```

### Frontend Production Build

```bash
npm.cmd run build
```

Result:

```text
Build completed successfully.
```

Note: Vite still reports a chunk-size warning for large bundles. This is not a Phase 2 security failure.

### Static Security Scan

```bash
rg -n "OTP Verification code|Resent OTP Verification code|OTP FOR|RESENT OTP FOR|FAILED TO SEND OTP TO|'api/\*'|required\|file\|max:5120" app bootstrap routes resources tests -S
```

Result:

```text
No unsafe OTP logging strings remain in app code.
No broad CSRF exemption remains in bootstrap/app.php.
No old loose upload validation remains in FileUploadController.
```

The remaining `api/*` matches are safe uses in the API fallback/performance middleware and test assertions, not CSRF exemptions.

## Files Changed

| File | Purpose |
|---|---|
| `app/Http/Controllers/AuthController.php` | Removed OTP secret logging and replaced it with safe metadata logs |
| `app/Http/Controllers/FileUploadController.php` | Hardened upload validation to image MIME types only |
| `resources/js/bootstrap.js` | Added global same-origin fetch wrapper for CSRF/AJAX headers |
| `bootstrap/app.php` | Removed broad `api/*` CSRF exemption; kept PayMongo webhook exemption |
| `routes/web.php` | Added throttles to sensitive auth, OTP, booking, checkout, food tasting, upload, and password code routes |
| `tests/Feature/SecurityHardeningTest.php` | Added focused Phase 2 QA coverage |
| `PHASE2_SECURITY_HARDENING_QA.md` | Documents QA test cases, results, and manual follow-up steps |

## Manual Steps You Need To Do

These are not code changes, but they matter before real deployment:

1. Rebuild frontend assets after pulling this change.

   ```bash
   npm run build
   ```

2. Clear and rebuild Laravel caches on the deployed environment.

   ```bash
   php artisan optimize:clear
   php artisan config:cache
   php artisan route:cache
   php artisan view:cache
   ```

3. Restart the Laravel/PHP server and queue workers after deployment.

   ```bash
   php artisan queue:restart
   ```

4. Manually smoke test browser actions that use `fetch()` because CSRF is now enforced for `api/*`.
   - submit contact inquiry
   - submit food tasting request
   - create a booking
   - update booking details/menu
   - open PayMongo checkout
   - upload an image
   - use notification read/delete actions
   - send chat messages
   - use Marketing booking actions
   - use Accounting payment/refund actions
   - use Admin create/update/delete actions

5. Confirm production logs after a real registration and OTP resend.
   - Logs should show that OTP mail was sent.
   - Logs must not show the actual OTP code.

6. Decide whether the current throttle limits are acceptable for your business flow.
   - Login/register: 5 requests per minute
   - OTP verify: 6 requests per minute
   - OTP resend: 3 requests per minute
   - Booking creation: 10 requests per minute
   - Checkout initialization: 10 requests per minute
   - Upload: 10 requests per minute
   - Food tasting: 5 requests per minute
   - Password code: 5 requests per minute

7. Confirm uploaded image previews still work on the deployed server.
   - `php artisan storage:link` may be needed on production.
   - The server must allow public access to `/storage/uploads/...`.

## QA Conclusion

Phase 2 is complete.

The system no longer logs OTP secrets, no longer broadly exempts `api/*` from CSRF protection, has stronger upload validation, and rate-limits the sensitive routes listed in Phase 2. The full automated suite and production build both pass.
