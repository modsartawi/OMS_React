# HITL — ticket 478 (Deliverect orders monitor)

## Q: What shape does `GET Orders/{id}/Raw` answer with?
**Decision taken:** BackOffice 2626 does not pin it. Treated as an ENVELOPED data object `{ rawBody: string, receivedAt }`, named once in `core/models/deliverect.ts` (`DeliverectOrderRaw`) with a contract-gap comment. `rawBody` follows spec 2615's inbox column "raw body".
**Why:** Briefing ruling (enveloped, two fields in one place).
**Revisit if:** 2626 returns `text/plain` unenveloped, or names the field otherwise (`body`, `raw`).

## Q: How is the raw body "pretty-printed" without altering it?
**Decision taken:** Parse only to decide WHETHER it is JSON; the re-indent walks the text and copies every string/number/literal token byte for byte (white space only). `1.10`, 20-digit numbers and `\u` escapes survive (vitest + drive). An "As received" toggle shows the verbatim body; Copy copies the verbatim body.
**Why:** `JSON.stringify(JSON.parse(x))` rewrites values, and a disputed order is checked against exactly those.
**Revisit if:** —

## Q: Does Retry carry a reason?
**Decision taken:** No. The contract's Retry section names no body and no reason (Common: "a mandatory reason … where a section says so"). A plain confirm modal; POST body `{}` (the 481 body-less POST precedent).
**Why:** THE WIRE is the only source of shapes; inventing a `reason` would be a guessed field.
**Revisit if:** 2626 takes `{ reason }` — then the dialog becomes a ReasonDialog.

## Q: Paging — the contract has `skip`/`take` but no default or ceiling.
**Decision taken:** `ORDERS_PAGE_SIZE = 200` (named constant), `skip` in the URL past the first page only, Previous/Next in the status bar; any filter change returns to the first page. Export writes the page shown.
**Why:** A 31-day window can hold thousands of orders; 200 is a conservative page.
**Revisit if:** 2626 caps `take` lower, or the owner wants all-pages export.

## Q: What does a cleared date input do?
**Decision taken:** It stays empty in the URL and is refused on screen ("Enter a valid start and end date."); only a MISSING `from`/`to` key defaults to today. No call is sent while the window is refused.
**Why:** /code-review finding: silently jumping to today changes the list under the user.
**Revisit if:** —

## Q: The platform filter's choices
**Decision taken:** Toggle chips. Platforms readable → its keys (inactive ones too). Refused (403) → the platform keys seen on the rows this page life, remembered across filters, plus any selected in the URL.
**Why:** Contract-gap ruling (the 477 account-filter precedent).
**Revisit if:** Platforms becomes readable on any Deliverect grant.

## Q: Column label for `channelDisplayId` / `channelOrderId`
**Decision taken:** "Display id" and "Platform order id" (never the word "channel" in copy); platform column "Delivery platform".
**Why:** Glossary: never an unqualified "channel"; the namespace's vitest forbids it in copy.
**Revisit if:** The owner prefers the field names as labels.

## Q: Which rows are alert rows?
**Decision taken:** `lastStatusSent === 126` paints the row on the danger ground with a "Needs a person" badge; the drawer leads with a role=alert block and marks the 126 status row. `outcome` is not consulted (the spec does not say which outcome such an order has).
**Why:** Briefing: 126 is the alert row.
**Revisit if:** 2626 adds an outcome for it.

## Q: The stores drive's menu checks
**Decision taken:** 477's drive asserted "ONE leaf — Stores" and "group hidden without canManageStores"; both are now false by design. Relaxed to "Stores is the first leaf" and "the Stores leaf is hidden", with a header note. `menu-deliverect.test.ts` updated likewise (+ an orders-only case).
**Why:** The tests were written expecting 478 to append its leaf.
**Revisit if:** —

## Review notes
- Applied (/code-review): cleared date stays empty; no stale rows/pager/export after a failed read or while a placeholder page shows; fsi on the export toast count; `Object.hasOwn` for outcomes; read-failure fallback text uses its own key.
- Applied (/standards-review): one `OutcomeBadge` for grid + drawer; drive fixture's `lastStatusOk` kept boolean (contract).
- Left: the side-sheet frame copied into OrderDrawer + RawDrawer (briefing: copy the SnapshotDrawer pattern, never import; a core Sheet would be a separate graduation); the `figure` helper copy (app-wide, as in 477); view helpers (`statusText`, `NeedsPerson`) living in `columns.tsx` and `documentPath`/`rawView` in `order-status.ts` (small; split if the file grows).

## Contract gap

- **Raw door data fields unnamed.** Ruled `{ rawBody, receivedAt }` enveloped (above). **Ask:** name them in the Orders monitor section.
- **31 days — inclusive or exclusive?** Ruled inclusive (`from..to` both counted, ≤ 31; `ORDERS_MAX_WINDOW_DAYS`). **Ask:** state it, so 2626's `Orders_RefuseAWindowOver31Days` and the client agree on the 31st/32nd day.
- **Retry body / reason / answer unspecified.** Sends `{}`, reads nothing, re-reads the list. **Ask:** name the body (reason?) and the answer.
- **`take` default and ceiling unspecified.** Client sends `take=200`. **Ask:** state them.
- **Platforms behind `canManageTerms`.** An orders user is likely refused it; the filter falls back to the rows' keys (drive covers 200 and 403). **Ask:** let `Platforms` (and `Accounts`) ride any Deliverect grant.
- **`lastStatusOk` / `lastStatusAt` nullability** for an order with no status sent yet is unstated (the model types them nullable; the UI shows blank). **Ask:** confirm.

## Outstanding (not AFK's)
- Live door on staging (483, BackOffice 2626).
- Owner sign-off on the inclusive 31-day window, the Raw field names, the no-reason Retry, the 200 page size.
- Owner's eye on the Arabic rendering (`lng` stays `en`; the RTL drive proves direction and isolation only).
