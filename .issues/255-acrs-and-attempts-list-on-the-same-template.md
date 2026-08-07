---
status: open
spec: 249
blocked-by: 254
---

# 255 — ACRs and Collection Attempts list on the same template

## What to build

The two other **flat** grids, built as variations on the template
[254](254-cash-collections-opens-on-today.md) settled — same criteria draft, same today-defaulted
landing, same client paging at 50, same cap banner, same More-columns toggle, same floating filter row
on by default. If either screen needs a structural departure from that template, that is a finding
worth recording rather than absorbing.

**ACRs** (`/collection/acrs`)

- Filters: From · To · **ACR No#** · Collector · **Status**.
- The WPF's `""` / `OPEN` / `CLOSED` radio group becomes a **segmented control** (All / OPEN /
  CLOSED).
- 15 WPF columns, split identity-and-money first with the forensic tail behind the toggle.
- Two row actions land in [257](257-a-row-opens-its-document.md), not here.

**Collection Attempts** (`/collection/attempts`)

- Filters: From · To · Store · Collector · **Reason code**.
- The smallest screen in the suite — one flat list, 9 WPF columns, no document, no drill-down.
- ⚠ **No row action at all, and this is deliberate rather than unfinished.** The WPF withholds one on
  purpose: a collection attempt is **immutable evidence**, not a voucher. Do not add one for symmetry.

Both screens use `@/core/money.ts` for their money columns on the same terms as 254 — row's own
currency decimals, blank rather than `0.00`, currency code in the header.

## Spine reach

api (mocked) · logic (criteria, columns) · component · route · i18n · test

## Proof (→ `tdd` red-green cycles)

- [ ] `acr-criteria.test.ts` — the segmented Status maps to the server's `""` / `OPEN` / `CLOSED`,
      with **All sending nothing rather than the literal `"All"`**; ACR No# is dropped when empty;
      dates still travel as a pair · pure
- [ ] `attempts-criteria.test.ts` — reason code dropped when empty; the today-defaulted pair holds ·
      pure
- [ ] `columns.test.ts` extended — both screens' forensic tails hide nothing, same union assertion as
      254 · pure
- [ ] `tools/collection-drive.mjs` extended — both screens open populated on today, page at 50, toggle
      their tails, and filter per column; the Status segmented control re-queries; ⚠ **Collection
      Attempts exposes no row action** · flow (Playwright)

## Boundaries

- **New API dependencies:** `CollectionWeb/Acrs`, `CollectionWeb/Attempts` — **mocked here**;
  [259](259-the-screens-call-the-real-door.md) joins them to the real door. Through `@/core/api`.
- i18n keys into the existing `collection` namespace.
- No export yet — [258](258-the-export-writes-a-summable-file.md) covers all four screens at once.

## Done when

Both screens open on today, page, filter and toggle exactly as Cash Collections does; the segmented
Status control drives a real re-query; Collection Attempts offers no row action; the pure tests and
the drive are green.

## Blocked by

[254](254-cash-collections-opens-on-today.md) — the template. Building these before it would mean
settling the criteria/paging/column shape twice.
