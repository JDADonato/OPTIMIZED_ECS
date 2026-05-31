# Loading Speed Optimization List

This is a practical checklist of ways to make the system feel faster. The goal is simple: show useful content quickly, avoid unnecessary API calls, and keep background work from blocking the user.

## Customer Pages

- Server-hydrate first-screen data.
  - Put small public data directly into the first page response, like booking event types.
  - This avoids showing skeletons while the browser waits for a second API call.

- Cache public catalog data.
  - Event types, menu categories, packages, menu items, and pricing should use short public cache headers.
  - If the data rarely changes, the browser can reuse it instead of asking the server every time.

- Use client-side fallback cache.
  - Store small public lists in `sessionStorage` or a lightweight cache helper.
  - Returning to a page can show saved content instantly while refreshing quietly.

- Defer below-the-fold work.
  - Do not load data for sections the user cannot see yet.
  - Example: booking step 1 should not fetch full menu/pricing data before the customer reaches package/menu steps.

- Keep loading states honest.
  - Show skeletons or loading text only when data is truly loading.
  - Do not show `0`, empty states, or “No items found” until the request has finished.

## Booking Wizard

- Hydrate event types on `/book`.
  - The first booking step needs event type cards immediately.
  - Passing `initialEventTypes` from Laravel makes the page usable faster.

- Lazy-load later booking steps.
  - Calendar, menu builder, surcharge forms, and food tasting can be split into separate JavaScript chunks.
  - The first load stays lighter because the browser only loads step 1 and the shell first.

- Preload the next step during idle time.
  - After the first screen is interactive, quietly load the next likely step.
  - This keeps the initial load fast while making “Continue” feel smooth.

- Avoid early pricing/menu fetches.
  - The summary panel should not fetch menu items or pricing until there is a package or selected dishes to price.
  - Early steps can show event details and `0` total without needing the full catalog.

- Keep draft loading cheap.
  - Reading the booking draft from local storage is okay.
  - Avoid doing heavy recalculation or large API fetches just because a draft exists.

## Menu Gallery

- Separate loading from empty.
  - Menu should show skeleton cards while catalog/pricing requests are loading.
  - “No dishes found” should only appear after the catalog has loaded.

- Fetch catalog and pricing in parallel.
  - Menu data and pricing overrides do not depend on each other.
  - Loading them at the same time reduces wait time.

- Cache menu responses.
  - Public menu endpoints should use cache headers and backend query caching.
  - The menu should not hit the database from scratch on every visit.

- Keep filters client-side after load.
  - Search, category, price filters, and sorting should operate on loaded data.
  - This avoids extra server requests for every small filter change.

## Chat

- Render cached messages immediately.
  - When reopening chat, show the last known conversation state right away.
  - Refresh in the background instead of blocking the panel with “Opening chat...”.

- Use delta sync.
  - When reconnecting or reopening, fetch only messages after the latest cached server message ID.
  - This avoids reloading the same 20 messages again and again.

- Keep optimistic messages local.
  - Show the user’s outgoing message instantly with a sending state.
  - Replace it with the server-confirmed message using `client_temp_id`.

- Deduplicate messages.
  - Merge messages by `client_temp_id` first and server `id` second.
  - This prevents double messages from retries, reconnects, or realtime events.

- Time out stuck sends.
  - If a message is stuck in `sending` too long, mark it failed and show Retry/Remove.
  - This feels better than leaving the user wondering forever.

- Avoid blocking on realtime failure.
  - If Reverb broadcast fails but the database write succeeds, the HTTP response should still succeed.
  - Delta sync can catch the message later.

## Admin, Staff, And Dashboard Tables

- Use existing skeleton components.
  - Staff/admin tables should show `StaffSkeleton` or an equivalent loading panel while data loads.
  - Do not show empty tables before the request finishes.

- Paginate large lists.
  - Bookings, audit logs, messages, payments, and inventory should load in pages.
  - Avoid loading hundreds or thousands of rows at once.

