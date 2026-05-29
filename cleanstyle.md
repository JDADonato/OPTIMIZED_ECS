# Clean Style Guide

This guide captures the current booking wizard style so the same visual language can be carried into other pages, dashboards, forms, modals, and workflows.

## Core Direction

Use a clean, warm, event-service interface. The look should feel polished, calm, premium, and easy to scan. Avoid overly futuristic styling, heavy gradients, glassmorphism, glows, loud shadows, and excessive icons.

The interface should prioritize:

- Clear hierarchy
- Warm ivory surfaces
- Deep brand red actions
- Gold accent labels
- Simple cards and panels
- Strong readable typography
- Compact but comfortable spacing
- Low visual noise

## Color System

Use these colors as the base palette:

- Brand red: `#720101`
- Brand red hover/deep: `#5a0101`
- Gold accent: `#9f6500`
- Bright gold button accent: `#f0aa0b`
- Warm page background: `#fffaf3`
- Soft cream surface: `#fff7e8`
- White surface: `#ffffff`
- Primary text: `#111827` or `#1a1a1a`
- Secondary text: `#64748b`
- Muted text: `#94a3b8`
- Border red tint: `rgba(114, 1, 1, .10)` to `.18`
- Neutral border: `rgba(15, 23, 42, .08)` to `.12`

Avoid dominant bright colors outside of status states. Do not make pages feel like a one-color red theme; use red mainly for active states, primary actions, and important totals.

## Typography

Use a bold display font for major headings and totals if available in the app. Use the normal app sans-serif for body, forms, tables, and supporting UI.

Recommended hierarchy:

- Page title: large, bold, tight line height, dark text
- Section kicker: small uppercase, bold, wide letter spacing, gold
- Section title: bold, dark, clear
- Body text: medium weight, slate text, generous line height
- Metadata labels: uppercase, small, muted slate
- Important values: bold or black weight, brand red or dark text

Avoid negative letter spacing. Avoid huge hero-style text inside compact cards, sidebars, or dashboards.

## Layout Principles

Use full-page layouts where possible instead of placing the entire experience inside a decorative card.

Good patterns:

- Page header band at the top with title, subtitle, progress, and step navigation
- Main content area with simple sections
- Right-side summary panel for booking or review workflows
- Collapsible summary/sidebar for dense information
- Cards only for individual choices, grouped form areas, modals, and repeated items

Avoid:

- Cards inside cards
- Floating decorative sections
- Too much vertical travel for simple input steps
- Duplicate progress indicators
- Redundant explanations repeated across panels

## Surfaces And Cards

Use simple, flat surfaces:

- Page background: `#fffaf3`
- Main cards: white or near-white
- Informational blocks: `#fff7e8`
- Border radius: usually `0.75rem` to `1rem`
- Borders: subtle, thin, warm red or neutral tint
- Shadows: minimal; use only when helpful for elevation

Cards should not rely on glows or gradients. Hover can use a tiny lift, subtle border change, or slightly stronger shadow.

Example card feel:

- White background
- `1px` light border
- `0.9rem` radius
- Padding around `1rem`
- Hover: border becomes slightly red-tinted and card moves up `1px` or `2px`

## Buttons

Primary buttons:

- Background: brand red `#720101`
- Hover: `#5a0101`
- Text: white
- Font: bold/black
- Radius: `.75rem` to `.9rem`
- Padding: comfortable but not oversized
- No glow
- No heavy shadow

Secondary buttons:

- White or cream background
- Subtle border
- Brand red text
- Hover: soft cream background

Avoid using pill buttons everywhere. Reserve pill shapes for step navigation or compact filters when they are truly useful.

## Step Navigation

For guided flows, use a single clear step navigation pattern.

Recommended:

- Top progress bar with current step number and percent complete
- Step chips below the header
- Active step: brand red background, white text
- Completed step: cream background, brand red text
- Upcoming step: white background, muted text

Do not show two separate progress bars or duplicate step indicators in the main content area.

## Forms

Form fields should be large enough to tap and easy to scan:

- White input background
- Subtle neutral border
- Rounded corners around `.85rem`
- Strong label above the field
- Placeholder text muted
- Focus state: red border or light red focus ring
- Avoid very tall textareas unless the task needs it

For simple data entry, keep the form compact. Put optional details under required details, not beside them if that makes the layout feel awkward.

## Selection Cards

Selection cards should be clear and calm:

