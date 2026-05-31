# Staff UI Rules

## Staff UI v2 Operating Model
- Staff screens optimize for work speed first: scanning, prioritizing, and acting. Do not design operational staff pages as marketing pages, reports, or training manuals.
- Every staff page must declare one page type and follow its template:
  - `Command Center`: role home/Today pages; show only urgent work, top exceptions, and shortcuts.
  - `Work Queue`: bookings, handoff, tastings, finance, accounts, system audit, and event history; table/list first, action first.
  - `Communication Desk`: messages and inquiries; split queue/thread/context layout.
  - `Schedule Board`: calendar and availability; time/grid first with compact controls.
  - `Content Manager`: announcements, packages, event types, and menu items; library/list plus modal or drawer editor.
  - `Configuration`: settings, payment rules, business rules; editable grouped forms with save feedback.
  - `Analysis/Builder`: analytics and reports; cards and deeper interpretation are allowed here.
- A page should answer, in order: where am I, what needs action, what can I do now, and where are the details.
- Persistent account/security reminders must not push down every staff workspace. Show them as compact tasks in Today, Settings/Profile, or a dismissible header item.
- Global counters are allowed only when they support the current work. Page-specific metrics should not compete with generic `Bookings / Customers / Staff / Refunds` counters.

## Staff UI v2 Page Templates
- `Command Center`: page header, compact urgent-actions strip, top exception list, then optional small dashboard groups. Avoid full report sections above urgent work.
- `Work Queue`: page header, optional metric strip, one command bar, table/list, detail drawer. Analytics and explanations belong behind `View analysis` or in Analytics.
- `Communication Desk`: page header, queue stats, conversation rail, thread, context rail. Normal live/sync states stay quiet.
- `Schedule Board`: page header, month/date command bar, schedule grid/list, contextual side rail only if it helps the selected date/event.
- `Content Manager`: page header, action/metric strip, library table/list. Create/edit flows open in modal/drawer unless the whole page is a builder.
- `Configuration`: page header, section nav if needed, editable forms, validation summary, save status. Do not use shortcut cards as settings.
- `Analysis/Builder`: page header, filters, charts/cards, interpretation. This is the only staff page type where larger explanatory cards are acceptable.

## Staff UI v2 Components
- Prefer shared primitives over per-page utility class piles: `StaffCommandBar`, `StaffMetricStrip`, `StaffWorkTable`, `StaffStatusChip`, `StaffPrimaryAction`, `StaffDetailDrawer`, and `StaffInlineInsight`.
- A queue command bar must contain related search, filters, sort, refresh/export, and primary actions in one predictable row on desktop.
- A metric strip is a quiet row of compact stat chips. Do not add colored rails, special first cards, or heavy shadows.
- A detail drawer is the default place for record review, detailed interpretation, audit context, and secondary actions.
- A table row should have one bold primary identifier. Supporting metadata should be medium weight and calmer than the primary value.

## Admin Full-Surface Pattern
- Operational Admin tabs use the right side of the page as the workspace. Do not place a rounded card/container on top of the page.
- Keep `StaffPageHeader` as the only tab title and description. Inner areas should use compact labels, metrics, filters, and actions only.
- Use flat command strips and subtle dividers instead of nested cards, shadows, and panel-inside-panel framing.
- True peer workspaces must live in the sidebar, not as another tab strip inside the page. Example: `Public Content` expands to `Announcements`, `Packages`, `Event Types`, and `Menu Items`; `Accounts` expands to `Staff Accounts` and `Customer Accounts`.
- Sidebar parent rows are toggle-only. Child rows navigate. Do not make a parent navigate to a duplicate "overview" page unless that overview is a real workspace with its own unique job.
- Metric/summary strips must have their own breathing room from the page header. Never let stat chips sit flush against the header divider; use a padded strip with a divider below it.
- Metric/stat cards should stay neutral and quiet: no colored leading rails, no special first-card styling, and no heavy shadows. Use color inside the value/status text only when the metric itself has semantic meaning.
- Filters, search, and refresh/actions should share one responsive command strip whenever they belong to the same table or queue. Do not let full-width controls stack into one row each on desktop.
- In command strips, avoid `width: 100%` controls unless the strip is intentionally single-column. Use explicit grid/flex tracks such as search = widest, filters = medium, actions = content-sized.
- Refresh buttons should be content-sized and aligned with the filters they refresh, not isolated on a separate row unless the viewport is narrow.
- Operational interpretation/analysis should default to a compact summary strip plus expandable detail. Do not place tall insight cards above the main table/list in queue tabs.
- Long recommendations must use readable sentence case in expandable details, not all-caps blocks in the permanent workspace.
- Main headings and important section labels use `#1a1a1a`. Gold and maroon are accents, not large background themes.
- Tables must align headers and data through shared table wrappers, explicit text alignment, and responsive wrapping. Avoid body-level horizontal scroll.
- Sidebar expanded/collapsed/hover states must not clip or off-center the right workspace. Use `minmax(0, 1fr)` and avoid fixed content widths.
- Normal live states (`Live`, `Saved`, background `Syncing`) should stay quiet. Show visible feedback for first load, saving, offline, stale, reconnecting after a grace period, or failed updates.

