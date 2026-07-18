# OMS Portal

The back-office web portal for the OMS (Order Management System) — a React SPA over SIS.Api.
This glossary is the project's ubiquitous language; `/domain-modeling` maintains it. It holds
**what words mean**, nothing about how code is written (that's `.claude/rules/`) or why a decision
was made (that's `docs/adr/`).

## Language

**Delivery document**:
An order's delivery record — the row shown on the Screen 1 inquiry grid and drilled into on
Screen 2. Carries a `DeliveryNo`, store, status, and shipping details.
_Avoid_: shipment, order (an order can have several delivery documents).

**Store**:
A physical branch the signed-in user acts on behalf of. The **acting store** is the one currently
selected in the store switcher; server calls are scoped to it. Identified by `storeCode`.
_Avoid_: branch, site, location.

**Session**:
The server-owned `sis_session` behind an HttpOnly cookie. The client `useSession` store
(`src/core/session.ts`) is a **display mirror** of it, never the source of truth — `Auth/Me` and
401s are. "Signed in" means the server still honours the cookie.
_Avoid_: login state, auth token (there is no client-held token).

**Envelope**:
The universal SIS.Api response shape `{ statusCode, success, message, errors, data }`
(`HttpGeneralResponse<T>`). Every server call returns one; `src/core/api.ts` unwraps `.data` and
turns `success:false` / non-2xx into a typed `ApiError`.
_Avoid_: response wrapper, payload.

**Guardrail refusal**:
A business rule the server enforces by answering with the envelope `success:false` and a machine
code (`LAST_ADMIN`, `SYSTEM_ROLE`, `IN_USE`, `DUPLICATE_NAME`). The UI explains it from that code —
it is a designed outcome, not an error.
_Avoid_: validation error, failure.
