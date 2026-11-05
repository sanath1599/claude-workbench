# Travel times

Distance in a straight line is a screening filter only. Rules phrased in minutes need a road-network matrix.

## Choosing a source

| Option | Use when | Cost and limits |
|---|---|---|
| OSRM (self-hosted, open source) | Thousands of points, many reruns, one region extract | Free; you host it and an OpenStreetMap extract. The `table` service returns a full matrix; large tables need a bigger `--max-table-size`. |
| Valhalla (self-hosted, open source) | Need time-of-day-agnostic costing profiles (truck, bicycle) or isochrones | Free; you host it. The `sources_to_targets` endpoint returns the matrix. |
| Google Routes API (compute route matrix) or Distance Matrix | You need live or typical traffic and no hosting | Billed per element (origins x destinations); element and request limits apply. Read the current pricing and limits pages before sizing. |
| Fallback road-speed model | Router unavailable, or screening before the real calls | Free; wrong by design, label results "estimated". |

Never use a public demo router for bulk work; its terms forbid it.

## Procedure

1. Count elements first: origins x destinations. A full 500 x 500 matrix is 250,000 elements. Filter pairs by straight-line distance (a generous multiple of the limit) so you only request pairs that can matter.
2. For a paid API, spend a small sample first, check results against a few known drives, and show the owner the projected bill before the full run.
3. Build the matrix in batches within the documented request limits. Retry with exponential backoff and jitter on 429 and 5xx. Never retry in a tight loop.
4. Cache every answer keyed by `(origin_lat, origin_lng, dest_lat, dest_lng, mode, departure_bucket)` with coordinates rounded to 5 decimals. Persist to SQLite or a CSV so a rerun costs nothing.
5. Store minutes as integers (round up) plus the source name and fetch date in the file header.
6. Check the matrix: zero diagonal, no missing cells, no asymmetric pair off by more than a stated tolerance without a reason (one-way streets are a valid reason), and a spot check of five drives against a map.

## Departure time

Choose one stated departure rule and use it everywhere: free-flow (no traffic), or a typical weekday morning departure such as 08:00 local on a future Tuesday. Real-time traffic makes the plan irreproducible. Record the choice in the output header and in the summary for stakeholders.

## Fallback road-speed model

When no router is available, estimate `minutes = detour * haversine_km / speed_kmh * 60 + fixed_minutes`, with `detour` about 1.3 and a speed per area type (urban, rural, highway) fitted on 20 or more known drives. Report the fitted error (median and 90th percentile). Mark every figure produced from it as an estimate, and replace it with router data before any plan is committed.

```python
def est_minutes(a, b, speed_kmh=45, detour=1.3, fixed=3):
    km = haversine_km(a, b) * detour
    return math.ceil(km / speed_kmh * 60 + fixed)
```

## Gotchas

- Snapping: a point that snaps to the wrong road (a motorway, a ferry) gives absurd minutes. Flag any pair whose time is under 1 minute or over 5 hours and inspect.
- Islands and ferries: unreachable cells come back null or huge. Treat null as "no route", never as 0.
- Coordinate order: routers differ (lon,lat versus lat,lon). Test with one known pair.
- Units: seconds versus minutes, metres versus kilometres. Convert once, at the boundary.
- Display the map base for the result with `stack-web:building-map-apps`; do not rebuild map conventions here.
