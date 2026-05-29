# Conversion Optimization Roadmap

## Operating Contract

You are a Growth Architect and System Conversion Optimization Expert.

Your mission is to iteratively improve this `PLANS.md` file so the system roadmap becomes more likely to increase completed bookings, reduce user drop-off, and improve conversion from inquiry to booking to payment to completed event.

### Hard Restrictions

- You must not modify, generate, or edit software source code.
- You must not create migrations, controllers, routes, components, stylesheets, scripts, tests, or config files.
- You must not use file-writing tools on any file except `PLANS.md`.
- Your only allowed persistent output artifact is an updated `PLANS.md`.
- You may read existing project files, notes, docs, screenshots, analytics summaries, and `PLANS.md` to understand the product.
- You may propose software changes inside `PLANS.md`, but you must not implement them.

### Workflow Mode

Operate in planning-only autonomous research mode.

Use an Autoresearch-style loop:

1. Read the current `PLANS.md`.
2. Identify the current iteration number.
3. Analyze the existing roadmap against the conversion goal.
4. Propose improvements.
5. Score the roadmap.
6. Update `PLANS.md`.
7. Stop permanently after iteration 5.

### Stop Rule

Before doing any work, inspect `PLANS.md`.

If `PLANS.md` already contains `Iteration 5` or a higher completed iteration:

- Do not continue optimizing.
- Do not create iteration 6.
- Output only: `PLANS.md has reached the 5-iteration limit. No further optimization will be performed.`

If fewer than 5 iterations exist:

- Continue with exactly one new iteration.
- Increment the iteration number by 1.
- Update only `PLANS.md`.

## North Star Goal

Increase completed bookings by improving the customer journey, staff response workflow, payment completion, and event readiness.

## Current Conversion Hypothesis

Completed bookings will increase most if Eloquente removes the three biggest conversion blockers: uncertainty before starting a booking, staff delay before confirmation, and payment/readiness confusion after approval. The highest-value roadmap should make the right next action obvious for customers and staff at every stage.

## Roadmap

### 1. Conversion-Focused Booking Entry

- **Problem:** Customers and walk-ins may hesitate if they are unsure whether to self-book, ask questions first, or let staff assist them.
- **Proposed solution:** Present three clear entry paths: book online, ask a question, or assisted booking with Marketing. Keep assisted booking step-by-step so staff can show it to walk-ins.
- **Target user:** Customer, walk-in customer, Marketing staff.
- **Expected conversion impact:** High.
- **Effort level:** Medium.
- **Risk:** Low.
- **Success metric:** Higher booking starts and higher booking wizard completion rate.
- **Dependencies:** Booking wizard, assisted booking wizard, guest inquiries, customer account creation.
- **Acceptance criteria:** A customer or staff member can choose the correct booking path in one screen, and every path ends in either a submitted booking or staff-owned follow-up.

### 2. Booking Wizard Completion And Recovery

- **Problem:** Long booking flows can cause customers to pause or abandon before submission.
- **Proposed solution:** Make progress, missing requirements, price changes, and draft recovery obvious. Keep final review focused on date, pax, package/menu, venue, contact, and payment schedule.
- **Target user:** Customer and Marketing-assisted customer.
- **Expected conversion impact:** High.
- **Effort level:** Medium.
- **Risk:** Medium.
- **Success metric:** Lower wizard abandonment and fewer invalid/incomplete submissions.
- **Dependencies:** Booking draft storage, validation, availability checks, pricing recalculation.
- **Acceptance criteria:** Customers can resume safely, understand what blocks submission, and confirm pricing-impacting changes before saving.

### 3. Staff Intake Speed And Ownership

- **Problem:** Pending bookings lose momentum when staff are unsure what to claim, review, or ask from customers.
- **Proposed solution:** Make Marketing/Admin intake queues action-first: needs action, available to claim, waiting on customer, transfers, and my bookings. Use one event drawer for claim, clarification, approval, rejection, status, messages, and prep list access.
- **Target user:** Marketing staff and Admin.
- **Expected conversion impact:** High.
- **Effort level:** Medium.
- **Risk:** Low.
- **Success metric:** Shorter average time from booking submission to confirmation or clarification request.
- **Dependencies:** Booking claim flow, event drawer, notification system.
- **Acceptance criteria:** Staff can move a booking from submitted to confirmed or waiting-on-customer without leaving the active booking workspace.

### 4. Payment Completion And Finance Follow-Up

- **Problem:** Customers may delay payment if balance, due dates, and status are unclear.
- **Proposed solution:** Make customer payment obligations explicit and make Accounting queues action-only: needs verification, overdue, exceptions, upcoming due, and refunds.
- **Target user:** Customer and Accounting staff.
- **Expected conversion impact:** High.
- **Effort level:** Medium.
- **Risk:** Medium.
- **Success metric:** Higher on-time reservation/down-payment/final-payment completion.
- **Dependencies:** Payment schedule, accounting queues, branded emails, receipts.
- **Acceptance criteria:** Customers always see the next payment and remaining balance, while Accounting can verify, reject, remind, refund, or issue receipts from one finance surface.

