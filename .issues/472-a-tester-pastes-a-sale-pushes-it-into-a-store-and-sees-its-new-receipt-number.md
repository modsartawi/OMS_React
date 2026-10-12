---
status: open
spec: 470
blocked-by: —
---

# 472 — A tester pastes a sale, pushes it into a store and sees its new receipt number

Slice 0 of spec 470 (**receipt replay**). It proves the proposed contract end to end against stubs. The
doors belong to a BackOffice spec not yet written, so build against spec 470's contract section.

## What to build

- **Access:**
  - `GET ActionSync/Access` gains `canReplay` (grant `ActionSync.Replay`), on the console's
    `SyncConsoleAccess` model.
  - The console nav (`ConsoleNav`) gains **Replay** at `/admin/sync/replay`, shown only with `canReplay`.
  - The page renders the console's in-page denied backstop without it.
  - No new menu leaf.
- **The page (inside `features/admin/sync-console`):**
  - **JSON box:** monospace, `dir="ltr"`.
  - **Preflight:** a pure `replayPreflight(text)` runs debounced as the tester types. It returns
    `{ kind: 'invalid', at }` or a summary:
    - `sourceStoreCode`, `sourceReceiptNumber`, `sourceTransactionId`;
    - `docKind` (sale / return / void), `completed`, `training`;
    - `lineCount`, `total`, `tenderTotal`, `balanced`.

    The summary shows above the target. In this slice, Push needs only a valid completed sale. Full
    warnings are 473's.
  - **Target:**
    - A store-code field. On Enter or blur it reads `GET ActionSync/Replay/Registers?code=` and fills a
      register picker.
    - Any refusal shows as the console's usual failure in this slice. Specific words are 473's.
  - **Push:**
    - A confirm dialog repeats the store and register, then `POST ActionSync/Replay` sends
      `{ targetStoreCode, registerId, snapshot }`. `snapshot` is the parsed object.
    - A pure `replayRequest(text, store, register)` builds the body.
  - **Result panel:**
    - the new receipt number with a copy button (via `copyText` if 471 has landed, otherwise
      `navigator.clipboard?.`, which 471 migrates);
    - the new `transactionId`, store, register and replayed-at time;
    - "replay of" the source receipt;
    - the removed links (`tenderCapture` / `loyaltyMember` / `insuranceClaim`) in words.
- **Models** in `@/core/models/sync-console`: `ReplayRegisters`, `ReplayRequest`, `ReplayResult`,
  `ReplayRemoved`.
- **Bidi:** receipt numbers, codes, ids, totals and times are wrapped in `Ltr`, and the "replay of"
  sentence uses `fsi()`.

## Spine reach

model/api (Access flag + 2 doors) · logic (`replayPreflight`, `replayRequest`) · component/route (page, nav link, route) · i18n (`nav.replay`, `replay.*`) · test

## Proof (→ `tdd` red-green cycles)

- [ ] `replayPreflight`: invalid JSON gives its position. A completed sale gives its summary. A non-object is invalid. Totals and the balance are judged to the cent · pure (vitest)
- [ ] `replayRequest`: sends the parsed object, the trimmed, upper-cased store code and the register · pure (vitest)
- [ ] Replay drive section (new, `page.route` stubs of Access, Registers and Replay):
  - Without `canReplay`, there's no nav link and a deep link shows the backstop.
  - With it: paste a sale → the summary → enter a store → pick a register → confirm → the request body is
    right → the result shows the new receipt number and the removed links, and its copy works.
  - · flow (Playwright)
- [ ] The existing console drives' nav assertions are updated for the new link, and nothing else changes.
- [ ] Gates green: typecheck, lint, vitest, build.

## Boundaries

oms-react only. Two new doors, both stubbed: `ActionSync/Replay/Registers` and `POST ActionSync/Replay`.
The JSON is never logged or persisted.

## Done when

A pasted sale can be pushed to a stubbed store and register, and the result shows its new receipt
number. The helpers and the replay drive section are green.

## Blocked by

None — can start immediately (live: the BackOffice receipt replay spec, unwritten).
