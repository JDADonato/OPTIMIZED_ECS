# Staff UI Rules

## Admin Full-Surface Pattern
- Operational Admin tabs use the right side of the page as the workspace. Do not place a rounded card/container on top of the page.
- Keep `StaffPageHeader` as the only tab title and description. Inner areas should use compact labels, metrics, filters, and actions only.
- Use flat command strips and subtle dividers instead of nested cards, shadows, and panel-inside-panel framing.
- Main headings and important section labels use `#1a1a1a`. Gold and maroon are accents, not large background themes.
- Tables must align headers and data through shared table wrappers, explicit text alignment, and responsive wrapping. Avoid body-level horizontal scroll.
- Sidebar expanded/collapsed/hover states must not clip or off-center the right workspace. Use `minmax(0, 1fr)` and avoid fixed content widths.
- Normal live states (`Live`, `Saved`, background `Syncing`) should stay quiet. Show visible feedback for first load, saving, offline, stale, reconnecting after a grace period, or failed updates.

## Staff Dashboard Exceptions
- Dashboard and builder-style pages may keep grouped sections when grouping improves scanning or editing.
- Individual record cards are allowed for actual repeated records, catalog items, modals, and preview objects.
- Do not duplicate account, booking, finance, or status wording in both the page header and the first surface row.

## Review Checklist
- The first visible workspace below the page header reaches the content edges.
- No redundant tab title/description appears inside the tab body.
- Filters/actions sit in a flat strip and wrap cleanly.
- Tables still align after sidebar collapse and at tablet widths.
- Empty, loading, offline, stale, and failed states are visible without blanking existing data.