### 5. Event Readiness Confidence

- **Problem:** Even confirmed bookings can feel uncertain if readiness, handoff, menu, and customer notes are vague.
- **Proposed solution:** Turn journey tracking and staff handoff into owner-aware readiness: customer details, final menu, payment clearance, tasting outcome, venue access, and prep list status.
- **Target user:** Customer, Marketing staff, Accounting staff, Admin.
- **Expected conversion impact:** Medium.
- **Effort level:** Medium.
- **Risk:** Low.
- **Success metric:** Fewer last-minute clarification issues and more completed events.
- **Dependencies:** Event handoff, journey tracker, staff notifications.
- **Acceptance criteria:** Each role sees what they own, what is blocked by another role, and what is already ready without duplicate tracker sections pushing down the main task.

### 6. Post-Event Trust And Repeat Demand

- **Problem:** Completed events may not consistently generate feedback, testimonials, referrals, or future bookings.
- **Proposed solution:** Guide completed customers into feedback, follow up on low ratings, and route testimonial candidates to Marketing.
- **Target user:** Customer, Marketing staff, Admin.
- **Expected conversion impact:** Medium.
- **Effort level:** Low.
- **Risk:** Low.
- **Success metric:** More feedback submissions and testimonial candidates after completed events.
- **Dependencies:** Feedback requests, event history, customer notifications.
- **Acceptance criteria:** Completed customers are guided to feedback, and staff know which responses need follow-up.

### 7. Demo And Weak-Internet Resilience

- **Problem:** Slow loading during demonstrations makes the system feel unreliable and can hide the actual workflow quality.
- **Proposed solution:** Use same-user cached dashboard data, subtle loaders, refresh-on-change behavior, and clear offline/slow-connection states.
- **Target user:** All roles, especially staff during live defense.
- **Expected conversion impact:** Medium.
- **Effort level:** Medium.
- **Risk:** Medium.
- **Success metric:** Faster perceived dashboard load time and fewer failed demo actions caused by weak internet.
- **Dependencies:** Smart resource cache, CSRF recovery, staff layout, backend mutation validation.
- **Acceptance criteria:** Previously opened dashboards appear quickly, risky actions still validate server-side, and users see clear feedback when the connection is unstable.

## Iteration Log

### Iteration 0 Baseline

#### What Changed

Created the autonomous conversion-roadmap loop and initialized the first roadmap baseline.

#### Reasoning

The baseline focuses on completed bookings rather than surface-level traffic or visual polish. It prioritizes the full conversion chain: inquiry, booking, staff confirmation, payment, event readiness, and post-event trust.

#### Scorecard

- Conversion impact: 7/10
- Booking completion impact: 7/10
- Customer friction reduction: 7/10
- Staff workflow efficiency: 7/10
- Implementation feasibility: 8/10
- Risk level: 3/10
- Measurement clarity: 6/10

#### Keep / Revise / Replace Decision

Revise. The baseline is directionally strong, but future iterations should sharpen priority order, measurement, and dependency sequencing.

#### Next Research Questions

- Which exact step currently loses the most users: inquiry, booking start, booking submission, confirmation, or payment?
- Which staff queue causes the most delay before a booking becomes confirmed?
- Which customer-facing uncertainty most often leads to messages, cancellations, or stalled payments?

### Iteration 1

#### What Changed

Refocused the roadmap around a single conversion chain: start booking, finish booking, get staff confirmation, complete payment, reach event readiness, and capture post-event trust.

#### Reasoning

The baseline had the right areas, but it treated them like parallel improvements. Completed bookings depend on sequence. The roadmap now prioritizes bottlenecks in the order customers experience them.

#### Scorecard

- Conversion impact: 8/10
- Booking completion impact: 8/10
- Customer friction reduction: 8/10
- Staff workflow efficiency: 7/10
- Implementation feasibility: 8/10
- Risk level: 3/10
- Measurement clarity: 7/10

#### Keep / Revise / Replace Decision

Revise. The roadmap is now conversion-sequenced, but staff ownership and payment follow-up need stronger detail.

#### Next Research Questions

- Which booking statuses should count as true conversion progress?
- Which staff action has the highest impact on booking confirmation speed?
- Which customer reminder should be prioritized first: incomplete booking, clarification, or payment?

### Iteration 2

#### What Changed

Strengthened staff-facing ownership by making Marketing intake and Accounting finance queues action-only instead of list-first.

#### Reasoning

Bookings stall when staff dashboards show many records but do not make the next action obvious. Action-first queues reduce indecision and shorten the delay between customer submission and staff response.

#### Scorecard

- Conversion impact: 8/10
- Booking completion impact: 8/10
- Customer friction reduction: 8/10
- Staff workflow efficiency: 9/10
- Implementation feasibility: 7/10
- Risk level: 4/10
- Measurement clarity: 8/10

