# Eloquente ECS System Test Cases

Date: 2026-05-26
Scope: End-to-end manual QA suite for staging or production-like testing
System: Eloquente Catering Event Catering System

## Test Execution Guide

Use this file during staging QA. Mark each case as:

```text
PASS / FAIL / BLOCKED / NOT TESTED
```

Record actual result, tester name, date/time, browser/device, and screenshots or logs for failed cases.

Recommended browsers:

- Chrome desktop
- Edge desktop
- Mobile Chrome or Safari

Recommended test roles:

- Public visitor
- Customer / Client
- Marketing staff
- Accounting staff
- Admin

## Required Test Data

Prepare these before testing:

- Staging site URL
- Customer test email inbox
- Marketing staff account
- Accounting staff account
- Admin account
- PayMongo sandbox keys and webhook secret
- Mail provider credentials
- Reverb credentials
- Queue worker running
- At least one active event type
- At least one active package
- At least five active menu items across multiple categories
- One available event date
- One locked or fully booked date
- One uploaded image file under 5 MB
- One invalid upload file such as `.txt` or oversized image

## Summary Checklist

| Area | Total Cases | Passed | Failed | Blocked |
|---|---:|---:|---:|---:|
| Public website | 8 |  |  |  |
| Authentication and profile | 12 |  |  |  |
| Customer booking | 20 |  |  |  |
| Customer dashboard | 12 |  |  |  |
| Payments and PayMongo | 16 |  |  |  |
| Marketing workflow | 16 |  |  |  |
| Accounting workflow | 14 |  |  |  |
| Admin workflow | 18 |  |  |  |
| Announcements and CMS | 10 |  |  |  |
| Chat and notifications | 10 |  |  |  |
| Reports and analytics | 10 |  |  |  |
| Food tasting and feedback | 10 |  |  |  |
| Security and access control | 16 |  |  |  |
| Deployment and operations | 14 |  |  |  |

## Public Website Test Cases

| ID | Test Case | Preconditions | Steps | Expected Result | Status |
|---|---|---|---|---|---|
| PUB-001 | Home page loads | None | Open `/` | Home page loads without login and shows main calls to action |  |
| PUB-002 | About page loads | None | Open `/about` | About page loads with readable content |  |
| PUB-003 | Amenities page loads | None | Open `/amenities` | Amenities page loads and links toward booking/inquiry |  |
| PUB-004 | Contact page loads | None | Open `/contact` | Contact information and inquiry form/guidance are visible |  |
| PUB-005 | Menu page loads active menu | Active menu items exist | Open `/menu` | Menu items are shown by category; hidden items do not appear |  |
| PUB-006 | Public announcements display | Published public announcement exists | Open home page or public announcement area | Published announcement appears; draft/archived announcements do not |  |
| PUB-007 | Public package/event endpoints work | Active records exist | Visit public package/event/menu pages or APIs through UI | Public data loads without exposing staff/customer private data |  |
| PUB-008 | Responsive public pages | Mobile viewport | Open home, menu, contact on mobile | Layout is readable, no overlapping text, navigation works |  |

## Authentication And Profile Test Cases

| ID | Test Case | Preconditions | Steps | Expected Result | Status |
|---|---|---|---|---|---|
| AUTH-001 | Customer registration works | Unique email available | Open `/register`, submit valid customer details | Account is created and OTP verification is requested |  |
| AUTH-002 | Registration validation works | None | Submit registration with missing/invalid fields | Friendly validation errors appear; account is not created |  |
| AUTH-003 | Duplicate email is rejected | Existing account email | Register with existing email | Duplicate email validation appears |  |
| AUTH-004 | OTP email is delivered | Mail provider configured | Register or resend OTP | OTP email arrives in test inbox |  |
| AUTH-005 | OTP verification succeeds | Valid OTP available | Enter correct OTP | User becomes verified and can continue |  |
| AUTH-006 | Invalid OTP is rejected | OTP flow active | Enter wrong OTP | Safe error appears; user remains unverified |  |
| AUTH-007 | Resend OTP works | OTP flow active | Click resend OTP | New OTP email is sent; old code should not remain valid if app rotates code |  |
| AUTH-008 | Login succeeds by role | Valid accounts exist | Log in as Customer, Marketing, Accounting, Admin | Each role reaches the correct dashboard |  |
| AUTH-009 | Invalid login is rate limited | Test account exists | Submit repeated invalid login attempts | Login throttling activates after allowed attempts |  |
| AUTH-010 | Logout works | Logged in | Click logout | Session ends and protected pages require login |  |
| AUTH-011 | Profile update works | Logged in | Update profile fields and save | Updated values persist after reload |  |
| AUTH-012 | Avatar upload validation works | Valid and invalid files ready | Upload valid image, then invalid file | Valid image displays; invalid file is rejected |  |

