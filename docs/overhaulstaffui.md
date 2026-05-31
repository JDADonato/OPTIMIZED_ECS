# Staff UI Overhaul

## Purpose

This document is the source context for a complete Admin and Staff UI/UX rebuild. It is not a minor style cleanup, theme pass, or one-page adjustment plan. The staff interface should be redesigned as a cleaner, faster, easier-to-scan operational workspace while preserving the business workflows that already function.

The current staff styles should not be treated as the baseline. The redesign should keep the product's working behavior, permissions, backend rules, and operational data intact, but the presentation, layout rhythm, hierarchy, navigation, and table experience can be reconsidered from the ground up.

The goal is simple: staff should be able to understand what needs attention, act on it confidently, and move through their work without visual noise or confusion.

## Current Problem

The current staff pages feel visually noisy, uneven, and unfinished. Many screens look like they were patched one element at a time instead of designed as one coherent business system.

The most visible problems are:

- Tables are hard to scan because spacing, alignment, row density, and typography are inconsistent.
- Too many elements compete for attention at the same time.
- Maroon, heavy text, oversized pills, large bordered sections, and repeated labels are overused.
- Explanations, analytics, and secondary information often push the actual work too far down the page.
- Similar actions and statuses are presented differently across pages.
- Some pages use full-surface layouts, while others still feel like containers placed on top of the page.
- The current Admin and Staff UI does not yet feel as polished or trustworthy as the customer-facing side.

## Target Experience

The staff UI should feel like a real operational business system: calm, structured, professional, and quick to use.

Staff should be able to tell what to do next within a few seconds. Work queues should be compact, aligned, table-first, and action-oriented. Dashboards should summarize exceptions and priorities instead of flooding the page with every possible metric. Detail drawers and modals should handle deeper context without forcing every row or page header to carry too much information.

The target experience should feel:

- Clean, not empty.
- Dense, not cramped.
- Branded, not saturated.
- Operational, not decorative.
- Consistent, not repetitive.
- Helpful, not explanatory-heavy.

## Design Direction

The redesign should use modern operational dashboards as inspiration: calm app shell, clean sidebar, strict grid alignment, compact tables, subtle dividers, restrained color, predictable action placement, and quiet status feedback.

Eloquente branding should remain, but it should be used with restraint. Maroon should guide important actions and active navigation, not dominate every surface. Gold should signal attention or pending states, not act as generic decoration. Neutral spacing, typography, and alignment should carry most of the visual polish.

Avoid the current overuse of:

- Heavy bold text in too many places.
- Large uppercase labels.
- Oversized status pills.
- Repeated cards and bordered blocks.
- Long interpretation sections above work queues.
- Multiple competing primary buttons.
- Page sections that repeat the page header.

## UX Principles

Actual work comes before explanations. If staff opened a queue, the queue should appear quickly and high on the page.

Each surface should have one obvious primary action. Secondary actions should be quieter or grouped into menus.

Search, filters, sort, refresh, export, and the primary action should live in a predictable command area above the affected data.

Long explanations, decision support, analytics interpretation, audit context, and detailed notes should live in drawers, modals, side rails, or expandable details rather than permanently pushing down the workspace.

Rows should show only the most important fields. Supporting details should open in a drawer without losing the user's place in the queue.

Empty states should explain what is missing and offer one useful next action when one exists.

Loading and error states should help the user decide whether to wait, retry, or continue. Normal background syncing should stay quiet.

Color must communicate meaning and priority. It should not be used randomly or equally everywhere.

## Component Contract

The overhaul should be implemented through shared staff primitives before individual pages are restyled. Existing primitives such as `StaffCommandBar`, `StaffMetricStrip`, `StaffWorkTable`, `StaffStatusChip`, `StaffPrimaryAction`, `StaffDetailDrawer`, `StaffInlineInsight`, `StaffPageHeader`, and `StaffEmptyState` should be treated as the first implementation surface. Extend these primitives when the system needs a new pattern instead of rebuilding the same layout inside each page.

### Staff Shell and Navigation

The staff shell must keep a calm left navigation, a predictable main workspace, and reliable collapsed-sidebar behavior. Sidebar groups should represent real workflow groups, and child items should represent peer workspaces. Parent rows should expand or collapse groups instead of duplicating an overview page unless that overview has a distinct operational job.

Expanded, collapsed, and hover-expanded states must preserve the right workspace width, table alignment, command bars, and page header layout. Navigation counts should be used only when they help staff prioritize work.

### Page Headers

Each workspace should have one page header with the current location, short purpose, and optional compact page-level signals. Do not repeat the page title inside the first content section. Inner sections should use compact labels only when they help scan the page.

### Command Bars

Search, filters, sort, refresh, export, and the primary action for a table or queue should live in one predictable command area above the affected data. Desktop command bars should be compact and aligned, with search given the widest track, filters using medium tracks, and actions staying content-sized. At narrow widths, controls may stack into a single column.

### Metric Strips

Metric strips should be quiet operational summaries, not dashboard cards. They should use compact stat chips, subtle borders, neutral surfaces, and semantic color only in values or labels when the metric itself requires it. Metric strips should never compete with the main queue or push it far below the first viewport.

### Work Tables

Work queues should be table-first where the data is naturally tabular. Tables must use consistent header alignment, row density, column sizing, status placement, and action placement. Rows should expose the most important operational facts only, then open deeper detail in a drawer or modal without losing the user's place.

Each row should have one bold primary identifier. Supporting metadata should stay medium-weight and calmer than the primary value. Status and action columns should align consistently across queues. Row actions must remain available without forcing staff to navigate away from the queue.

