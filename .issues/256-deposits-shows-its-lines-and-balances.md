---
status: open
spec: 249
blocked-by: 254
---

# 256 — Deposits shows its lines and balances in place

## What to build

The one screen in the suite that **isn't a flat list**, which is why it is its own ticket rather than
folded into [255](255-acrs-and-attempts-list-on-the-same-template.md).

`/collection/deposits` keeps the template's skeleton — criteria draft, today-defaulted landing, client
paging at 50, cap banner, More-columns toggle, floating filter row — and adds two regions beneath the
grid.

**Filters:** From · To · Deposit No# · Collector · **Bank** · **Status** (segmented All / POSTED /
VOID, from the WPF's radio group).

**The response is not a bare list.** `DepositInquiryResultModel` is `{ rows, balances }` — the grid
rows each carrying their own `lines` and `attachments`, plus a per-collector outstanding-balance
summary alongside. ⚠ **Everything arrives in the one response, so no region costs a fetch.** Do not
add a second call for the detail.

**Rendered stacked, as the WPF has it:**

1. The deposit grid.
2. Below it, a **detail region following the selected row** — its claimed-ACR lines with **drift
   flagged**, and its slips as links.
3. Below that, the **per-collector balance** table in a collapsible panel labelled *POSTED only*.

⚠ **A detail modal was considered and rejected.** A deposit whose banked total no longer matches its
claimed ACRs is precisely what the accountant opens this screen to find — drift should be visible **in
place**, not behind a click that has to be taken on faith.

**Slips are ordinary links opening in a new tab** — that is all `Open Slip(s)` ever did. The mobile
backend hosts the files; the API never takes bytes. No document renderer is involved: ⚠ **Deposit
Inquiry has no printable document** — the WPF `DepositInquiry` folder has no form/printer pair.

Money throughout via `@/core/money.ts`, on the same terms as 254.

## Spine reach

api (mocked) · logic (criteria, selection, drift) · component · route · i18n · test

## Proof (→ `tdd` red-green cycles)

- [ ] `deposit-criteria.test.ts` — Bank and Deposit No# dropped when empty; the segmented Status maps
      to `""` / `POSTED` / `VOID` with **All sending nothing**; the date pair holds · pure
- [ ] `deposit-drift.test.ts` — a claimed-ACR line whose figure no longer matches the banked total is
      **flagged**, and one that matches is not. This is the screen's whole reason to exist, so it is
      asserted on the data rather than left to the eye · pure
- [ ] `tools/collection-drive.mjs` extended — selecting a row moves the detail region to it **with no
      second network call** (assert the request count); the balances panel collapses and reopens and
      is labelled *POSTED only*; a slip link carries `target=_blank`; a drifted line renders its flag ·
      flow (Playwright)

## Boundaries

- **New API dependency:** `CollectionWeb/Deposits`, returning `{ rows, balances }` — **mocked here.**
  ⚠ Backend-side this is the **hardest door of the four**: it rides `CollectorEndpointFilter`, which
  demands an api-key *plus* a `Mobile`-channel Bearer session and explicitly rejects a browser-minted
  token, so it has **no cookie branch to mark** and needs a genuinely new door. Owned by
  [1090](file:///C:/Work/DMSCO/BackOffice/.issues/1090-a-browser-reaches-the-four-collection-inquiries.md).
- i18n keys into the existing `collection` namespace.
- No row action opening a document — there is no deposit document.

## Done when

`/collection/deposits` opens on today; selecting a deposit shows its claimed-ACR lines and slips in
place with drift flagged and **no extra fetch**; the per-collector balances collapse under a *POSTED
only* label; the pure tests and the drive are green.

## Blocked by

[254](254-cash-collections-opens-on-today.md) — the template skeleton this screen extends.