## Customer Booking Test Cases

| ID | Test Case | Preconditions | Steps | Expected Result | Status |
|---|---|---|---|---|---|
| BOOK-001 | Booking wizard loads | Customer logged in | Open `/book` | Booking wizard loads |  |
| BOOK-002 | Event type selection loads packages | Active event type/package exists | Select event type | Related packages/setup details appear |  |
| BOOK-003 | Available date can be selected | Available date exists | Select available event date and time | Date/time is accepted |  |
| BOOK-004 | Locked date is blocked | Locked date exists | Select locked date | Customer sees unavailable message and cannot submit for that date |  |
| BOOK-005 | Fully booked/capacity date is blocked | Capacity-limited date exists | Choose date/pax beyond capacity | System blocks selection or submission |  |
| BOOK-006 | Guest count validation works | Customer in wizard | Enter invalid/too-low guest count | Friendly validation appears |  |
| BOOK-007 | Curated package booking path works | Active package exists | Choose curated package and continue | Package price/dishes/total display correctly |  |
| BOOK-008 | Build-my-menu path works | Menu items exist | Choose custom menu and select dishes | Required categories and selected dishes are tracked |  |
| BOOK-009 | Budget-based menu handles low budget | Menu pricing exists | Enter budget below minimum | System explains budget is too low without false promise |  |
| BOOK-010 | Budget-based menu can generate valid menu | Sufficient budget entered | Generate budget menu | Menu is generated and can be reviewed |  |
| BOOK-011 | Venue/contact details save | Customer in wizard | Enter venue and contact details | Details appear in final review |  |
| BOOK-012 | Outside service or access fees appear | Rules configured | Enter venue details triggering fee | Fees or guidance appear clearly |  |
| BOOK-013 | Food tasting preference is captured | Customer in wizard | Choose tasting and enter details | Tasting details appear in final review |  |
| BOOK-014 | No tasting preference is accepted | Customer in wizard | Choose no tasting | Final review reflects no tasting |  |
| BOOK-015 | Final review modal is complete | Wizard filled | Open final review | Event, menu, venue, tasting, guest, schedule, and total are shown |  |
| BOOK-016 | Submit valid booking | Valid wizard data | Submit final review | Booking is created and customer sees success message |  |
| BOOK-017 | Booking appears in customer dashboard | Booking submitted | Open customer dashboard | New booking appears with readable status |  |
| BOOK-018 | Booking appears in Marketing queue | Booking submitted | Log in as Marketing | Booking appears in intake/review queue |  |
| BOOK-019 | Eligible booking update works | Editable booking exists | Customer updates allowed details | Allowed changes save and appear to staff |  |
| BOOK-020 | Locked/cancelled booking update is blocked | Locked/cancelled booking exists | Attempt update | System blocks update safely |  |

## Customer Dashboard Test Cases

| ID | Test Case | Preconditions | Steps | Expected Result | Status |
|---|---|---|---|---|---|
| CDASH-001 | Dashboard loads active bookings | Customer has booking | Open customer dashboard | Active booking details load |  |
| CDASH-002 | Booking selector works | Customer has multiple bookings | Switch selected booking | Details update correctly |  |
| CDASH-003 | Last selected tab/event persists | Customer dashboard open | Select tab/event, reload page | Selection persists where supported |  |
| CDASH-004 | Next actions are clear | Booking under review | View dashboard | Customer sees clear next action/status |  |
| CDASH-005 | Payment summary is correct | Booking has payment schedule | View payments tab | Paid, remaining, and next due values are correct |  |
| CDASH-006 | Future payment cannot be paid early | Multiple payment steps exist | Try to pay future step before current step | System blocks or hides invalid payment action |  |
| CDASH-007 | Clarification request appears | Marketing requested details | View dashboard | Request message is visible |  |
| CDASH-008 | Customer responds to clarification | Request exists | Submit response | Response saves and staff can see it |  |
| CDASH-009 | Tasting status appears | Tasting request exists | View tasting area | Tasting status/details are visible |  |
| CDASH-010 | Announcement appears for customer | Targeted announcement exists | View dashboard | Announcement appears to correct customer only |  |
| CDASH-011 | Cancel eligible booking | Eligible booking exists | Cancel booking | Booking status changes and refund eligibility is reflected |  |
| CDASH-012 | History removal hides completed/cancelled item | History item exists | Remove from history | Item is hidden from customer history view |  |