### Status Chips

Status chips should be compact, sentence- or title-case, and semantically colored. They should not be oversized labels, decorative badges, or repeated summaries of information already visible nearby. Color must be paired with clear wording so meaning is not color-only.

### Actions

Each surface should have one obvious primary action. Secondary actions should be quieter, grouped, or placed in row action menus. Destructive actions must be visually separated from normal actions and use destructive language that clearly states the effect.

### Drawers and Modals

Drawers should be the default for record details, audit context, decision support, and secondary review because they preserve the queue behind them. Modals are appropriate for focused creation, confirmation, destructive decisions, and short editing tasks. Opening, saving, closing, or refreshing details must not reset the user's queue position, filters, sort, or pagination.

### Empty, Loading, Error, and Sync States

Empty states should name what is missing and offer one useful next action when one exists. Loading states should preserve layout shape and avoid blanking stable data during background refreshes. Error states should explain whether staff can retry, continue with saved data, or need to change input. Normal live and saved states should stay quiet; offline, stale, failed, saving, and reconnecting states should be visible.

## Semantic Color Contract

The staff UI should use color as a meaning system, not as decoration.

- Maroon is for selected navigation, primary actions, active workspace state, and the strongest brand moments.
- Gold or amber is for pending work, attention, non-blocking warnings, and decision-support signals.
- Emerald is for success, ready, verified, paid, completed, and active states.
- Rose or red is for destructive actions, overdue work, failed updates, blocked states, deactivated accounts, and danger.
- Slate or gray is for neutral system text, archived records, inactive records, disabled controls, secondary metadata, and low-priority context.

Color should never be the only indicator of meaning. Pair it with text, iconography, placement, or status wording.

## Page Templates

### Command Center

Used for Today and role home pages.

The page should show urgent exceptions, key operational signals, and shortcuts to high-priority work. It should not become a large analytics report by default.

### Work Queue

Used for Bookings, Finance, Handoff, Food Tastings, Accounts, System & Audit, and Event History.

The page should prioritize a compact command bar, useful counts, aligned rows, clear status, and fast actions. Detail review should happen in drawers or modals.

### Communication Desk

Used for Messages & Inquiries.

The page should keep the split-desk model, but with proportionate rails, quiet sync indicators, clear ownership state, and no unnecessary framing.

### Schedule Board

Used for Calendar and Availability.

The page should make date navigation, availability, events, and selected-date details clear without burying staff in forms or oversized calendar controls.

### Content Manager

Used for Announcements, Packages, Event Types, and Menu Items.

Each content area should be its own workspace. Creation and editing should use modals or drawers when that keeps the list visible. Media previews should be fixed-size, subtle, and non-disruptive.

### Configuration

Used for Settings, payment rules, business rules, notification preferences, and other system configuration.

Settings must be real editable settings, not shortcut cards disguised as settings.

### Analysis / Builder

Used for Analytics and Reports.

These pages may use cards, charts, and deeper interpretation because their purpose is exploration and reporting. They should still follow the same typography, color, spacing, and action rules.

## Functional Preservation Rules

The overhaul must not break working business functionality.

During the redesign:

- Do not remove existing business actions.
- Do not break role permissions.
- Do not change backend behavior unless required for the redesigned workflow.
- Existing forms, exports, modals, drawers, status changes, notifications, chats, and queues must still work.
- Any moved workflow must remain discoverable.
- Every redesigned page must keep clear success, loading, validation, and error behavior.
- Staff should never lose their place in a queue after opening details, saving changes, or refreshing data.
- Backend lifecycle policies remain unchanged unless a separate approved plan changes them.

The UI may change substantially, but the product must remain operationally complete.

## Implementation Phases

1. Create this document and freeze the new design direction.
2. Build shared staff UI primitives for shell, command bars, metric strips, tables, status chips, drawers, empty states, and inline insights.
3. Redesign the staff shell and navigation around workflow groups.
4. Rebuild the table system so headers, rows, density, actions, and statuses are consistent.
5. Redesign Admin pages first using the new templates.
6. QA Admin thoroughly across desktop, collapsed sidebar, tablet, and mobile layouts.
7. Apply the accepted system to Marketing and Accounting after Admin is approved.
8. Run a final consistency, accessibility, and regression pass.

## Pilot Rollout

Admin `Bookings & Intake` is the first redesign target and the reference implementation for the rest of the staff overhaul. It should be completed before other Admin work queues are redesigned because it exercises the core operational pattern: metric strip, command bar, search, filters, sort, table rows, statuses, row actions, assisted booking creation, discount handling, approval, modals, and event detail review.

The pilot should prove the shared component contract before the system spreads. Once `Bookings & Intake` is accepted, use the same patterns for Finance, Accounts, Handoff, Food Tastings, System & Audit, Event History, and other Admin work queues. Marketing and Accounting should remain unchanged until the Admin pilot and Admin pattern set are approved and stable.

## Acceptance Criteria

The overhaul is successful when:

- Staff pages look like one coherent product.
- Tables feel polished, aligned, and easy to scan.
- The first viewport shows useful work instead of repeated explanations.
- Actions are consistent across pages.
- Colors have clear semantic meaning.
- Sidebar collapse and expansion do not break layouts.
- Empty, loading, syncing, validation, and error states are clear.
- Staff can identify the next action on each operational page within a few seconds.
- Existing workflows still function after redesign.

## Rollout Default

Admin is the first redesign target. Marketing and Accounting should not be redesigned until the Admin version feels approved and stable.

Customer-facing pages remain unchanged unless a later plan explicitly includes them.
