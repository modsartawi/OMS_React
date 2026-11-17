---
status: open
spec: BackOffice 3991 (brief C:\Work\DMSCO\BackOffice\.issues\assets\3991-oms-react-stock-health-brief.md)
blocked-by: BO 3992 (done), BO 3994 (grant seed)
---

# 908 — Stock health page

## What to build

A new leaf under the **OMS** nav group, beside **Store stages**: **Stock health** / **صحة المخزون**
(door BackOffice 3992, grant BackOffice 3994, [brief](C:\Work\DMSCO\BackOffice\.issues\assets\3991-oms-react-stock-health-brief.md)).
One page that says whether batch stock is in good shape, one tile per signal, so the owner stops opening five screens
to find out.

- **Doors:** `GET StockHealth` (`{ readAt, signals[] }`, signals in the spec's order) and `GET StockHealth/Access`
  (`{ screenAllowed }`), the usual OMS envelope. The brief has the exact shapes; read its **Changes** lines before
  building (3992 shipped with no rename; S8 `drsQueue` appears only once BackOffice 3993 ships, so the page must not
  assume a fixed count).
- **Tiles:** one per signal, in order, coloured by verdict: good green, watch amber, bad red, **`noAnswer` red-outlined
  with "did not answer"** (never grey: a dead source is not fine), `null` neutral (a figure-only signal). Each tile
  shows the reason line and up to four figures; clicking it opens `link` when present (existing routes:
  `oms/held-stock-report/refusals`, `oms/held-stock-report/gates`, `oms/store-stages`).
- **Header:** "All good" when every judged signal is good, otherwise "N need attention"; "as of <readAt>".
- **Refresh:** every 60 seconds, plus a Refresh button.
- **Arabic:** the server sends EN only. AR reason text is keyed by `key` + `verdict` in `locales/ar/stock-health.json`
  with the figures interpolated; AR figure labels are keyed by `key` + label. Times are local `yyyy-MM-ddTHH:mm:ss`,
  no offset - do not shift them.
- **Grant:** the leaf and its menu entry are shown only when `StockHealth/Access` says `screenAllowed`
  (`BackOfficeScreen[StockHealth, 03]`, role `STOCK_HEALTH_VIEWER`), probed the way the held stock report leaves are
  (`features/oms/held-stock-report/access.ts`).

## Spine reach

model/api (answer + access probe) · logic (header line, verdict → tone, AR reason keying) · components · i18n (EN+AR)
· route/menu · test + drive

## Proof

- [ ] `the header reads All good only when every judged signal is good` · pure (null verdicts are not judged)
- [ ] `noAnswer draws as did-not-answer, never as neutral` · pure
- [ ] `an AR reason is picked by key and verdict, with the figures interpolated` · pure
- [ ] drive (stubbed): tiles in order, a tile opens its link, refresh re-reads, no leaf without the grant
- [ ] staging walk: all green; SIS.Stock stopped shows No answer on S1-S4 only; a user without the role does not see
  the leaf (BackOffice 3994's open proof)

## Boundaries

- No change to the existing OMS screens; the page only links to them.
- No verdict logic in the browser: the server judges, the page draws.

## Done when

- The page is built on the brief, the pure tests and the drive are green, and the staging walk is recorded here.

## Blocked by

- BackOffice 3992 (door - done). BackOffice 3994's seed must be run on the target DB before the walk, or every caller
  but ADMIN is refused.

## Open questions

—
