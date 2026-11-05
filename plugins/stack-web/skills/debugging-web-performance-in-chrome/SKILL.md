---
name: debugging-web-performance-in-chrome
description: Use when a page is slow to show its main content, scores badly in Lighthouse, leaks memory after repeated actions, fails keyboard or screen reader checks, loses a login cookie, or the chrome-devtools MCP will not connect. Not for the four-width visual sweep, which is verifying-ui-in-browser, nor for taste review.
---

# Debugging web performance in Chrome

Measure with a real trace, find which phase is slow, fix that phase, measure again. The chrome-devtools MCP provides the tools; this skill is the order of operations.

## When to use

- LCP over 2.5 s, jank, a heavy bundle, a failing Lighthouse audit.
- The tab's memory grows every time a dialog or route is opened and closed.
- Accessibility audit, focus order, contrast, tap targets.
- A session cookie vanishes, or 401 after login.
- `list_pages` fails or only a few tools appear.

## When not to use

- Does it render correctly at phone, tablet and desktop widths: `design-studio:verifying-ui-in-browser`.
- Server-side latency inside a function: `ops-and-sre:instrumenting-services`.

## Procedure

1. **Target one page.** `list_pages`, then pass its `pageId` to every page-scoped tool. Use a fresh `isolatedContext` page for first-visit and cookie tests so earlier state cannot leak in.
2. **LCP.** `navigate_page`, then `performance_start_trace` with reload and auto stop. Read `LCPBreakdown`, `LCPDiscovery`, `RenderBlocking`, `DocumentLatency` through `performance_analyze_insight`. Time to first byte should be about 40 percent of LCP, load duration about 40 percent, and the two delays near zero. Fix the largest delay first:
   - big load delay: the LCP image is found late; preload it, drop `loading="lazy"` on it, and set `fetchpriority="high"`;
   - big render delay: render-blocking CSS or script, or client-side rendering of the element;
   - big TTFB: caching or the server, not the image.
   Test on throttled network and CPU with `emulate`, not on your fast machine.
   **Done when:** a second trace shows the targeted subpart shrank.
3. **Lighthouse.** `lighthouse_audit` in navigation mode; filter `report.json` with `jq` for failed audits instead of reading it whole.
4. **Memory leak.** Take a baseline heap snapshot, repeat the suspect action about ten times, snapshot again, then revert the page state and snapshot a third time. Compare snapshots with the MCP memory tools (they need the memory debugging flag) and follow retainers of the growing class. Usual causes are detached DOM nodes, listeners never removed, closures in module state, and caches without a limit. Never read raw `.heapsnapshot` files into context. Close loaded snapshots afterwards.
5. **Accessibility.** Run the Lighthouse accessibility audit, then `take_snapshot` for the accessibility tree. Check names on controls, heading order, `aria-hidden` misuse, visible focus, and keyboard operation with `press_key`. Contrast 4.5:1 for body text.
6. **Cookies.** HttpOnly cookies cannot be read or cleared from script. Read the `Cookie` request header and `Set-Cookie` response header with `get_network_request`. Check `SameSite`, `Secure`, `Domain` and `Path` against the failing request. Clear state with a new isolated context, not `document.cookie`.
7. **Connection trouble.** For `Could not find DevToolsActivePort`, ask the owner to run the right Chrome build and enable remote debugging at `chrome://inspect/#remote-debugging`, then call `list_pages`. A tiny tool list means slim mode. Flag typos create an empty profile.

## Quick reference

| Symptom | First tool |
|---|---|
| Slow main content | `performance_start_trace` |
| Score | `lighthouse_audit` |
| Growing memory | `take_heapsnapshot` x3 |
| Login lost | `list_network_requests`, `get_network_request` |
| Not connecting | `list_pages` |

## Verification

- [ ] A before and after trace or snapshot comparison is quoted.
- [ ] The fix targeted the slowest subpart, not a guess.
- [ ] Leak count returns to baseline after reverting the state.
- [ ] No cookie or token value printed.

## Versions

- chrome-devtools-mcp 1.12.0 (verified 2026-11-05, https://registry.npmjs.org/chrome-devtools-mcp/latest); pin the version in `.mcp.json`.
- lighthouse 13.6.0 (verified 2026-11-05, https://registry.npmjs.org/lighthouse/latest)
