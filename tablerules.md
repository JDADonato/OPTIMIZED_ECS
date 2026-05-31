# Table Rules

These rules apply to every table unless a specific feature has a documented reason to behave differently.

## Structure

- Tables should use real table markup for tabular data.
- Columns should be sized dynamically based on their data, while still feeling evenly balanced against neighboring columns.
- Avoid fixed column widths unless the data format is predictable and the width prevents layout shifting.
- Long text columns should be allowed more room than compact columns.
- Compact columns such as status, counts, dates, and actions should not take more space than their data needs.
- Tables should not cause unnecessary horizontal scrolling on normal desktop widths.
- If horizontal scrolling is unavoidable on small screens, keep it inside the table container.

## Header Alignment

- All table headers should be center aligned.
- Header alignment should stay visually centered even when the body data has different alignment.
- Header text should be short, scannable, and consistent with the module naming.

## Data Alignment

- Choose body cell alignment based on the data type.
- Text-heavy data should be left aligned.
- Names, emails, booking references, descriptions, notes, and labels should usually be left aligned.
- Numbers used for counts, quantities, percentages, and statuses can be centered when that improves scanning.
- Money and price columns should be left aligned unless a specific finance layout requires otherwise.
- Dates can be left or center aligned based on the table, but must be consistent within the same table.
- Status pills should be center aligned when they are in a compact status column.
- Action buttons must always be center aligned.

## Actions

- Action columns should be compact and centered.
- Action buttons should use clear labels or familiar icons.
- Multiple action buttons in one row should be grouped with consistent spacing.
- Avoid making action columns so wide that they dominate the table.
- Destructive actions should remain visually distinct from neutral or primary actions.

## Responsive Behavior

- Tables must remain readable in collapsed-sidebar and mobile layouts.
- Data should wrap cleanly instead of overlapping or clipping.
- Important identifiers such as booking references, customer names, and payment labels should remain visible.
- Use truncation only when the full value is available elsewhere, such as a drawer, modal, tooltip, or detail page.

## Visual Consistency

- Row height should be consistent within a table.
- Header cells and body cells should use matching column spacing.
- Borders and separators should be subtle, consistent, and not visually heavier than the data.
- Table controls above the table should align with the table width and spacing.
- Empty states should use the same table container area where the rows would normally appear.

## Review Checklist

- Are all headers center aligned?
- Are body cells aligned based on their actual data type?
- Are action buttons centered?
- Do columns feel dynamically balanced instead of rigid or uneven?
- Does the table avoid unnecessary horizontal scroll on desktop?
- Does the table still read well on mobile or narrow layouts?
- Are long names, emails, and notes handled without breaking the layout?
