---
status: done
spec: BackOffice 4096
blocked-by: BO 4097, BO 4098
---

# 932 — An author picks KSA or Bahrain on a promotion and sees it in the list

## What to build

- **The promotion page** gets a sales-area select with two entries (EN/AR): "KSA retail — 1000 / 20 — SAR"
  and "Bahrain retail — 1000 / 21 — BHD". KSA is preselected on a new promotion. Once the promotion holds a
  bonus buy, the select is disabled (from the document's locked flag, BO 4098) with a one-line explanation.
  The server's refusal is shown like any other refusal.
- **The promotion list** (Bonus Buy Maintenance overview) gets a sales-area column.
- The wire types `BbyPromotion` / `BbyPromotionSave` carry `salesOrganization`, `distributionChannel` and the
  currency and labels. Save sends the pair.

Spec: `C:\Work\DMSCO\BackOffice\.issues\4096-an-oms-promotion-is-written-for-ksa-or-bahrain-spec.md`.

## Spine reach

UI (promotion page, overview, wire models, api)

## Proof (→ `tdd` red-green cycles)

- [x] a new promotion defaults to KSA, and save sends 1000 / 20 · promotion page test / `overview.test.ts`
- [x] picking Bahrain sends 1000 / 21 · component test (pure: `promotionSaveBody`, `overview.test.ts`)
- [x] the select is disabled with its explanation when the document says locked · component test (pure: `promotionSalesArea`, `overview.test.ts`; the explanation shown by the drive)
- [x] the overview row shows the sales area · `overview.test.ts`

## Boundaries

Needs the BO 4097 contract (the pair on the promotion) and BO 4098 (locked flag + refusal).

## Done when

The Proof tests are green, and a stubbed drive shows creating a Bahrain promotion, the list column and the
locked select. A live walk is owed after BO 4097/4098 deploy.

## Blocked by

BackOffice 4097, 4098

## Comments

- 2026-11-20 (`/implement`): **done, stubbed; live walk owed after BO 4097/4098 deploy.** React Testing Library is
  not installed, so the "component tests" are pure-module tests on the select's state, its default, its lock and the
  save body (`newPromotionSalesArea`, `promotionSalesArea`, `promotionSaveBody`, `salesAreaLabel`, `salesAreaOption`
  in `overview.ts`, 9 cases in `overview.test.ts`); the page renders them through `SalesAreaSelect.tsx`.
  `tools/bby-sales-area-drive.mjs` (stubbed, 20/20) shows a Bahrain promotion created (posts 1000 / 21), the list's
  Sales area column, the locked select with its reason, and a server refusal shown as any other.
  - `BbyPromotionSave`'s pair tightened to **required**: both create and header save always send it (a locked or
    off-list promotion sends its own pair back unchanged).
  - With no `salesAreaLocked` on the document (an old server) the select is locked exactly while the promotion
    holds a bonus buy, the same rule BO 4098 enforces.
  - The labels join with the bidi pair dot (`KSA retail · 1000 / 20 · SAR`), not the ticket's em dashes
    (`.claude/rules/bidi.md`: the dot is an allowed separator, an em dash between values is not).
  - EN + AR names: a partial `src/locales/ar/bonus-buy-maintenance.json` (sales-area words only, the rest falls
    back to English), registered in `core/i18n.ts`. The client names the two areas itself; the document's
    `salesAreaEnglish`/`salesAreaArabic` are not read (the select needs both names before any document exists).
  - The refusal code in the drive (`BBY-SALES-AREA-LOCKED`) is invented; the screen shows whatever code BO 4098 uses.
- 2026-11-20 code-review fixes: the lock is derived from the current document each render (only the pick is
  state, re-synced when the saved pair moves); the list cell isolates the name (`<bdi>`) and `pair · currency`
  (`Ltr`) each whole, and the option `fsi`s `pair · currency` once; a saved promotion's header save sends back
  exactly the pair its document holds — none for a no-pair document (`BbyPromotionSave` pair optional again; a
  new promotion always sends it); off-list pairs read `key: null`; the off-list reason wins over Locked;
  `salesAreaEnglish`/`salesAreaArabic` dropped from the model. Drive 21/21 (new no-pair name-only save check).
- 2026-11-20 reconciled to the SHIPPED contract, BackOffice pricing2 e35485209 (4097 9c4d77c7c, 4098 0ac324ed9,
  4100 19f39a29c, review 1648fd2c3). Confirmed: `Promotion/List` rows and `Promotion/{number}` are
  `BbyPromotionDocument` with `salesOrganization`/`distributionChannel`/`currency`/`salesAreaLocked` (always
  sent); closed list KSA 1000/20/SAR, Bahrain 1000/21/BHD; the lock refusal code is `BBY-SALES-AREA-LOCKED`.
  Drift fixed: (1) a change naming an off-list pair is refused `BBY-SALES-AREA`, and a change naming none keeps
  the promotion's own, so `promotionSaveBody` now sends NO pair on any save that does not move the area (locked,
  unchanged, off-list) — the 11-20 "send back what the document holds" would have failed an off-list
  promotion's header save and could revert a move made since the read; (2) the document carries
  `salesAreaEnglish`/`salesAreaArabic` — back on the model, unread (labels stay client-built for bidi);
  (3) Arabic names aligned to the server's `التجزئة - السعودية` / `التجزئة - البحرين`, and "منطقة البيع" →
  "منطقة المبيعات" as the server words it; (4) `Upload` takes optional `salesOrganization`/`distributionChannel`
  form fields for a promotion the file creates — the dialog now sends the page promotion's own on-list pair
  (`uploadSalesArea`, pure-tested), none for a no-pair or off-list document. Drive stubs use the shipped shapes
  and refusal text. `bby-sales-area-drive.mjs` 23/23 (new upload step 6). Live walk owed after BO deploy.
- 2026-11-20 (BO review fixes 1648fd2c3): the Upload POST also takes optional form fields `salesOrganization` / `distributionChannel`, used only when the file creates a new promotion (missing = KSA). New refusal codes to show: `BBY-SALES-AREA-LOCKED`, `BBY-PROMOTION-SALES-AREA-MOVED` (reload and save again), `BBY-PROMOTION-SALES-AREA`, `BBY-COPY-SALES-AREA`. The document and list carry `salesAreaLocked`.