## Payments And PayMongo Test Cases

| ID | Test Case | Preconditions | Steps | Expected Result | Status |
|---|---|---|---|---|---|
| PAY-001 | Checkout initialization works | Approved booking with due payment | Click pay next step | PayMongo checkout session is created and customer is redirected |  |
| PAY-002 | Checkout amount is correct | Due payment exists | Compare checkout amount to system amount | Amount matches expected payment step |  |
| PAY-003 | Successful PayMongo payment returns safely | Sandbox payment method available | Complete checkout | Success page loads and directs customer back to dashboard |  |
| PAY-004 | Webhook marks payment paid | PayMongo webhook configured | Complete sandbox payment and wait for webhook | Payment becomes `Paid`/online-paid in staff view |  |
| PAY-005 | Cancelled checkout does not mark paid | Checkout started | Cancel payment | Cancel page loads and payment remains unpaid |  |
| PAY-006 | Failed checkout does not mark paid | PayMongo failure path available | Trigger failed payment | Payment remains unpaid/failed safely |  |
| PAY-007 | Already paid payment cannot be repaid | Payment already paid | Attempt to pay again | System blocks duplicate checkout |  |
| PAY-008 | Customer cannot self-verify manual payment | Customer logged in | Attempt legacy/manual route through UI or API | Payment is not marked verified by customer action |  |
| PAY-009 | Accounting can verify pending manual payment | Pending review payment exists | Accounting verifies payment | Payment becomes verified and booking progress updates |  |
| PAY-010 | Accounting can reject invalid payment | Pending review payment exists | Accounting rejects payment | Customer sees appropriate status; payment is not settled |  |
| PAY-011 | Payment reminder sends | Unpaid payment exists | Accounting sends reminder | Customer notification/email is sent |  |
| PAY-012 | Rush booking schedule is correct | Rush event date selected | Create rush booking | Payment schedule follows rush rules |  |
| PAY-013 | Amount mismatch webhook is rejected | Test webhook tool available | Send mismatched amount webhook | Payment is not marked paid; issue is recorded safely |  |
| PAY-014 | Currency mismatch webhook is rejected | Test webhook tool available | Send mismatched currency webhook | Payment is not marked paid |  |
| PAY-015 | Duplicate webhook is idempotent | Paid webhook event available | Replay webhook | Payment is not double-counted |  |
| PAY-016 | Payment labels are readable | Multiple payment states exist | View customer and staff screens | Customer sees friendly labels; staff sees operational labels |  |

## Marketing Workflow Test Cases