- No gradients
- No glows
- Simple border and white/cream background
- Strong title
- Short explanatory copy
- Price and key attributes placed where customers can compare at a glance
- Buttons aligned consistently across cards

Use subtle color differences only to help distinguish choices, not to decorate heavily.

Selected state should use visual changes rather than extra "Selected" pills:

- Slight red border
- Warm cream background
- Optional small check mark only if it does not add clutter
- Keep text readable and high contrast

## Summary Panels

Summary panels should act like compact receipts, not full duplicated pages.

Recommended:

- Sticky right-side panel on desktop
- Collapsible narrow rail when hidden
- Ivory background
- Header with small gold kicker and red title
- Sections as accordions when content can become long
- Plain metadata text, not pill badges
- Important total fixed at bottom

Summary sections:

- Use section headers with uppercase muted labels
- Use small plain meta text such as `8 selected`, not badge/pill styling
- Animate expand/collapse briefly, around `180ms` to `240ms`
- If opening a dense section creates too much height, collapse other sections automatically

Package rows should look like normal summary rows:

- No badge/card pill treatment
- Use a simple row with label, package name, and amount
- Keep it aligned with other receipt rows

## Modals

Modals should match the booking wizard:

- Backdrop: black with medium opacity and subtle blur
- Modal background: `#fffaf3`
- Border: subtle red tint
- Radius: around `1.5rem` to `1.75rem`
- Header: simple, not gradient-heavy
- Title: bold display type
- Copy: slate text, medium weight
- Primary action: brand red button
- Error action: red button only for true errors

Avoid:

- Strong gradients
- Glossy/shiny effects
- Large decorative icons unless they clarify the state
- Oversized shadows that feel detached from the page

Review modals should:

- Summarize choices clearly
- Group content into simple cards
- Keep the final total visible near the submit action
- Put the actual final submit button inside the modal
- Allow closing/editing before submission

Success modals should:

- Confirm the action plainly
- Explain the next step briefly
- Use brand styling
- Provide one clear next action

## Icons

Use icons sparingly. Prefer text clarity over decorative icons.

Good icon use:

- Close button
- Expand/collapse arrows
- Small status indicators
- Search/filter controls if needed

Avoid placing icons beside every tab, dish category, package, or form label unless they improve recognition.

## Tables, Lists, And Dense Data

For dashboards and admin pages:

- Use restrained panels and tables
- Keep rows readable with enough spacing
- Use muted labels and strong values
- Use filters as compact controls
- Use brand red for active filters/actions
- Use gold for section labels or important accents

Avoid turning operational dashboards into marketing-style hero pages.

## Animation

Animations should be subtle and fast.

Recommended:

- Fade/scale modal entrance
- Accordion open/close: `180ms` to `240ms`
- Button hover color: `160ms`
- Card hover lift: `160ms` to `180ms`
- Progress width transition: `300ms`

Avoid long transitions, bouncing effects, glows, or motion that delays task completion.

## Scrollbars

When custom scrollbars are used:

- Thin scrollbar
- Transparent track
- Thumb in muted brand red
- Hover thumb can become gold-red

Do not create double scrollbars. Prefer collapsing content, pagination, or tighter grouping before adding nested scrolling.

## Content Tone

Use clear, customer-facing language.

Good wording:

- "Review your event plan"
- "Choose your preferred date"
- "Check your choices before sending"
- "Estimated total"
- "Food tasting lets you sample selected dishes before the event"

Avoid internal or misleading terms:

- "AI-assisted" unless truly AI-powered
- "System will..." if it feels technical or impersonal
- Debug/status wording customers should not see
- Overly formal or jargon-heavy text

## Accessibility And Readability

Always ensure:

- Text has strong contrast
- Buttons are readable at a glance
- Long names truncate only where full detail is available elsewhere
- Focus states are visible
- Inputs and buttons are tap-friendly
- Modal close buttons have accessible labels
- Content does not overlap on smaller screens

## Reusable Checklist

Before applying this style to a new page, check:

- Does the page use the warm ivory background?
- Are primary actions brand red?
- Are section kickers small, uppercase, and gold?
- Are cards simple and flat?
- Are modals ivory, rounded, and brand-aligned?
- Are there no unnecessary glows or gradients?
- Are icons used only where helpful?
- Is the content written for customers or staff, not developers?
- Does the layout avoid unnecessary vertical scrolling?
- Does dense content collapse, paginate, or filter instead of becoming overwhelming?
