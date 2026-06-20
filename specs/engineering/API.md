# FreshFlow Web — API Integration

**Layer:** Engineering. Defines **how** the web client consumes the FreshFlow backend. It does
**not** define endpoints — the backend **OpenAPI spec is the source of truth** for paths and
schemas. Do not invent endpoints or payloads; generate types from the spec.

## Principles

- **OpenAPI-driven.** All HTTP types are **generated** from the backend OpenAPI document; the
  client never hand-writes DTOs that the server already describes.
- **Typed end to end.** No `any` at the API boundary. Map generated types into feature models
  only when the UI needs a different shape.
- **Generated clients.** Use a generator (e.g. `openapi-typescript` for types, or
  `ng-openapi-gen` for typed Angular services) wired as an npm script; regenerate on contract
  change. Keep generated code out of hand edits.

## Toolchain (to add)

```
# proposed npm scripts (not yet in package.json)
"api:types": "openapi-typescript <openapi-url-or-file> -o src/app/core/api/types.ts"
```

The OpenAPI source URL/file is provided by the backend (Swagger at `/swagger` in non-prod).
Pin the spec version per release; regeneration is a reviewed change.

## HTTP layer

- Single `HttpClient` usage behind feature services; **no component calls `HttpClient`
  directly**.
- **Base path** `/api/v1` configured via Angular environment, not hardcoded in services.
- **Response envelope**: the backend wraps responses in a standard envelope; model it once as a
  generic `ApiResponse<T>` and unwrap in a typed helper. Treat the envelope as
  server-defined — confirm its shape from the spec, don't assume.
- **Errors**: a central error mapping turns server error codes into typed, **bilingual**
  user messages (vi/en); never surface raw server text.

## Interceptors (in `core/`)

- **Auth** — attach the access token; on `401`/expiry, refresh via the rotation flow and retry
  once; on refresh failure, route to sign-in (BR-AUTH-5). Mirrors the existing
  `core/auth/auth.interceptor.ts`.
- **Loading** — drive `fuse-loading-bar` for in-flight requests (existing loading interceptor).
- **Correlation** — propagate a correlation id header for traceability.

## Real-time (SignalR)

Real-time price, order, hub, and delivery updates use **SignalR** (backend hubs). The web
client needs the `@microsoft/signalr` client (**to add — not yet in `package.json`**). Rules:

- One connection manager in `core/`; features **subscribe to typed events**, not raw messages.
- Join the relevant **groups** (e.g., market group for the price board, the restaurant's
  personal group for order/delivery) after auth; **re-join on reconnect**.
- **Do not replay** missed events — on reconnect, re-fetch current state via REST
  (BR-PRI-3, BR-ORD-6).
- Push updates into feature **signal stores** ([`STATE.md`](./STATE.md)); the UI reacts via
  `computed`.

## Boundaries

- Endpoints, request/response schemas, status codes, RBAC per endpoint → **backend OpenAPI**.
- This repo owns: generated types, interceptors, the envelope/error mapping, the SignalR
  manager, and feature services that orchestrate them.
- If the spec is missing something the UI needs, **raise it with the backend** — do not invent it.