| ID | Test Case | Preconditions | Steps | Expected Result | Status |
|---|---|---|---|---|---|
| MKT-001 | Marketing dashboard loads | Marketing logged in | Open dashboard | Dashboard loads without errors |  |
| MKT-002 | Intake queue shows submitted booking | Submitted booking exists | View queue | Booking reference, customer, date, guests, status, owner appear |  |
| MKT-003 | Claim booking works | Unassigned booking exists | Click claim/assign | Booking owner becomes current staff; status updates |  |
| MKT-004 | Review checklist updates | Claimed booking exists | Mark checklist item done/pending | Checklist state saves after reload |  |
| MKT-005 | Request customer details | Booking under review | Send clarification request | Customer sees request; status updates |  |
| MKT-006 | Customer clarification response visible | Customer responded | View booking | Response is visible to Marketing |  |
| MKT-007 | Approve booking | Review complete | Approve booking | Booking becomes approved/payment-eligible |  |
| MKT-008 | Decline/cancel booking | Booking unsuitable | Cancel/decline booking with reason | Customer/staff views show cancellation clearly |  |
| MKT-009 | Update live event status | Approved booking exists | Set status such as preparing/on-the-way/completed | Status updates in relevant views |  |
| MKT-010 | Contact inquiry list loads | Contact inquiry exists | Open inquiry tab | Inquiry appears with filters/search |  |
| MKT-011 | Contact inquiry update works | Inquiry exists | Update status/notes | Changes save |  |
| MKT-012 | Food tasting queue loads | Tasting request exists | Open tasting queue | Tasting request appears |  |
| MKT-013 | Confirm/reschedule tasting | Tasting request exists | Update tasting status/date/notes | Tasting details save and customer view updates where applicable |  |
| MKT-014 | Record tasting outcome | Tasting completed | Enter outcome notes | Outcome is saved |  |
| MKT-015 | Review low feedback | Low-rating feedback exists | Mark follow-up/review notes | Review status and notes save |  |
| MKT-016 | Approve testimonial | High-rating feedback with permission exists | Approve testimonial | Testimonial status updates |  |

## Accounting Workflow Test Cases

| ID | Test Case | Preconditions | Steps | Expected Result | Status |
|---|---|---|---|---|---|
| ACC-001 | Accounting dashboard loads | Accounting logged in | Open dashboard | Dashboard loads without errors |  |
| ACC-002 | Pending payments list loads | Pending payments exist | Open pending payments | Pending payments display correctly |  |
| ACC-003 | Completed payments filter works | Paid/verified payments exist | Filter completed payments | Completed payments display correctly |  |
| ACC-004 | Ledger loads | Payments exist | Open ledger | Ledger shows date, booking, customer, amount, method, status |  |
| ACC-005 | Ledger search/filter works | Ledger data exists | Search/filter ledger | Results narrow correctly |  |
| ACC-006 | Payment terms edit validates 100% total | Unpaid booking exists | Set terms not totaling 100% | Validation blocks save |  |
| ACC-007 | Payment terms edit saves valid terms | Unpaid booking exists | Set valid terms totaling 100% | Terms save and dashboard updates |  |
| ACC-008 | Paid terms cannot be edited | Paid term exists | Try to edit paid term | System blocks change |  |
| ACC-009 | Reminder sends for unpaid term | Unpaid payment exists | Send reminder | Reminder notification/email is generated |  |
| ACC-010 | Refund queue shows cancelled paid booking | Cancelled booking with paid payment exists | Open refund queue | Booking appears with refundable context |  |
| ACC-011 | Non-refundable reservation fee calculated | Cancellation has reservation fee | View refund impact | Non-refundable portion is clear |  |
| ACC-012 | PayMongo refund success updates records | Refundable PayMongo payment exists | Process refund | Payment/refund case updates to refunded/success |  |
| ACC-013 | PayMongo refund failure is safe | Simulate provider failure | Process refund | Payment remains paid; refund case shows failed/manual review |  |
| ACC-014 | Unauthorized client blocked from accounting APIs | Customer logged in | Attempt accounting API | Access denied |  |

## Admin Workflow Test Cases

| ID | Test Case | Preconditions | Steps | Expected Result | Status |
|---|---|---|---|---|---|
| ADM-001 | Admin dashboard loads | Admin logged in | Open dashboard | Dashboard loads without errors |  |
| ADM-002 | Analytics summary loads | Data exists | View analytics summary | Summary cards/charts load |  |
| ADM-003 | Revenue analytics load | Payment data exists | Open revenue analytics | Revenue data appears without server errors |  |
| ADM-004 | Operations analytics load | Booking/prep data exists | Open operations analytics | Operations data appears |  |
| ADM-005 | Customer management list loads | Customers exist | Open customers | Customer list loads |  |
| ADM-006 | Customer update works | Customer exists | Edit allowed customer fields | Changes save |  |
| ADM-007 | Staff employee create works | Admin logged in | Create test staff account | Staff account is created with correct role |  |
| ADM-008 | Staff employee update works | Staff account exists | Edit staff details/role | Changes save |  |
| ADM-009 | Protected user safety | Protected/admin user exists | Attempt unsafe delete/update | System blocks or requires safe handling |  |
| ADM-010 | Menu item create works | Admin logged in | Create menu item | Item appears in admin and public menu if active |  |
| ADM-011 | Menu item update works | Menu item exists | Edit item | Changes save and public view updates |  |
| ADM-012 | Package create/update works | Event type exists | Create/update package | Package is available for relevant event type |  |
| ADM-013 | Event type create/update works | Admin logged in | Create/update event type | Event type appears in booking flow |  |
| ADM-014 | Pricing override works | Menu item exists | Update pricing | New pricing affects relevant estimates |  |
| ADM-015 | Discount application works | Booking exists | Apply discount | Booking total/payment schedule reflects discount safely |  |
| ADM-016 | Audit logs load | Audit data exists | Open audit logs | Logs show user/action/time/route context |  |
| ADM-017 | Admin refund supervision works | Refundable booking exists | Use admin refund route | Admin can supervise/process refund |  |
| ADM-018 | Admin-only APIs block lower roles | Marketing/Accounting logged in | Attempt admin-only APIs | Access denied |  |

