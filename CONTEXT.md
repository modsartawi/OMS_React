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
`offerId`). One shape: a **buy side** ("buy X") linked to a **get side** ("get Y"). It is
*applied* when it fired on a basket, or *potential* when it could apply but did not (the "why not"
is its unmet prerequisites). Seen on the **POS Simulation** screen (in a basket context) and the
**BBY Inquiry** screen (standalone, read-only). Two persistence shapes back it: the flat
**`BbyHeader`** (28 scalar fields — number, status, validity window, links, targets; what the
inquiry grid lists) and the richer **`BbyModel`** (header + `BbyPrereq` / `BbyCond` rows; what the
SAP "Display Bonus Buy" detail renders).
_Avoid_: offer, deal, discount (a bonus buy *carries* a discount; it is not one).

**Buy side / Get side** (of a bonus buy):
The two halves of a BBY. The **buy side** is the **prerequisite** (data: `BbyPrereq`,
`isPrerequisite`) — what must be bought; the **get side** is the **condition** (data: `BbyCond`,
`isCondition`) that grants the **reward** — what is given. "Buy" / "Get" are the human-facing terms
(prose and UI labels), prerequisite/condition are the data-layer/DTO terms, and "reward" names what
the get side grants. Either side can be a single **material** (`MAT`) or a **material grouping**
(`MGP`, a category), and the get product may differ from the buy product. Engine rows join the
buy↔get lines of one fired application by a shared `conditionKey`.
_Avoid_: trigger/benefit (fine in prose, but the domain terms are buy/prerequisite and
get/condition/reward).

**Discount type** (of a bonus-buy reward):
Which of four kinds the reward grants: **Free Goods** (`N`, buy-x-get-y-free), **Discount Percent**
(`%`), **Fixed Discount** (`R`, amount off), **Set Price** (`P`, fixed/bundle price). The SAP
condition-type codes (`ZB01/02/03/12/13`, `VKA0`) are the engine's expression of the same four.
_Avoid_: promo type (the *promotion* is the bonus buy; the discount type is the reward's kind).

**BBY status**:
The `BbyStatus` code on a `BbyHeader`: **A** = Activated, **I** = Inactive, **D** = Draft,
**X** = Deleted (`BonusBuyDetailController.MapStatus`). It is a **display label only** — no engine
logic filters on it; the pricing engine gates live promos on a separate `SyncApprovalStatus` (plus
dates, times, loyalty). The BBY Inquiry screen shows it as a badge and uses `A` as one half of its
**active** definition.
_Avoid_: state, approval status (`SyncApprovalStatus` is a different, engine-only column).

**Validity window** (of a BBY):
The header's own live-dates: `ValidFrom` / `ValidTo` as `yyyyMMdd` **strings**, and optional
intra-day `ValidFromTime` / `ValidToTime` as `HHMMSS` strings. "Overlaps *now*" is an **ordinal
string** compare (`ValidFrom ≤ today ≤ ValidTo`), no date parsing needed. Date-range **search** on
the inquiry means *validity-window overlap* ("active during this period"), never `CreatedAt`.
_Avoid_: effective dates, created date (`CreatedAt` is when the row was minted, not when it is live).

**Active / current** (of a BBY, on the inquiry):
An inquiry-screen concept the WPF never had: a BBY is **active** iff `BbyStatus == "A"` **and** its
validity window overlaps today (`ValidFrom ≤ today ≤ ValidTo`) — computable from `BbyHeader` alone.
The default grid shows only active BBYs; number- and date-range search surface any status (including
`X` = Deleted) and any window (past/future), with status shown as a badge.
_Avoid_: live/enabled — and don't conflate with the engine's heavier "will it fire now" (cond-level
dates + `SyncApprovalStatus` + time window + loyalty), which the inquiry deliberately does not
reproduce.

**Link category** (of a BBY):
How multiple buy lines (`LinkCategoryBuy`) or get lines (`LinkCategoryGet`) combine: **A** = AND
(every group must be satisfied), **O** = OR (any one suffices). `BbyLinkCategoryConstants`.
_Avoid_: match mode.

**Condition target type** (of a BBY):
`CondTargetType` — what the get-side discount is aimed at: **M** = Material, **G** = Material
Grouping, **P** = All Prerequisites, **R** = **Document**, the header-level **total-discount mode**
(e.g. Al-Rajhi 5% off the whole basket subtotal). In Document mode the detail view hides the
per-line Get grid and shows a single total-discount figure instead.
_Avoid_: scope (it is the specific `CondTargetType` code, not a general notion of scope).
