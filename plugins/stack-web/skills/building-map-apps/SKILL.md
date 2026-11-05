---
name: building-map-apps
description: Use when building a web map with MapLibre or a paid tile or basemap API, showing selections or before/after states on a map, or shipping a map as a single offline page. Not for charts and data displays, which is design-studio:styling-charts-and-data-displays, nor for general frontend setup, which is building-tanstack-frontends.
---

# Building map apps

A map page has two risks: leaking the tile provider's key to the browser, and rebuilding layers on every state change. Proxy the tiles through your own server and drive the map with filters.

## When to use

- A MapLibre (or similar) map with a paid or keyed basemap.
- Toggling subsets of features, panels that cover the map, a page that must work offline.

## When not to use

- Charts and dashboards: `design-studio:styling-charts-and-data-displays`.
- Standing up the frontend itself: `stack-web:building-tanstack-frontends`.

## Procedure

1. **Proxy the basemap.** Serve tiles from your own route (`/tiles/{z}/{x}/{y}`) so the browser only sees your origin and the key stays server side, behind the same auth as the page. Validate `z <= 22`, `x` and `y` below `2^z`, and digits-only segments before calling upstream.
   **Done when:** the page source and network log contain no provider key.
2. **Manage the upstream session.** If the tile API needs a session, cache it in memory, refresh it an hour before `expiry`, and share one in-flight promise so concurrent tiles do not each create one. Retry session creation a few times on 403: right after enabling an API or changing key restrictions, calls are refused for a while. On 400, 401 or 403 for a tile, retry once with a fresh session.
3. **Cache and attribute.** Forward the upstream `max-age` and send `Cache-Control: private`. Fetch the viewport attribution text and show it; the provider's terms require it. Restyle in the session request (desaturate, hide points of interest and transit) so your data layers stand out.
4. **Drive the map with filters** (table below). One GeoJSON source per kind of feature; change what is visible with `setFilter`.
5. **Plan for offline.** For a single-file or offline page, vendor the library JS and CSS and inline them; no CDN. Decide what the page shows without tiles (a blank background with the data layers still readable).
   **Done when:** the page loads with the network disabled and the data layers are visible.

## Quick reference

| Situation | Do |
|---|---|
| Show a subset (selection, before/after, search hits) | Keep one source per kind and `setFilter` on layers; do not remove and re-add layers |
| Blank map after a panel opens or the window resizes | `new ResizeObserver(() => requestAnimationFrame(() => map.resize()))` on the container |
| A side panel covers the map | `fitBounds(bounds, { padding: { left: panelWidth, top: 40, right: 40, bottom: 40 }, maxZoom: 13.5 })` |
| Users pan away | `maxBounds`, `minZoom`, a "show everything" control |
| Layer order | Insert the raster basemap `before` the first data layer id |

## Verification

- No provider key reaches the browser; tile route validates its path.
- Attribution visible; session refresh shares one promise.
- Subsets use `setFilter`; the map resizes with its container.
- Offline behaviour checked when the page is meant to work offline.

## Versions

- maplibre-gl 6.16.0 (verified 2026-11-05, https://registry.npmjs.org/maplibre-gl/latest)