- Add database indexes for frequent filters.
  - Common filters like status, role, created date, event date, category, and active flags should have indexes.
  - Indexes make database lookups much faster as data grows.

- Cache dashboard summaries briefly.
  - Summary cards and charts can usually be cached for 30-120 seconds.
  - This reduces repeated expensive calculations.

- Refresh quietly.
  - Use soft refresh indicators instead of clearing the whole screen.
  - Keep old data visible while new data is loading.

## Images And Assets

- Use local optimized images.
  - Prefer `.webp` assets for event types, menu items, and page visuals.
  - Large remote images slow down first load and can fail unpredictably.

- Serve right-sized images.
  - Cards do not need full-size hero images.
  - Use thumbnails or smaller image versions where possible.

- Lazy-load non-critical images.
  - Images below the fold should load after the first screen.
  - First-viewport images can load eagerly if they are important.

- Avoid layout shifts.
  - Give image containers stable dimensions.
  - This prevents the page from jumping while images load.

## JavaScript And Frontend Bundle

- Split heavy pages into chunks.
  - Large tools like dashboards, booking menu builder, charts, and staff messaging should not all load in the main bundle.
  - Load them only when the route or step needs them.

- Avoid importing heavy components too early.
  - If a component is only needed in a modal, drawer, or later step, lazy-load it.
  - This keeps the first render lighter.

- Debounce search inputs.
  - Wait briefly before filtering or fetching while the user types.
  - This prevents unnecessary repeated work.

- Memoize expensive calculations.
  - Totals, filtered lists, grouped messages, and dashboard summaries should use memoization where useful.
  - Recalculate only when the inputs change.

- Keep animations lightweight.
  - Use opacity and transform animations.
  - Avoid animating layout-heavy properties like width, height, top, or left when possible.

## Backend And Database

- Cache public catalog queries.
  - Use Laravel cache for event types, menu items, packages, and pricing maps.
  - Bust the cache when admins update catalog data.

- Select only needed columns.
  - API responses should avoid sending unused fields.
  - Smaller responses load faster and parse faster.

- Avoid repeated N+1 queries.
  - Use eager loading for related data that is shown together.
  - Example: messages should load sender info in the same request.

- Use stable pagination.
  - Prefer `before_id` and `after_id` for chat and timeline-style data.
  - This is faster and more reliable than offset pagination for growing lists.

- Keep expensive work out of page open.
  - Reports, exports, notifications, and audit processing should not block the main page response.
  - Queue background work where possible.

## Network And API Behavior

- Fetch independent data in parallel.
  - If requests do not depend on each other, start them together.
  - This shortens total waiting time.

- Avoid duplicate requests.
  - Reuse in-flight promises for shared resources like menu items.
  - Multiple components should not request the same endpoint at the same time.

- Use stale-while-refresh behavior.
  - Show cached data first.
  - Refresh in the background and update the UI only when new data arrives.

- Add retry only where useful.
  - Retry network failures for important actions like chat send.
  - Do not aggressively retry background reads that can wait until the next refresh.

## Perceived Speed

- Show the page shell immediately.
  - Navbar, headings, input areas, and layout should appear before slower data finishes.
  - A page that has structure feels faster than a blank page.

- Keep previous data visible during refresh.
  - Do not wipe the screen while refetching.
  - Use a small syncing indicator when needed.

- Use skeletons only for real waits.
  - Skeletons are helpful for first load.
  - They are annoying if shown every time the user reopens something that already has data.

- Make empty states precise.
  - Use “No dishes match these filters” after filtering loaded data.
  - Use “No dishes yet” only when the source catalog is truly empty after loading.

## Priority Checklist

1. Fix loading-before-empty states on all obvious async lists.
2. Hydrate first-screen data for important public pages.
3. Lazy-load heavy components that are not needed immediately.
4. Cache public catalog data on the backend and browser.
5. Use stale-while-refresh for chat, dashboards, and repeated visits.
6. Add indexes for common database filters and sorts.
7. Optimize images and avoid remote oversized assets.
8. Keep expensive background work out of initial page loads.