## Announcements And CMS Test Cases

| ID | Test Case | Preconditions | Steps | Expected Result | Status |
|---|---|---|---|---|---|
| CMS-001 | Create draft announcement | Marketing/Admin logged in | Create draft | Draft saves and is not public |  |
| CMS-002 | Publish public announcement | Draft exists | Publish to public audience | Announcement appears on public page |  |
| CMS-003 | Publish customer-targeted announcement | Customers exist | Publish targeted announcement | Only selected/eligible customers see it |  |
| CMS-004 | Archive announcement | Published announcement exists | Archive it | Announcement disappears from public/customer views |  |
| CMS-005 | Scheduled start/end visibility works | Announcement with schedule exists | Check before/during/after schedule | Visibility follows schedule |  |
| CMS-006 | Test email sends | Mail configured | Send announcement test email | Test email arrives |  |
| CMS-007 | Publish email sends | `send_email` enabled | Publish announcement | Audience receives email where configured |  |
| CMS-008 | Audience user selector works | Customers exist | Search/select audience users | Correct users are selectable |  |
| CMS-009 | Unauthorized user blocked | Customer logged in | Attempt CMS route/API | Access denied |  |
| CMS-010 | Draft edit/delete works | Draft exists | Edit and delete draft | Changes save; draft delete succeeds |  |

## Chat And Notifications Test Cases

| ID | Test Case | Preconditions | Steps | Expected Result | Status |
|---|---|---|---|---|---|
| CHAT-001 | Customer starts chat | Customer logged in | Open chat and send message | Conversation is created |  |
| CHAT-002 | Staff unassigned queue updates | Staff logged in | View staff queue after customer message | Conversation appears |  |
| CHAT-003 | Staff claims conversation | Unassigned conversation exists | Staff clicks claim | Conversation owner updates |  |
| CHAT-004 | Staff replies | Claimed conversation exists | Send staff reply | Customer receives/sees reply |  |
| CHAT-005 | Customer attaches/selects booking context | Customer has booking | Start/send chat with booking context | Staff sees booking context |  |
| CHAT-006 | Transfer conversation | Claimed conversation exists | Staff transfers conversation | Target staff/queue updates |  |
| CHAT-007 | Resolve conversation | Active conversation exists | Staff resolves | Conversation leaves active queue or shows resolved |  |
| CHAT-008 | Unread count updates | New message exists | Check notification/chat badge | Unread count increases and can clear |  |
| CHAT-009 | Notification read-all works | Unread notifications exist | Click read all | Count becomes zero |  |
| CHAT-010 | Reverb/Echo has no console errors | Reverb configured | Send messages between browsers | Realtime updates work; no console connection errors |  |

## Reports And Analytics Test Cases

| ID | Test Case | Preconditions | Steps | Expected Result | Status |
|---|---|---|---|---|---|
| REP-001 | Analytics dashboard loads | Admin logged in | Open analytics | Dashboard loads without server errors |  |
| REP-002 | Analytics filters work | Data exists | Apply date/status filters | Results update correctly |  |
| REP-003 | Report widgets load | Admin logged in | Open report builder | Available widgets load |  |
| REP-004 | Add/remove/reorder widgets | Report builder open | Add, remove, reorder blocks | Builder state updates correctly |  |
| REP-005 | Preview report works | Report configured | Click preview | Preview displays readable report |  |
| REP-006 | Save report template | Report configured | Save template | Template appears in saved list |  |
| REP-007 | Edit saved report template | Template exists | Edit name/blocks/filters | Changes persist |  |
| REP-008 | Delete saved report template | Template exists | Delete template | Template is removed |  |
| REP-009 | Run report | Template exists | Run report | Report run is created |  |
| REP-010 | Export report | Report run exists | Export report | Download/export succeeds and is readable |  |

