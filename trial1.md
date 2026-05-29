# Trial 1 End-to-End System Test Script

## Roles
- **Admin tester:** owner/operator account, staff setup, oversight, settings, audit, reports.
- **Customer tester:** public visitor and registered client.
- **Marketing tester:** booking review, claim ownership, chat, event calendar, preparation, feedback.
- **Accounting tester:** payment verification, receipts, ledger, refunds.

## Goal
Run the business flow from staff account setup to customer feedback after event completion, while checking normal behavior, blocked actions, ownership rules, error handling, and skipped secondary features.

## Ground Rules
- Record actual output, screenshots, and bugs after each case.
- Use clear sample data: customer name, event name, event date, pax, package, payment reference.
- When an error is expected, the system should show a clear user-facing message and should not crash.
- Do not use real payment credentials unless testing on a proper production/sandbox payment setup.

---

# Phase 1: Admin Setup

## 1. Admin Logs In
**Actor:** Admin  
**Steps:**
1. Open login page.
2. Log in with Admin account.
3. Open Admin dashboard.

**Expected Output:**
- Admin reaches Admin Console.
- Admin navigation is visible.
- No client, marketing, or accounting-only controls are incorrectly shown as the main workspace.

**Error Case:**
- Try wrong password.
- Expected: login fails with clear message; no dashboard access.

## 2. Admin Creates Staff Accounts
**Actor:** Admin  
**Steps:**
1. Go to People/Staff management.
2. Create one Marketing staff account.
3. Create one Accounting staff account.
4. Check generated password/invite/reset behavior.

**Expected Output:**
- Staff accounts are created with correct roles.
- Staff appear in People list.
- Temporary password or invite/reset instruction is shown/sent.
- Audit log records staff creation.

**Error Cases:**
- Create duplicate username/email.
- Submit missing required fields.
- Try to create invalid role.

**Expected Errors:**
- Clear validation message.
- No broken/partial account created.

## 3. Staff First Login And Password Setup
**Actor:** Marketing, Accounting  
**Steps:**
1. Marketing logs in with temporary credentials.
2. Complete required password change if prompted.
3. Accounting repeats the same flow.

**Expected Output:**
- Staff cannot access dashboard until required password flow is completed.
- After password setup, Marketing lands in Marketing Workspace.
- Accounting lands in Accounting Workspace.

**Error Cases:**
- Weak password.
- Password confirmation mismatch.

**Expected Errors:**
- Clear password validation message.

## 4. Admin Reviews Audit Log
**Actor:** Admin  
**Steps:**
1. Open Activity Log.
2. Filter by account/staff actions.
3. Check staff creation and login/password actions.

**Expected Output:**
- Activity labels are business-readable.
- No raw route/method/coding terms are shown by default.
- Technical details, if present, are hidden behind Admin-only details.

---

# Phase 2: Public Customer Discovery

## 5. Customer Visits Public Pages
**Actor:** Customer  
**Steps:**
1. Open home page.
2. Browse menu.
3. Open amenities/about/contact pages.
4. Open food tasting page.

**Expected Output:**
- Home page CTA hierarchy is clear: Start Booking, Browse Menu, Ask a Question.
- Food tasting feels separate from the dashboard.
- Pages load without layout overlap on desktop and mobile.

**Error Case:**
- Submit contact form with missing/invalid email.

**Expected Error:**
- Contact form shows validation and does not submit invalid data.

## 6. Customer Sends Contact Inquiry
**Actor:** Customer, Marketing  
**Steps:**
1. Customer submits contact inquiry.
2. Marketing opens Guest Inquiries.
3. Marketing updates inquiry status.

**Expected Output:**
- Inquiry appears in Marketing queue.
- Marketing can update/follow up.
- Customer-facing submission shows success.

---

# Phase 3: Customer Registration And Verification

## 7. Customer Registers
**Actor:** Customer  
**Steps:**
1. Open Register.
2. Create customer account.
3. Trigger OTP verification.

**Expected Output:**
- Account is created.
- OTP/email verification prompt appears.
- Customer cannot perform sensitive actions until email is verified.

**Error Cases:**
- Duplicate email/username.
- Invalid phone/email.
- Weak password.

