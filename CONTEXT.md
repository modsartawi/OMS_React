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

**Bonus buy (BBY)**:
A promotion evaluated by the pricing engine, identified by a `bbyNumber` (with a `promoNumber` /
`offerId`). One shape: a **prerequisite** ("buy X") linked to a **reward** ("get Y"). It is
*applied* when it fired on a basket, or *potential* when it could apply but did not (the "why not"
is its unmet prerequisites). Seen on the POS Simulation screen.
_Avoid_: offer, deal, discount (a bonus buy *carries* a discount; it is not one).

**Prerequisite / Reward** (of a bonus buy):
The **buy** side and the **get** side. Either can be a single material or a **material grouping**
(a category), and the reward product may differ from the prerequisite product. On the engine's
condition rows the roles are `isPrerequisite` / `isCondition`, joined across lines of one fired
application by a shared `conditionKey`.
_Avoid_: trigger/benefit (acceptable in prose, but the domain terms are prerequisite/reward).

**Discount type** (of a bonus-buy reward):
Which of four kinds the reward grants: **Free Goods** (`N`, buy-x-get-y-free), **Discount Percent**
(`%`), **Fixed Discount** (`R`, amount off), **Set Price** (`P`, fixed/bundle price). The SAP
condition-type codes (`ZB01/02/03/12/13`, `VKA0`) are the engine's expression of the same four.
_Avoid_: promo type (the *promotion* is the bonus buy; the discount type is the reward's kind).
