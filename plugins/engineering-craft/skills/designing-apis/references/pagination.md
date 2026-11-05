# Cursor pagination

## Contract

Request: `GET /v1/candidates?limit=50&cursor=eyJ...`
Response:

```json
{
  "items": [ ... ],
  "next_cursor": "eyJjcmVhdGVkX2F0Ijoi...",
  "has_more": true
}
```

- `limit` default 50, hard maximum 200; values above the maximum are clamped or rejected with 422, pick one and document it.
- `next_cursor` is null on the last page. Treat the cursor as opaque; clients never build or parse it.
- Sort order is fixed per endpoint and must be total: add the primary key as a tiebreaker.

## Keyset implementation (Postgres)

Sort by `(created_at desc, id desc)`. The cursor encodes the last row's pair.

```python
import base64, json

def encode(created_at: str, id_: str) -> str:
    return base64.urlsafe_b64encode(json.dumps([created_at, id_]).encode()).decode()

def decode(cursor: str) -> tuple[str, str]:
    created_at, id_ = json.loads(base64.urlsafe_b64decode(cursor.encode()))
    return created_at, id_

QUERY = """
select * from candidates
where ($1::timestamptz is null or (created_at, id) < ($1, $2))
order by created_at desc, id desc
limit $3 + 1
"""
```

Fetch `limit + 1` rows; if you got more than `limit`, drop the extra one and set `has_more` and `next_cursor` from the last kept row. Back the sort with a composite index on `(created_at desc, id desc)`.

## Pitfalls

- Offset pagination skips or repeats rows when inserts happen between pages and gets slower with depth.
- Sorting by a non-unique column without a tiebreaker loses rows at page boundaries.
- If the cursor must be tamper-proof (it carries filter state), sign it; otherwise validate everything you decode, because it is user input.
- Total counts are expensive; offer `count` only on request, or an estimate.
- Filters must be part of the request on every page, not hidden in the cursor, unless the cursor is signed.