**Expected Errors:**
- Clear validation messages.

## 8. OTP Verification
**Actor:** Customer  
**Steps:**
1. Enter valid OTP.
2. Test resend OTP.
3. Test old OTP after resend.
4. Test expired or wrong OTP.

**Expected Output:**
- Valid OTP verifies email.
- Resend starts cooldown/countdown.
- Old OTP no longer works after resend.
- Wrong/expired OTP shows clear message.

---

# Phase 4: Booking Creation

## 9. Customer Starts Booking
**Actor:** Customer  
**Steps:**
1. Click Start Booking.
2. Fill event type, event name, date, time, pax, venue, package/menu details.
3. Submit booking.

**Expected Output:**
- Booking is created as awaiting review/submitted.
- Customer dashboard shows the booking.
- Next step strip shows the current actionable step.
- Journey tracker is compact and does not push the task down.

**Error Cases:**
- Missing required fields.
- Date unavailable/locked.
- Pax above availability.

**Expected Errors:**
- Clear validation message.
- Booking is not created with invalid data.

## 10. Customer Updates Booking Before Review
**Actor:** Customer  
**Steps:**
1. Open customer dashboard.
2. Update event details.
3. Update menu if allowed.
4. Upload inspiration image if available.

**Expected Output:**
- Updates save correctly.
- Marketing sees updated booking data.
- If a booking-linked chat exists, system message/note appears where implemented.

---

# Phase 5: Marketing Claim And Review

## 11. Marketing Views Claim Queue
**Actor:** Marketing  
**Steps:**
1. Open Marketing Booking Reviews.
2. Open Claim Queue.
3. Confirm the new booking appears.

**Expected Output:**
- Unassigned reviewable booking is visible in Claim Queue.
- Only Claim booking action is available before claim.
- Approve/Reject/Ask details are not available before claim.

## 12. Marketing Attempts Mutation Before Claim
**Actor:** Marketing  
**Steps:**
1. Try approve/reject/ask details without claiming if any path exposes it.

**Expected Output:**
- Action is blocked.
- Message says customer-facing equivalent of “Claim this booking before making changes.”

## 13. Marketing Claims Booking
**Actor:** Marketing  
**Steps:**
1. Click Claim booking.
2. Check Claim Queue.
3. Check My Bookings.

**Expected Output:**
- Booking leaves Claim Queue.
- Booking appears in My Bookings.
- Owner label shows Marketing staff.
- Full owner actions appear.

## 14. Marketing Requests Customer Details
**Actor:** Marketing, Customer  
**Steps:**
1. Marketing clicks Ask details/request clarification.
2. Customer opens dashboard.
3. Customer responds to clarification.
4. Marketing refreshes/reopens booking.

**Expected Output:**
- Customer sees requested details panel clearly.
- Customer can submit response.
- Marketing sees clarification received.
- Audit/activity records the request and response.

## 15. Marketing Approves Booking
**Actor:** Marketing, Customer  
**Steps:**
1. Marketing approves booking.
2. Customer opens dashboard.

**Expected Output:**
- Booking status changes to approved/confirmed/reserved according to current business rules.
- Preparation tasks are created once.
- Customer next step updates to reservation/payment if applicable.
- Booking appears in Event Preparation.

**Error Case:**
- Try approving after booking is cancelled/completed.

**Expected Error:**
- Action blocked with clear message.

---

# Phase 6: Ownership And Transfer Cases

## 16. Other Marketing User Cannot Mutate Owned Booking
**Actor:** Marketing tester using another account, Admin optional  
**Steps:**
1. Log in as a different Marketing staff member if available.
2. Open All Bookings.
3. Try approve/reject/ask details/update tasks on booking owned by first Marketing staff.

**Expected Output:**
- Booking is visible read-only.
- Mutation controls are hidden or disabled.
- Helper says owned by another staff member.

## 17. Transfer Claimed Booking
**Actor:** Marketing owner, second Marketing, Admin optional  
**Steps:**
1. Owner requests transfer to another Marketing staff.
2. Target staff sees transfer request.
3. Target accepts.

