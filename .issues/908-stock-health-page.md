---
status: open
spec: BackOffice 4011 (brief C:\Work\DMSCO\BackOffice\.issues\assets\4011-oms-react-stock-health-brief.md)
blocked-by: BO 4012 (done), BO 3994 (grant seed)
---

# 908 — Stock health page

## What to build

A new leaf under the **OMS** nav group, beside **Store stages**: **Stock health** / **صحة المخزون**
(door BackOffice 4012, grant BackOffice 3994, [brief](C:\Work\DMSCO\BackOffice\.issues\assets\4011-oms-react-stock-health-brief.md)).
One page that says whether batch stock is in good shape, one tile per signal, so the owner stops opening five screens
to find out.

- **Doors:** `GET StockHealth` (`{ readAt, signals[] }`, signals in the spec's order) and `GET StockHealth/Access`
  (`{ screenAllowed }`), the usual OMS envelope. The brief has the exact shapes; read its **Changes** lines before
  building (4012 shipped with no rename; S8 `drsQueue` appears only once BackOffice 3993 ships, so the page must not
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

- [x] `the header reads All good only when every judged signal is good` · pure (null verdicts are not judged) (`health.test.ts`)
- [x] `noAnswer draws as did-not-answer, never as neutral` · pure (`health.test.ts`)
- [x] `an AR reason is picked by key and verdict, with the figures interpolated` · pure (`health.test.ts`, a real i18next over the shipped locale files)
- [x] drive (stubbed): tiles in order, a tile opens its link, refresh re-reads, no leaf without the grant (`tools/stock-health-drive.mjs`, 82/82)
- [ ] staging walk: all green; SIS.Stock stopped shows No answer on S1-S4 only; a user without the role does not see
  the leaf (BackOffice 3994's open proof)

## Boundaries

- No change to the existing OMS screens; the page only links to them.
- No verdict logic in the browser: the server judges, the page draws.

## Done when

- The page is built on the brief, the pure tests and the drive are green, and the staging walk is recorded here.

## Blocked by

- BackOffice 4012 (door - done). BackOffice 3994's seed must be run on the target DB before the walk, or every caller
  but ADMIN is refused.

## Open questions

—

## Comments

**2026-11-18 — built (stubbed); the staging walk is owed.** Branch `spec/4011-stock-health`. Feature
`src/features/oms/stock-health/` (`access.ts`, `api.ts`, `health.ts`, `StockHealthPage.tsx`), model
`src/core/models/stock-health.ts`, `locales/{en,ar}/stock-health.json`, route `oms/stock-health`, OMS leaf right after Store
stages (lucide `HeartPulse`).

- Tones: good/watch/bad on the success/attention/danger grounds; `noAnswer` a 2px danger outline on the card ground with a
  "Did not answer" pill; `null` the plain card. A verdict the page does not know draws as watch and counts as needing
  attention (never green, never grey). An answer with no signal says so rather than "All good".
- Reasons: the EN locale holds `{{reason}}` for each `reason.<key>.<verdict|none>`, so English shows the server's line and the
  two locales mirror; AR interpolates figures by position (`{{f1}}`…, every figure, not only the four shown) and
  `{{detail}}` (the server line, isolated) for noAnswer, so the failed door is still named. A key/verdict AR lacks falls
  back to the server's English line. AR figure labels: `figure.<key>` maps the English label; an unknown label stays
  English. Times are never parsed: `T` becomes a space.
- S8 `drsQueue`: drawn when present (drive case 6, eight tiles, "All good"); its AR reasons are generic per verdict and it
  has no AR figure labels yet - fill them when BackOffice 3993 settles its figures.
- Typecheck green; `npm test` 11042/11042; lint gates grid-base, contrast, palette, controls, map-build green; the
  boundary gate is red on the pre-existing `insurance-rules/aliases/door-shapes.test.ts` (on main too), not this diff.
- The drive runs EN copy in both directions (`lng` stays `en` app-wide); the Arabic text is pinned by the pure tests.

**Brief vs shipped door (for the walk):**
- `storeStages` sends five figures when SIS.Stock's stage log answers (the four stages + "Seeding over N hours"); the page
  shows four, so the stuck-seeding count is only in the reason line (the watch reason names the stores).
- Some figure labels are not fixed strings: S1's are built from the feed watcher's config (`<feed name> age (minutes)`),
  S7's fifth from `StockHealth:SeedingWatchHours`. The AR map holds the default spellings only; another value shows English.
- AR reasons are one sentence per key + verdict, so they cannot carry every EN variant (S1 bad names which feeds;
  S2 bad is either the alerts' text or the errored count; S7 `null` is either the stage summary or "the stage log did not
  answer"). The AR line is the summary; the figures carry the detail.

**2026-11-18 — S8 filled, five figures.** BackOffice 3993 merged into `spec4011` (92a588ddc): `drsQueue` is the eighth
signal, `link: null`, figures `Unsent`, `Oldest unsent (minutes)`, `Failed, waiting to retry`, `Last sent`,
`Last heartbeat`; `null` with no figures = "DRS holds are off". Its AR reasons now carry the figures (watch and bad name the
waiting count and the oldest row's age, bad also the last heartbeat, since a stale heartbeat is the other way to bad), the
`null` line reads "حجوزات DRS متوقفة", and all five figure labels have Arabic. Per the coordinator's decision the tile cap is
**five** figures (the brief will say "up to five" on the BackOffice side), so S7's "Seeding over N hours" now shows; the
first mismatch above is closed. Drive extended: S8 in 3993's shape (five figures, no link), and S8 `null` (neutral, no
figures, not counted). Drive 82/82.

**2026-11-18 — aligned with BackOffice review fixes (spec4011 b9f6b3403).** S8 now beats with holds on or off
(`holdsOn`) and judges each DRS instance, worst wins, the reason naming the instance(s); figures total the instances. The AR
`null` line is now just "حجوزات DRS متوقفة." (it covers both "never beat" and "every instance switched off", where the
figures still show). The AR watch and bad lines keep the totals and append the server's line, isolated, because only it
names the slow or silent instance. No label changed (S7 and S8 alike). S7's reason now names its source (Stock
Visibility's stage list, or PickStoreStage with four figures when that does not answer); the AR `none` line is the stage
counts only and does not name the source. Drive: S8 holds-off with figures (neutral, not counted) and two instances
(watch, reason names DRSWEB02, header counts 1). Drive 90/90; tests 11046/11046.

**2026-11-18 — S5 wording (spec4011 ba6818ce4).** `takeDoor` figures are now `Takes`, `Failed calls`, `Failed calls per 100
takes` (null with no take), `Skipped at the time limit`; AR labels follow. AR reasons speak of failed door calls, never a
share of takes that failed: good "لم يفشل أي طلب عند الباب اليوم."; watch gives the failed calls, the takes and the per-100
figure; bad gives the failed calls and the takes only, so the same line reads right when there was no take (the per-100
figure is on the tile). Drive fixture on the new shape, plus the four labels in order: 94/94; tests 11047/11047.
