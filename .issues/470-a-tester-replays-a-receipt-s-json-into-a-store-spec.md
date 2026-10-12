---
type: spec
status: ready
---

# 470 — A tester replays a receipt's JSON into a store (receipt replay)

Grilled 2026-10-12 (`/grill-with-docs`) from the store page's Transactions tab (467/468, BackOffice spec
2586). Decision record: BackOffice ADR 0076
(`C:\Work\DMSCO\BackOffice\docs\adr\0076-a-replayed-sale-stays-out-of-sap-by-its-counter-and-its-returns-inherit-the-mark.md`).
Glossary: **receipt snapshot**, **receipt replay**.

This is the **web half**. The server half (the replay door, the shared shadow builder, the scrub and the
till's inherited replay mark) belongs to a BackOffice spec that has not been written yet. Until it is,
the web half builds against stubs of the contract in this spec. The contract is a proposal that the
BackOffice spec owns and may amend.

## Problem Statement

A tester who finds a real NewPos sale on the store page's Transactions tab can open its JSON, but cannot
reproduce the sale anywhere. Reproducing a production sale today means ringing it up again by hand on a
till: the same items, prices, discounts and tenders. That is slow, error-prone and often impossible
(an expired promotion, a customer's insurance). Testing a **return** of such a sale is worse, because the
return needs an original sale at the till's own store.

On top of that, **Copy JSON** in the receipt drawer does not work: clicking it appears to do nothing.

## Solution

A **Replay** page in the store sync console, for holders of a new grant. The tester:
1. pastes a receipt snapshot (or arrives with one from the drawer's new **Replay…** button);
2. edits it if they want;
3. picks a target store and register;
4. pushes.

The server writes the sale into that store's own database through the same legacy write a NewPos till
makes. It gives the sale a new receipt number at that store and marks it as a replay of its source
receipt. The page shows the new receipt number, ready to copy, so the tester can find and return the
sale at the till.

A replayed sale never reaches HQ's sales or SAP. It carries no link to a payment provider, loyalty member
or insurer claim, so returning it at the till cannot refund real money or move real points. A return of a
replay is a replay too.

Copy JSON in the drawer works on staging's plain http, and says so inside the drawer.

## User Stories

1. As a tester, I want to paste a receipt snapshot into a Replay page, so that I can reproduce a real sale without ringing it up by hand.
2. As a tester, I want a **Replay…** button in a receipt's View JSON drawer that opens the Replay page with that JSON already in the box, so that I don't have to copy and paste.
3. As a tester, I want the JSON box to be editable, so that I can change a quantity, an item or a tender to build the case I need.
4. As a tester, I want the page to tell me before I push whether the JSON is not valid, so that a missing brace is caught in the browser, not by the server.
5. As a tester, I want a short summary of what I pasted (source store, source receipt, kind, line count, total, tender total), so that I can see what I am about to replay.
6. As a tester, I want the page to warn me when what I pasted is a return, a voided sale or a training sale, and keep Push disabled, so that I only replay completed sales.
7. As a tester, I want the page to warn me when the tenders do not add up to the total and keep Push disabled, so that an edit that broke the balance is caught before the server refuses it.
8. As a tester, I want to choose the target store by its code, so that I can replay into any store, including the source store.
9. As a tester, I want a store that is not a NewPos store refused with words saying so, so that I know why it cannot take a replay.
10. As a tester, I want to choose the target register from that store's registers, so that the replayed sale has a real register I can find it on.
11. As a tester, I want Push to ask me once to confirm the target store and register, so that a slip of the keyboard does not land a sale in the wrong store.
12. As a tester, I want the result to show the new receipt number, the store, the register and the time, so that I can go to the till and find the sale.
13. As a tester, I want a copy button on the new receipt number, so that I can paste it into the till's return search.
14. As a tester, I want the result to say which external links were removed (captured tender proof, loyalty member, insurance claim refs), so that I know why the replay differs from its source.
15. As a tester, I want to replay the same JSON again and get another, separate sale, so that I can run a test more than once.
16. As a tester, I want each server refusal shown in plain words (store unknown, not a NewPos store, store unreachable, register unknown, JSON not a receipt, not a completed sale, training, tenders not balanced), so that I can fix the right thing.
17. As a tester, I want an unexpected failure shown as the console's usual failure words, so that a server crash does not look like a refusal.
18. As a tester, I want the Replay page linked from the console's own nav only when I hold the replay grant, so that I can find it.
19. As a sync operator without the replay grant, I want neither the Replay page link nor the drawer's Replay… button, so that I am never offered a power I don't have.
20. As a holder of the replay grant without Operate, I want the Replay page to still work by pasting, even though I cannot open View JSON, so that the two grants stay independent.
21. As an owner, I want a deep link to the Replay page refused in-page for a user without the grant, so that hiding the link is never the only guard.
22. As an owner, I want every replay recorded in the console's audit feeds as "Replayed a receipt" with the target store, so that every sale created this way can be traced to a person.
23. As an owner, I want the Replay page to list the recent replays (who, when, source receipt, target store and register, new receipt number), so that I can see what has been replayed without opening the audit feed.
24. As an owner, I want a replayed sale never pulled to HQ or exported to SAP, so that testing can never change the company's sales or stock.
25. As an owner, I want a return of a replayed sale also kept from HQ and SAP, so that a test return can never post a negative sale SAP never saw.
26. As an owner, I want a replayed sale to carry no payment provider id, loyalty member or NPHIES claim, so that returning it can never refund a real customer, move real points or touch an insurer.
27. As a finance reader, I want a replay never to reuse a real sale's receipt number, so that a replay is never confused with a real sale.
28. As a tester, I want the pasted JSON never written to browser storage or logged, so that customer data in a snapshot does not linger on my machine.
29. As a tester, I want the JSON I brought from the drawer to stay in the box if I go back and forth between console pages, but be gone after a reload, so that it behaves like a working draft and is never persisted.
30. As a tester, I want **Copy JSON** in the receipt drawer to actually copy on staging, so that I can take a snapshot anywhere I need it.
31. As a tester, I want the drawer to confirm the copy (or say it could not copy) inside the drawer, so that the message is not hidden behind it.
32. As a user of any screen with a copy button, I want copying to work on plain http too, so that copy works the same everywhere.
33. As an Arabic-locale user, I want receipt numbers, store codes, register ids and totals isolated left-to-right, so that they read correctly in RTL.

## Implementation Decisions

**Where it lives**
- The Replay page is a **page of the sync console feature** (`features/admin/sync-console`) at
  `/admin/sync/replay`. It is linked from the console's nav (`ConsoleNav`) when `canReplay`, and it adds
  no new menu leaf.
- This overrides the grilling's provisional "separate `admin/receipt-replay` feature". Inside the console,
  the drawer can hand its JSON to the page **in memory**. A separate feature could only receive it
  through browser history or storage, and the import rules forbid importing it directly.
- i18n stays in the `sync-console` namespace. The console has no Arabic namespace, so keys are added to
  en only, as for the rest of the console.

**Access**
- `GET ActionSync/Access` gains `canReplay: boolean` = the new grant `ActionSync.Replay`.
- `canReplay` is independent of `canOperate`. The nav link, the drawer's Replay… button and the page all
  read it.
- The drawer itself still needs `canOperate`, because View JSON does. So Replay… shows only with both.
- The page renders an in-page denied backstop when `canReplay` is false, as every console page does for
  its own access.

**Handing the JSON over from the drawer**
- A feature-local, in-memory zustand store holds one replay **draft**: the JSON text and its source
  (store code, receipt number).
- Replay… writes the pretty-printed snapshot into the draft and navigates to the page.
- The draft is never persisted (no `persist` middleware, no session or local storage, no history
  state). A reload empties it. Push success does **not** clear it, so the tester can replay again.

**The page**
- **JSON box:** a monospace, `dir="ltr"` textarea.
- **Preflight:** a pure `replayPreflight(text)` runs as the tester types (debounced). It returns either
  `invalid` (with the parser's position), or a summary:
  - source store, source receipt, source `transactionId`;
  - kind (sale / return / void);
  - status, training flag;
  - line count, total, tender total;
  - `balanced`.

  Push is enabled only for a completed, non-training sale that balances. The server checks the same
  things again (the client check is a convenience, never the guard).
- **Target:** a store-code field. Once a code is entered, a register picker is filled from the
  registers door. A WPF store's or an unknown store's refusal shows inline.
- **Push:** a confirm dialog that repeats the target store and register, then posts the push.
- **Result panel:**
  - the new receipt number, with a copy button;
  - the new `transactionId`, store, register and replayed-at time;
  - the "replay of" source receipt;
  - the list of removed links.
- **Recent replays:** a `TabGrid`-style list from the replays door, paged at 50. It refreshes after a
  push.

**Contract (proposed; owned by the BackOffice spec)**
- `GET ActionSync/Replay/Registers?code=` → `{ storeCode, registers: [{ registerId, name }] }`.
  - Refusals: `NO_STORE`, `NOT_NEWPOS_STORE`, `STORE_UNREACHABLE`.
- `POST ActionSync/Replay` with body `{ targetStoreCode, registerId, snapshot }`. `snapshot` is the
  parsed JSON object, not a string.
  - Success → `{ storeCode, registerId, transactionId, receiptNumber, replayedAt, replayOf: { storeCode, receiptNumber, transactionId }, removed: ('tenderCapture' | 'loyaltyMember' | 'insuranceClaim')[] }`.
  - Refusals (`success: false`): `NO_STORE`, `NOT_NEWPOS_STORE`, `STORE_UNREACHABLE`, `NO_REGISTER`,
    `BAD_SNAPSHOT` (does not bind as a receipt snapshot), `NOT_A_SALE` (a return or a void),
    `NOT_COMPLETED`, `TRAINING`, `UNBALANCED`.
  - A codeless 500 is the console's usual failure.
- `GET ActionSync/Replays?page=&pageSize=` → the console's usual `Paged<T>`: `{ items: [{ at, who, sourceStoreCode, sourceReceiptNumber, storeCode, registerId, receiptNumber, transactionId }], total, page, pageSize }`. The client sends `pageSize=50`. (Amended 2026-10-12 after ticket 475: the spec first wrote `{ rows, total }`, which no other console door answers.)
- Grant: `ActionSync.Replay` on all three doors. Not store-scoped: any store is a valid target (ruling).
- Audit: every push writes one `ActionSyncControlAudit` row with action **`ReceiptReplay`**. The console's
  `AuditAction` model and `AUDIT_ACTIONS` gain it, labelled "Replayed a receipt", in both audit feeds.

**What the server does (recorded for the BackOffice spec; not built here)**
- It mints a fresh `TransactionId` and a `ReceiptNumber` (the legacy mint) for the target store and
  register, and stamps the target `StoreId` / `StoreCode`. The receipt is dated now, with today's
  business date and no shift binding.
- It strips provider capture proof and ids from tenders (type and amount are kept), the loyalty member,
  and NPHIES claim references.
- It writes the engine `Pos*` rows into the target store's database through the recall restore path.
  That writes no outbox row. The `Pos` header carries the replay mark (the source receipt).
- It writes the legacy shadow `RetailTrx` with the **one** shadow builder, extracted from the till so the
  till and the door share it, with `Counter = 1`.
- A till refunding an original that carries the replay mark makes the refund a replay: `Counter = 1` and
  no outbox row. This ships with a till release.

**Copy JSON (separate slice)**
- Copy moves into a core helper, `copyText(text)`:
  - it uses `navigator.clipboard.writeText` when the API exists and the page is a secure context;
  - otherwise it falls back to a hidden textarea plus `document.execCommand('copy')`;
  - it resolves to `copied` or `failed`.
- The fallback textarea is placed **inside the open dialog** when called from one. A textarea outside a
  modal `<dialog>` cannot be selected.
- The snapshot drawer shows the result **inside the drawer** (a transient status line next to the
  button), not as a toast: a toast renders beneath a `showModal()` dialog.
- The other two copy call sites (the central invoice retry list, the retail invoice attempt id) adopt the
  helper as well. Their toasts are fine where they are.

**Bidi**
- Receipt numbers, store codes, register ids, `transactionId`s, totals and times are machine values,
  wrapped in `Ltr`. In the replays list, the base column definition isolates them.
- "replay of {{receipt}}" interpolations take `fsi()`. The JSON box is `dir="ltr"`.

**i18n**
- New `sync-console` keys:
  - `nav.replay`;
  - `replay.*` (page title, paste hint, preflight words, target labels, confirm, result, removed-link
    words, refusals, recent list headers);
  - `transactionsTab.snapshot.replay`;
  - `transactionsTab.snapshot.copied` / `copyFailed`, now shown in-drawer;
  - the audit label for `ReceiptReplay`.

## Testing Decisions

- **What makes a good test here:** it asserts what a tester sees or what the server is asked for. Words
  shown, controls enabled, requests sent and their bodies. Never component internals or store shape.
- **vitest (pure, node), beside the console's existing helper tests:**
  - `replayPreflight`: invalid JSON (with its position); a sale; a return; a void; training; not
    completed; balanced and unbalanced (to the cent); a non-object.
  - The refusal map: every code gets words, and an unknown code falls back to the console's failure.
  - The push request builder: it sends the parsed object, the trimmed store code and the register.
  - The `ReceiptReplay` audit label, beside the existing audit-label tests.
  - `copyText`'s choice of path with an injected clipboard / secure-context / `execCommand`: the API
    path, the fallback path, both failing.
- **Playwright (flow), new sections in the sync-console store drive and a replay section, `page.route`
  stubs of the three doors and the access door:**
  - Replay… in the drawer prefills the page.
  - The grant hides the link, the button and the page.
  - Preflight warnings disable Push.
  - The register picker fills and a WPF store is refused.
  - Confirm → push → the result panel and its copy.
  - Every refusal shows its words.
  - The recent list refreshes.
  - Reloading empties the draft.
  - Copy JSON in the drawer copies on a plain-http origin and shows its status inside the drawer.
- **Prior art:** `transactions-helpers.test.ts` (468's `snapshotSections` / `prettyJson` /
  `snapshotRefusal`), `control-helpers.test.ts` (audit labels), `tools/sync-console-store-drive.mjs`
  sections 16–19, and `tools/sync-console-live-drive.mjs` for the later live walk.
- **No RTL** (spec 083's ruling stands). typecheck, lint, vitest and build gate every slice.
- **A live walk ticket** comes last, once the BackOffice half is on staging. It replays a real staging
  receipt into a test store and confirms these:
  - The sale is found at that store's till.
  - It is returned there.
  - Neither the sale nor the return appears in HQ `RetailTrx`.
  - The audit row exists.

## Out of Scope

- The whole server half: the doors, the shared shadow builder, the scrub, the till's inherited replay
  mark and the grant seeding. That is a BackOffice spec still to be written; this spec only proposes its
  contract.
- Replaying a return, a voided sale or a training sale.
- Replaying into a WPF (legacy-till) store.
- Replaying by reference (a source store + `transactionId`, with the server reloading from the mirror).
  The page takes JSON only.
- Re-pricing an edited snapshot. It is written exactly as pasted.
- Deleting or undoing a replay.
- Exercising real provider refunds, loyalty or NPHIES flows through a replay.
- Bulk replay (many receipts at once).
- An Arabic namespace for the console.

## Further Notes

- The drawer's Replay… shows only to holders of both Operate (to see the JSON) and Replay (to push it).
  A Replay-only tester pastes JSON from elsewhere.
- A replay into the **source** store is allowed and safe: the fresh identity means it can never collide
  with the real sale.
- A replay is visible only in the target store's own database and in the console's replays list and
  audit, never at HQ. That is intended (ADR 0076).
- The Copy JSON fix needs no server change. It can be built first, separately from everything else.