**Expected Output:**
- Transfer requires acceptance.
- Ownership changes only after accept.
- Previous owner loses owner-only controls.
- Audit records transfer request and acceptance.

**Decline Case:**
- Target declines transfer.
- Expected: ownership stays with original owner.

## 18. Release/Unclaim Booking
**Actor:** Marketing owner or Admin  
**Steps:**
1. Release claim on an uncompleted booking.
2. Check Claim Queue.

**Expected Output:**
- Booking returns to unassigned claim queue.
- Owner label becomes unassigned/available to claim.
- Completed bookings cannot be released from history workflow.

---

# Phase 7: Chat And Collaboration

## 19. Customer Starts Chat
**Actor:** Customer, Marketing  
**Steps:**
1. Customer opens chat.
2. Choose booking or General Inquiry if prompted.
3. Send message.

**Expected Output:**
- Conversation appears for Marketing.
- Booking-linked chat shows booking context.
- Unassigned conversation cannot be answered by Marketing until claimed.

## 20. Marketing Claims And Replies
**Actor:** Marketing, Customer  
**Steps:**
1. Marketing claims chat.
2. Marketing replies.
3. Customer receives message.

**Expected Output:**
- Messages appear in order.
- Unread counts update.
- Sending has optimistic/retry behavior if available.

## 21. Chat Collaboration
**Actor:** Marketing owner, second Marketing/Admin  
**Steps:**
1. Owner/Admin adds collaborator.
2. Collaborator replies.
3. Collaborator tries transfer/resolve.

**Expected Output:**
- Collaborator can read/reply.
- Collaborator cannot transfer/resolve unless owner/Admin.
- Admin can monitor/join/moderate.

## 22. Chat Edit/Delete/Reopen
**Actor:** Customer, Marketing, Admin  
**Steps:**
1. Edit own message within allowed window.
2. Soft-delete own message.
3. Staff/Admin moderation delete with reason.
4. Resolve conversation.
5. Reopen conversation.

**Expected Output:**
- Deleted message shows placeholder.
- Moderation requires reason.
- Resolve/reopen status updates correctly.
- Audit records sensitive actions.

---

# Phase 8: Payment Flow

## 23. Customer Opens Payment Step
**Actor:** Customer  
**Steps:**
1. Open dashboard after booking approval.
2. Open Payments.
3. Start secure checkout or upload/submit payment proof depending on enabled flow.

**Expected Output:**
- Payment method labels are human-readable.
- Amount due, balance, due date, and payment type are clear.
- Customer cannot pay another customer’s booking.

## 24. Accounting Verifies Payment
**Actor:** Accounting  
**Steps:**
1. Open Verify Payments.
2. Review pending payment.
3. Approve/verify payment.

**Expected Output:**
- Payment status updates.
- Customer sees paid amount and remaining balance.
- Receipt is available.
- Audit records verification.

**Reject Case:**
- Reject payment with reason.
- Expected: Customer sees rejected/pending correction status.

## 25. Receipt PDF
**Actor:** Customer, Accounting, Admin  
**Steps:**
1. Download receipt.
2. Review content.

**Expected Output:**
- Branded PDF opens.
- Includes receipt number, booking reference, client, event name/type/date/time, amount, method label, payment date, status, balance, business contact.
- No raw JSON, JS, route names, or coding terms.

---

# Phase 9: Event Preparation

## 26. Marketing Opens Event Preparation
**Actor:** Marketing  
**Steps:**
1. Open Event Preparation.
2. Find approved booking.
3. Review default tasks.

**Expected Output:**
- Preparation board loads without 500 errors.
- Booking appears with event details.
- Tasks are grouped/visible.

## 27. Update Preparation Tasks
**Actor:** Marketing owner/Admin  
**Steps:**
1. Update task status.
2. Add notes if supported.

**Expected Output:**
- Owner/Admin can update tasks.
- Non-owner Marketing user cannot update if ownership rules apply.
- Status persists after refresh.

## 28. Prep List PDF
**Actor:** Marketing/Admin  
**Steps:**
1. Download preparation list PDF.
2. Review fields.

**Expected Output:**
- Branded PDF includes event date/time, venue, contact, pax, menu, dietary notes, logistics, timeline, task owners/status, generated timestamp.