## Food Tasting And Feedback Test Cases

| ID | Test Case | Preconditions | Steps | Expected Result | Status |
|---|---|---|---|---|---|
| TASTE-001 | Public tasting request works | None | Submit public tasting form | Request is created |  |
| TASTE-002 | Customer tasting request works | Customer logged in | Submit tasting request | Request is linked to customer |  |
| TASTE-003 | Customer edits tasting request | Own tasting exists | Update date/details | Changes save |  |
| TASTE-004 | Customer cancels tasting request | Own tasting exists | Cancel request | Request is marked cancelled |  |
| TASTE-005 | Staff tasting queue shows request | Request exists | Marketing opens queue | Request appears |  |
| TASTE-006 | Staff confirms tasting | Request exists | Set status confirmed | Confirmed status saves |  |
| TASTE-007 | Staff completes tasting with notes | Confirmed tasting exists | Add outcome notes and complete | Completed status and notes save |  |
| FB-001 | Feedback request is created after completion | Completed booking exists | Mark booking completed | Feedback request is generated once |  |
| FB-002 | Customer submits low rating feedback | Feedback request exists | Submit low rating | Follow-up/review status is created |  |
| FB-003 | Customer submits high testimonial-eligible feedback | Feedback request exists | Submit high rating with permission | Testimonial candidate status is created |  |

## Security And Access Control Test Cases

| ID | Test Case | Preconditions | Steps | Expected Result | Status |
|---|---|---|---|---|---|
| SEC-001 | Guest cannot access customer dashboard | Logged out | Open customer dashboard URL | Redirected to login or denied |  |
| SEC-002 | Guest cannot access staff dashboards | Logged out | Open staff dashboard URLs | Redirected to login or denied |  |
| SEC-003 | Customer cannot access Marketing API | Customer logged in | Call Marketing API | Access denied |  |
| SEC-004 | Customer cannot access Accounting API | Customer logged in | Call Accounting API | Access denied |  |
| SEC-005 | Customer cannot access Admin API | Customer logged in | Call Admin API | Access denied |  |
| SEC-006 | Marketing cannot access Accounting API | Marketing logged in | Call Accounting API | Access denied |  |
| SEC-007 | Marketing cannot access Admin employee/customer APIs | Marketing logged in | Call Admin employee/customer APIs | Access denied |  |
| SEC-008 | Accounting cannot access Marketing API | Accounting logged in | Call Marketing API | Access denied |  |
| SEC-009 | Accounting cannot access Admin configuration APIs | Accounting logged in | Call Admin config APIs | Access denied |  |
| SEC-010 | CSRF protects browser mutations | Authenticated user | Submit mutation without CSRF token/header | Request is rejected except signed/exempt webhook |  |
| SEC-011 | PayMongo webhook accepts only valid signature | Webhook tools available | Send valid and invalid signatures | Valid accepted; invalid rejected |  |
| SEC-012 | Upload accepts only images | Valid/invalid files ready | Upload image and non-image | Image accepted; non-image rejected |  |
| SEC-013 | App debug disabled on staging/prod | Staging env configured | Trigger safe 404/validation | No debug stack traces shown |  |
| SEC-014 | `.env` is not web-accessible | Staging deployed | Request `/.env` | Server returns 403/404 and no secrets |  |
| SEC-015 | Sensitive directories are not public | Staging deployed | Request `/storage`, `/vendor`, `/database` direct paths | Private paths are not exposed |  |
| SEC-016 | Session cookie security | HTTPS staging | Inspect cookies | Secure/HttpOnly/SameSite settings match deployment plan |  |

## Deployment And Operations Test Cases