#### Keep / Revise / Replace Decision

Revise. Staff workflow is clearer, but payment completion and customer confidence need stronger success metrics.

#### Next Research Questions

- What is the target response time for Marketing after a booking is submitted?
- What is the target verification time for Accounting after payment proof is uploaded?
- Which staff notifications should be considered conversion-critical?

### Iteration 3

#### What Changed

Expanded the payment initiative from basic clarity into a finance conversion system: next payment visibility, reminders, verification, receipts, refunds, and exception handling.

#### Reasoning

Payment is a major conversion gate because a booking can be approved but still not become a reliable completed event. The roadmap now treats payment completion as a core conversion step rather than an accounting-only task.

#### Scorecard

- Conversion impact: 9/10
- Booking completion impact: 9/10
- Customer friction reduction: 8/10
- Staff workflow efficiency: 9/10
- Implementation feasibility: 7/10
- Risk level: 5/10
- Measurement clarity: 8/10

#### Keep / Revise / Replace Decision

Revise. Payment is now strong, but the roadmap should account for demo reliability and weak-internet conditions because failed loading can damage confidence during evaluation.

#### Next Research Questions

- Which payment step fails most often: checkout start, proof submission, verification, or final balance?
- Which payment reminder timing is most appropriate for reservation, down payment, and final payment?
- Which finance states should be shown to customers versus only staff?

### Iteration 4

#### What Changed

Added demo and weak-internet resilience as a conversion-supporting initiative. The roadmap now includes fast perceived loading, same-user cached dashboard data, subtle loaders, and clear slow-connection states.

#### Reasoning

Even strong workflows feel broken if users wait too long after sign-in or during role switching. For a defense/demo context, perceived reliability affects trust in the whole system. This initiative supports conversion by preventing avoidable hesitation and awkward staff/customer handoffs.

#### Scorecard

- Conversion impact: 9/10
- Booking completion impact: 9/10
- Customer friction reduction: 9/10
- Staff workflow efficiency: 9/10
- Implementation feasibility: 7/10
- Risk level: 5/10
- Measurement clarity: 8/10

#### Keep / Revise / Replace Decision

Revise. The roadmap is nearly complete, but the final iteration should lock the implementation order so the team knows what to build first.

#### Next Research Questions

- Which pages must be pre-opened or warmed before the final demo?
- Which data can be safely cached for viewing without risking wrong decisions?
- Which actions must always force fresh backend validation?

### Iteration 5

#### What Changed

Finalized the roadmap priority order and clarified the first implementation sequence: booking entry and completion first, staff intake second, payment completion third, readiness fourth, post-event trust fifth, and demo resilience across all phases.

#### Reasoning

This order maximizes completed bookings because it follows the actual funnel. It avoids spending too much effort on lower-funnel polish before the system reliably gets customers to a submitted, confirmed, paid, and completed event.

#### Scorecard

- Conversion impact: 9/10
- Booking completion impact: 9/10
- Customer friction reduction: 9/10
- Staff workflow efficiency: 9/10
- Implementation feasibility: 8/10
- Risk level: 4/10
- Measurement clarity: 9/10

#### Keep / Revise / Replace Decision

Keep. The roadmap is ready for implementation planning and should not continue to Iteration 6.

#### Next Research Questions

- Which success metrics can be tracked automatically before production?
- Which conversion metrics must be validated manually during group testing?
- Which roadmap items should be deferred if time becomes limited?

## Final 5-Iteration Recommendation

Implement the roadmap in this order:

1. **Conversion-Focused Booking Entry**
   - Make self-booking, inquiry, and assisted booking paths unmistakable.
   - This is the highest-leverage first step because no later conversion improvement matters if users do not start correctly.

2. **Booking Wizard Completion And Recovery**
   - Improve progress clarity, validation feedback, draft recovery, and pricing-change confirmation.
   - This turns started bookings into submitted bookings.

3. **Staff Intake Speed And Ownership**
   - Keep Marketing/Admin focused on action queues and one event drawer.
   - This turns submitted bookings into confirmed or clearly waiting-on-customer bookings.

4. **Payment Completion And Finance Follow-Up**
   - Make next payment, balance, reminders, verification, and receipts clear.
   - This turns confirmed bookings into financially reliable events.

5. **Event Readiness Confidence**
   - Make customer and staff readiness owner-aware.
   - This reduces last-minute confusion and protects completed events.

6. **Post-Event Trust And Repeat Demand**
   - Capture feedback, testimonials, and follow-up opportunities.
   - This improves trust and future bookings after event completion.

7. **Demo And Weak-Internet Resilience**
   - Apply fast loading, smart cache, subtle skeletons, and server-side validation across all above areas.
   - This should be treated as a system-wide quality layer, not a standalone feature.

The final optimization cycle is complete at Iteration 5. Do not create Iteration 6.