## Sidebar Subpage Navigation
- Use sidebar dropdown children for stable, peer-level workspaces inside a module. Good examples: catalog setup pages, account audience pages, finance segments if they become full workspaces.
- Keep temporary filters, statuses, categories, and view modes inside the workspace. Good examples: `Active/Archived`, menu food categories, date ranges, status filters, and table density controls.
- Parent sidebar labels should describe the broader module; child labels should describe the exact workplace the staff member opens.
- The active child must auto-expand its parent. Expanded/collapsed parent state should be remembered per role/browser.
- Collapsed sidebars should tuck cleanly. Child rows appear only when the sidebar is pinned open or hover-expanded.
- Avoid duplicating the same navigation in both the sidebar and the page body. If it appears in the sidebar, remove the in-page tab strip.

## Typography Hierarchy
- Use Outfit for page titles and major headings; use Inter for body text, controls, tables, labels, and dense operational data.
- Body and table text should feel calm and readable. Prefer medium/semi-bold weights for metadata; reserve black/heavy weights for labels, totals, IDs, and primary row names.
- Avoid long uppercase sentences. Uppercase is allowed for short eyebrows, table headers, compact status labels, and count chips only.
- Page titles should use `#1a1a1a`; secondary text should use slate/gray. Do not make every label equally heavy.
- Row content should follow a predictable emphasis order: primary identifier first, supporting metadata second, status/action last.

## Intentional Color Hierarchy
- Use brand maroon `#720101` for selected navigation, primary actions, and active workspace state.
- Use black `#1a1a1a` for primary headings and important text.
- Use gold/amber for attention, pending states, decision support, and non-blocking warnings.
- Use emerald for success, ready, verified, paid, and active states.
- Use rose/red for destructive actions, overdue, failed, blocked, deactivated, or danger states.
- Use slate/gray for archived, inactive, disabled, secondary metadata, and neutral system text.
- Color must never be the only meaning. Pair it with clear text, iconography, placement, or status wording.
- Avoid "flat sameness": the highest-priority action/status on a surface should have the strongest contrast, while supporting controls stay quieter.

## HCI Layout System
- Use a 4px spacing scale: `4, 8, 12, 16, 24, 32`. Dense operational rows use `12-16px` vertical padding.
- Related controls stay close together; unrelated regions use dividers and concise section labels instead of large empty gaps.
- Primary action belongs at the top-right of the relevant surface. Destructive actions should be visually separated from normal actions.
- Search, filters, sort, refresh, export, and primary actions belong in one predictable command strip above the affected table/list.
- Status and count summaries appear before filters only when they help the user decide what to do next.
- Summary cards are informational anchors, not attention banners. Keep their borders, radius, and background consistent unless a real warning/success state is being communicated.
- Detailed explanations, interpretation, and "how this works" content belong in drawers/modals or collapsed details, not permanently above work queues.
- Page surfaces are flat and edge-to-edge. Tables, strips, and workspace sections use subtle dividers. Large rounded containers are reserved for modals, drawers, and true standalone cards.
- Repeated record cards may use small radii. Buttons and inputs use consistent moderate radii. Pills are only for statuses, counts, and compact tags.
- Every table must remain usable when the sidebar is expanded, collapsed, or hover-expanded. Use `minmax(0, 1fr)`, wrapped metadata, and compact row variants before page-level horizontal scrolling.

## Business Workflow Improvements
- Prefer saved views for high-use queues such as `Overdue payments`, `Unassigned chats`, and `Deactivated customers`.
- Add bulk actions only where safe and reversible, such as marking notifications read, archiving selected records, or exporting filtered rows.
- Use drawers for record detail when staff need quick review and return to the queue.
- Add clear `Next action` language in queues instead of relying only on raw statuses.
- Add audit/context side rails only when they support the selected record.
- Empty states should name what is missing and offer one next useful action.
- Dashboards can stay grouped, but operational queues should be table-first and action-first.

## Queue And Table Surfaces
- A queue page should read top-to-bottom as: page header, optional padded metric strip, one command strip, then the table/list.
- If queue analytics are useful, place them between metrics and filters as a one-row insight summary with small signal chips and a `View analysis` action.
- Search bars should not consume an entire desktop row when paired with filters. Target a compact layout like `search / status filter / owner filter / action`.
- Filter labels/options should be concise enough to fit their track; wrap only on tablet/mobile.
- Use tab-specific utility classes when the generic command strip is too broad. Example: a handoff board can define a Handoff command grid instead of inheriting full-width staff controls.
- Account management should follow `sidebar child -> metrics/actions -> filters -> table`; do not repeat the active segment name as a second section heading above the table.
- At `<= 900px`, command strips may collapse to one column. Desktop and collapsed-sidebar desktop should still preserve the compact row layout.

## Staff Dashboard Exceptions
- Dashboard and builder-style pages may keep grouped sections when grouping improves scanning or editing.
- Individual record cards are allowed for actual repeated records, catalog items, modals, and preview objects.
- Do not duplicate account, booking, finance, or status wording in both the page header and the first surface row.

## Review Checklist
- The first visible workspace below the page header reaches the content edges.
- Metric strips have top/bottom padding and do not touch the header divider.
- No redundant tab title/description appears inside the tab body.
- Peer subpages appear as sidebar children, not duplicated tab strips inside the workspace.
- Body/table typography uses Inter-like calm weights, while headings use the display hierarchy.
- Color emphasis has a clear priority order: selected/primary, attention, success, danger, neutral.
- Spacing follows the 4px scale and keeps the main work queue visible without unnecessary scrolling.
- Operational insights use compact summary strips; any detailed interpretation opens in a drawer/modal.
- Filters/actions sit in one flat strip on desktop, with search/filter/action sizing that uses space efficiently.
- Tables still align after sidebar collapse and at tablet widths.
- Empty, loading, offline, stale, and failed states are visible without blanking existing data.