---

# Phase 10: Event Calendar And Availability

## 29. Marketing Event Calendar Month View
**Actor:** Marketing  
**Steps:**
1. Open Event Calendar.
2. Switch months.
3. Open event.

**Expected Output:**
- Events do not disappear after month switching.
- Calendar count matches visible data.
- Event detail opens correctly.

## 30. Calendar List View And Filters
**Actor:** Marketing/Admin  
**Steps:**
1. Switch to List view.
2. Filter by date/status/event type/owner/search.

**Expected Output:**
- List and month grid use same event collection.
- Empty states are clear.
- Filters do not break counts.

## 31. Date Availability Management
**Actor:** Admin/Marketing  
**Steps:**
1. Lock a date.
2. Reduce capacity.
3. Try customer booking on locked/over-capacity date.

**Expected Output:**
- Locked date blocks new bookings.
- Existing bookings remain visible.
- Customer receives availability error.

---

# Phase 11: Completion And Event History

## 32. Mark Event Completed
**Actor:** Admin or allowed staff/system command  
**Steps:**
1. Move event to Completed through allowed workflow or run past-submitted cleanup for eligible past pending bookings.
2. Open Marketing claim queue.
3. Open Event History.

**Expected Output:**
- Completed event leaves active review/claim/preparation queues.
- Completed event appears in shared Event History for Admin, Marketing, and Accounting.
- Completed booking cannot be claimed/unclaimed or approved/rejected.

## 33. Event History Notes
**Actor:** Admin, Marketing, Accounting  
**Steps:**
1. Open completed event in Event History.
2. Add internal note.
3. Another staff role views note.

**Expected Output:**
- Notes are visible to staff.
- Notes do not reopen the event or change ownership.
- Client cannot see staff-only notes.

---

# Phase 12: Feedback And Testimonials

## 34. Feedback Request Is Created
**Actor:** Customer, Marketing  
**Steps:**
1. Complete event.
2. Customer opens dashboard/feedback request.

**Expected Output:**
- One feedback request exists.
- Running completion workflow twice does not create duplicates.

## 35. Customer Submits Feedback
**Actor:** Customer  
**Steps:**
1. Rate service/food/communication/value.
2. Add comments.
3. Choose testimonial permission.
4. Submit.

**Expected Output:**
- Feedback saves.
- Customer sees success.
- Low rating creates follow-up need.
- Testimonial candidate appears only if permission granted.

## 36. Marketing Reviews Feedback
**Actor:** Marketing/Admin  
**Steps:**
1. Open feedback review/follow-up.
2. Assign owner/status/follow-up notes.
3. Approve or reject testimonial.

**Expected Output:**
- Status and notes persist.
- Approved testimonial only appears publicly if customer permission exists and staff approved it.

---

# Phase 13: Refund And Cancellation Cases

## 37. Customer Cancels Booking Before Event
**Actor:** Customer, Accounting/Admin  
**Steps:**
1. Customer cancels a paid booking.
2. Accounting opens Refund Queue.
3. Process refund.

**Expected Output:**
- Cancelled booking moves out of active workflow.
- Refund case appears if payment/refund rules apply.
- Non-refundable reservation/security terms are respected.
- Customer sees updated refund/payment state.

## 38. Refund Failure/Exception
**Actor:** Accounting/Admin  
**Steps:**
1. Simulate provider/manual refund failure if possible.
2. Review exception queue.

**Expected Output:**
- Payment remains accurate.
- Refund case is marked failed/exception.
- Admin/Accounting sees follow-up action.

---

# Phase 14: Admin Oversight And Settings

## 39. Admin Overview And Analytics
**Actor:** Admin  
**Steps:**
1. Open Overview.
2. Open Analytics.
3. Check bookings, revenue, feedback, operations, pipeline.

**Expected Output:**
- Summary cards load.
- No old/unstyled admin pages.
- No 500 errors.
- Counts match relevant queues.

## 40. Admin Reports
**Actor:** Admin  
**Steps:**
1. Create/report preview/run/export report.
2. Download report PDF/export.