| ID | Test Case | Preconditions | Steps | Expected Result | Status |
|---|---|---|---|---|---|
| OPS-001 | Production build succeeds on server | Staging server ready | Run `npm run build` | Build passes without chunk warning |  |
| OPS-002 | Migrations run on server | Staging DB ready | Run `php artisan migrate --force` | Migrations complete |  |
| OPS-003 | Config cache works on server | Staging env configured | Run `php artisan config:cache` | Config cache succeeds |  |
| OPS-004 | Route cache works on server | Staging deployed | Run `php artisan route:cache` | Route cache succeeds |  |
| OPS-005 | View cache works on server | Staging deployed | Run `php artisan view:cache` | View cache succeeds |  |
| OPS-006 | Queue worker runs | Worker configured | Start/inspect worker | Worker stays running |  |
| OPS-007 | Failed jobs visible | Queue configured | Simulate/inspect failed job handling | Failed jobs can be viewed and retried/cleared |  |
| OPS-008 | Reverb process runs | Reverb configured | Start/inspect Reverb | Process stays running and accepts connections |  |
| OPS-009 | Scheduler configured | Server access | Inspect cron/scheduler | Scheduler entry exists or hosting equivalent is configured |  |
| OPS-010 | Storage link or cloud storage works | Storage configured | Run/check `storage:link` or cloud disk | Uploaded files display correctly |  |
| OPS-011 | Backups run | Backup configured | Run or inspect backup job | Backup file/snapshot is created |  |
| OPS-012 | Backup restore tested | Backup exists | Restore backup into staging/test DB | Restore succeeds |  |
| OPS-013 | Monitoring alerts configured | Monitoring tool available | Verify alert rules | HTTP 500, failed jobs, mail, webhook, disk, Reverb alerts exist |  |
| OPS-014 | Rollback procedure verified | Previous release available | Review or rehearse rollback | Rollback steps are documented and practical |  |

## UX And Performance Test Cases

| ID | Test Case | Preconditions | Steps | Expected Result | Status |
|---|---|---|---|---|---|
| UX-001 | Staff tab names are clear | Staff accounts exist | Open Marketing, Accounting, and Admin sidebars | Tab names match the role-based naming guide and do not use coding/system terms |  |
| UX-002 | Staff loading uses skeletons | Slow network throttling enabled | Open Marketing, Accounting, Admin, Announcements, Messages, and Preparation | Loading states preserve layout with skeletons instead of plain loading text or generic spinners |  |
| UX-003 | Marketing opens without heavy inactive tabs | Browser network tools open | Open Marketing dashboard | Initial load fetches Today summary and visible data only, not every booking-backed tab |  |
| UX-004 | Accounting Today is lightweight | Browser network tools open | Open Accounting dashboard | Today loads summary plus payment issue preview without requiring full ledger/refund tables |  |
| UX-005 | Admin Overview is lightweight | Browser network tools open | Open Admin dashboard | Overview loads analytics summary first; detailed analytics sections wait until Analytics is opened |  |
| UX-006 | Preparation board pagination works | Upcoming approved bookings exist | Open Event Preparation, change page/per-page/search/filter | Results update from server pagination and counts remain accurate |  |
| UX-007 | Preparation refresh preserves context | Preparation board loaded | Change a task or refresh silently | Existing board does not disappear unless it is the first load; updates remain readable |  |
| UX-008 | Date Availability wording is consistent | Marketing/Admin accounts exist | Open Date Availability in both roles | Screen purpose is clear and controls do not show duplicate/confusing date pickers |  |
| UX-009 | Customer dashboard loading feels polished | Customer account exists | Throttle network and open customer dashboard | Customer sees branded skeleton layout, not a plain spinner |  |
| UX-010 | User-facing wording avoids internal jargon | All roles available | Browse public, client, staff, and email templates | No customer/staff visible copy uses payload, webhook, provider, endpoint, slug, or database ID unless intentionally technical |  |

## Final Sign-Off

| Role | Name | Date | Decision | Notes |
|---|---|---|---|---|
| QA Tester |  |  |  |  |
| Developer |  |  |  |  |
| Project Owner |  |  |  |  |
| Deployment Owner |  |  |  |  |

Final decision:

```text
[ ] Approved for production
[ ] Approved for limited pilot
[ ] Not approved until blockers are fixed
```

Open blockers:

```text
1.
2.
3.
```
