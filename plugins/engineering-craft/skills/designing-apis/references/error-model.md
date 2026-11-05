# Error model (RFC 9457 problem details)

Media type `application/problem+json`. Standard members: `type` (URI identifying the problem class), `title` (short, stable), `status`, `detail` (specific to this occurrence), `instance` (URI of this occurrence). Add extension members for machines: `code` (stable string), `errors` (field list), `request_id`, `retry_after_seconds`.

## Example: validation failure

```http
HTTP/1.1 422 Unprocessable Content
Content-Type: application/problem+json

{
  "type": "https://api.example.com/problems/validation-error",
  "title": "Request validation failed",
  "status": 422,
  "detail": "2 fields are invalid.",
  "instance": "/v1/candidates",
  "code": "validation_error",
  "request_id": "req_01HZX3",
  "errors": [
    {"pointer": "/email", "code": "invalid_format", "detail": "Not a valid email address."},
    {"pointer": "/resume", "code": "too_large", "detail": "Maximum size is 5 MB."}
  ]
}
```

## FastAPI handler

```python
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from starlette.exceptions import HTTPException

PROBLEM = "application/problem+json"

class FieldError(BaseModel):
    pointer: str
    code: str
    detail: str

class Problem(BaseModel):
    type: str = "about:blank"
    title: str
    status: int
    detail: str | None = None
    instance: str | None = None
    code: str
    request_id: str | None = None
    errors: list[FieldError] | None = None

def problem(request: Request, status: int, title: str, code: str, detail: str | None = None, errors=None):
    body = Problem(title=title, status=status, detail=detail, code=code,
                   instance=request.url.path, request_id=request.state.request_id, errors=errors)
    return JSONResponse(body.model_dump(exclude_none=True), status_code=status, media_type=PROBLEM)

def install(app: FastAPI) -> None:
    @app.exception_handler(RequestValidationError)
    async def _validation(request: Request, exc: RequestValidationError):
        errors = [FieldError(pointer="/" + "/".join(str(p) for p in e["loc"][1:]),
                             code=e["type"], detail=e["msg"]) for e in exc.errors()]
        return problem(request, 422, "Request validation failed", "validation_error", errors=errors)

    @app.exception_handler(HTTPException)
    async def _http(request: Request, exc: HTTPException):
        return problem(request, exc.status_code, str(exc.detail), f"http_{exc.status_code}")

    @app.exception_handler(Exception)
    async def _unhandled(request: Request, exc: Exception):
        # log the exception with request_id server-side; never return it
        return problem(request, 500, "Internal error", "internal_error")
```

Declare the schema in routes with `responses={422: {"model": Problem, "content": {PROBLEM: {}}}}` so it appears in OpenAPI and the generated client.

## Rules

- `code` is a contract: never rename it, add new ones. `title` is stable per code. `detail` may change.
- Never put stack traces, SQL, internal hostnames or the existence of other tenants' data in any member.
- 401 vs 403 vs 404: if revealing existence is itself a leak, return 404 for resources the caller may not see.
- Clients branch on `status` and `code`, never on `detail` text.