**Expected Output:**
- Branded report output.
- No raw/coding terms.
- Audit records report generation.

## 41. Admin Settings
**Actor:** Admin  
**Steps:**
1. Edit business settings.
2. Edit booking/payment labels/defaults if available.
3. Use preview controls.

**Expected Output:**
- Settings save.
- Customer-facing previews do not leak draft content publicly.
- Audit records setting changes.

## 42. Staff Lifecycle
**Actor:** Admin  
**Steps:**
1. Edit staff profile.
2. Force password change.
3. Reset password.
4. Deactivate/reactivate staff.
5. Try deactivating self.

**Expected Output:**
- Staff controls work.
- Admin cannot deactivate self.
- Deactivated account cannot log in/reset until reactivated.
- Audit records all actions.

---

# Phase 15: Documents, Notifications, And Sounds

## 43. Notification Bell
**Actor:** All roles  
**Steps:**
1. Trigger new booking, message, payment, feedback events.
2. Open notification bell.
3. Mark read/delete/read all.

**Expected Output:**
- Notifications are grouped by priority/category.
- Own actions do not create noisy incoming alerts.
- Passive dashboard opens are softened/hidden.

## 44. Sound Preferences
**Actor:** Customer/Staff  
**Steps:**
1. Open Profile.
2. Toggle notification sounds/quiet mode if available.
3. Trigger incoming notification/message.

**Expected Output:**
- Preference saves.
- Sound only plays after user gesture and only for incoming unread events.
- Visual fallback works if audio blocked.

## 45. Profile And Account Safety
**Actor:** Customer/Staff/Admin  
**Steps:**
1. Update profile details.
2. Change email and verify.
3. Change password with verification/current password.
4. Customer requests account deletion/deactivation.

**Expected Output:**
- Sensitive actions require correct verification.
- Deactivation preserves bookings/payments/audits.
- Account status is visible to Admin.

---

# Phase 16: Final Error Handling Sweep

## 46. Unauthorized Access
**Actor:** All roles  
**Steps:**
1. Customer tries staff/Admin routes.
2. Marketing tries Accounting/Admin routes.
3. Accounting tries Marketing/Admin routes.

**Expected Output:**
- Access denied or redirected.
- No private data visible.

## 47. Invalid API Inputs
**Actor:** All roles  
**Steps:**
1. Submit empty forms.
2. Enter invalid dates, amounts, emails, pax.
3. Try stale/duplicate actions such as double claim, double approval, duplicate payment.

**Expected Output:**
- Clear validation/conflict messages.
- No duplicate records.
- No 500 errors.

## 48. Refresh And Persistence
**Actor:** All roles  
**Steps:**
1. Refresh after each major change.
2. Log out and back in.

**Expected Output:**
- Statuses persist.
- Counts remain accurate.
- No stale UI actions appear.

## 49. Mobile/Small Screen Check
**Actor:** All roles  
**Steps:**
1. Test customer home, booking, dashboard, staff dashboards on mobile width.

**Expected Output:**
- Text does not overlap.
- Buttons fit.
- Main actions remain reachable.

## 50. Production Readiness Scan
**Actor:** Admin/Developer  
**Steps:**
1. Run `.\php\php.exe artisan preflight:scan --json`.
2. Run `npm.cmd run build`.
3. Run `.\php\php.exe artisan test`.
4. Run `.\php\php.exe artisan route:list --except-vendor`.
5. Run `git diff --check`.

**Expected Output:**
- 0 test failures.
- 0 route failures.
- 0 preflight failures.
- Only expected production environment warnings remain until deployed.

---

# Trial Result Template

## Pass/Fail Summary
- Total cases run:
- Passed:
- Failed:
- Blocked:
- Retest needed:

## Bugs Found
| Case # | Role | Page/Feature | Bug | Expected | Actual | Severity | Screenshot/Notes |
|---|---|---|---|---|---|---|---|
| | | | | | | | |

## Business Flow Verdict
- Can a customer complete discovery to booking?
- Can Marketing claim/review/prepare?
- Can Accounting verify and receipt payments?
- Can Admin oversee and audit?
- Can completed events move to history and feedback?
- Is the system demo-ready?
