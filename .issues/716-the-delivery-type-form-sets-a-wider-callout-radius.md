---
status: open
spec: C:\Work\DMSCO\BackOffice\.issues\3326-a-callout-widens-when-nobody-can-serve-and-a-failed-take-counts-against-the-taker-spec.md
blocked-by: —
---

# 716 — The delivery-type form sets a wider callout radius

## What to build

Backend: BackOffice spec 3326, branch `spec3326` (tip `24035f297`, now reachable from `pricing2`), tickets 3333. SIS.Api minimal APIs, System.Text.Json web defaults: camelCase fields, dictionary keys as sent.

Doors: `GET` / `PUT SdDocTypeConfigWeb/DeliveryDocumentTypes/{code}` and `POST .../{code}/Copy`
(`SdDeliveryDocumentTypeSettings`, also the `before` / `after` of a save). Server:
`Sartawi.Retail.Data\Modules\Sd\DocTypeConfig\SdDocTypeConfigAdminModels.DeliveryTypes.cs` and `...AdminService.DeliveryTypes.cs`.
Client: `src/features/admin/doc-type-config/delivery-type-types.ts`, `delivery-type-form.ts`, `locales/*/doc-type-config.json`.

New on `DeliveryTypeSettings` (not in the TS model today):

- `calloutExpandedRadiusKm: number`: the wider radius. **`0` = off.** It takes effect only when it is **greater than**
  `calloutRadiusKm`; at or below it, the server stores it and ignores it. The server refuses a **negative** value with
  `SDC-00053`, on the field, with "CalloutExpandedRadiusKm cannot be negative." /
  "لا يمكن أن يكون نطاق الاستدعاء الموسّع بالكيلومتر سالباً." Read, save and copy all carry it.

**Form.** In `DELIVERY_FIELD_GROUPS` → `callouts`, add `{ field: 'calloutExpandedRadiusKm', kind: 'number' }` right after
`calloutRadiusKm`. Show the server's refusal on the field. Add a client **warning, not a refusal**, when it is above 0 but not
above the callout radius: the server accepts that, so the screen must not block it. The history and change-log views show
the field like any other.

**Why it cannot wait.** A save sends the `before` settings, and the server refuses it as stale when they differ from the
stored row. A screen that does not know the field sends no `before` value for it. Once the owner's seed sets `QC` to 10, the
server is expected to refuse every save of `QC` from today's screen as stale. Check this on the walk.

Labels (Arabic drafts, **to be reviewed**):

| Key | English | Arabic (draft, to review) |
|---|---|---|
| `field.calloutExpandedRadiusKm` | Wider callout radius (km) | نطاق الاستدعاء الموسّع (كم) |
| `fieldHint.calloutExpandedRadiusKm` | Searched once more only when no store can serve within the callout radius. 0 = off. | يُبحث فيه مرة أخرى فقط إذا لم يتمكن أي فرع ضمن نطاق الاستدعاء من الخدمة. 0 = متوقف. |
| `warning.expandedRadiusNoEffect` | Has no effect: it must be larger than the callout radius. | لا أثر له: يجب أن يكون أكبر من نطاق الاستدعاء. |

## Proof

- [x] `delivery-type-form.test.ts`: the field is in the callouts group after `calloutRadiusKm`; a value at or below the radius warns and still saves; a negative one shows `SDC-00053` on the field (stub)
- [ ] Live: read, save and copy of a type carry the field; `QC` saves after the seed

## Boundaries

No new grant: the same doc-type config grants. The screen never sets `QC` itself: the owner's reviewed seed does.

## Done when

An HQ user reads and sets a delivery type's wider callout radius, and a type with one set still saves, against the deployed door.

## Blocked by

BackOffice spec 3326 deployed, with HQ SQL `Callouts/Sql/005`–`007` and `Sd/Sql/064` run.

## Comments

**2026-11-03 — built (stubbed), branch `impl/3326-716`.**

- `DeliveryTypeSettings.calloutExpandedRadiusKm: number` (shape of `SdDeliveryDocumentTypeSettings` on `pricing2`), so
  read, save (`before` and `after`) and copy carry it. In `DELIVERY_FIELD_GROUPS` → `callouts` right after
  `calloutRadiusKm` as `{ field: 'calloutExpandedRadiusKm', kind: 'number' }`.
- `deliveryFieldWarnings(draft)`: `expandedRadiusNoEffect` when `0 < wider <= calloutRadiusKm`. A warning under the
  field only; Save is never blocked. No warning at 0 (off) or negative (the server's `SDC-00053`, which the existing
  `SDC-00010` field mapping already puts on the field).
- The field shows a hint under its input (`DELIVERY_FIELD_HINTS`). History and change-log label it through the generic
  `fields.<field>` path.
- Keys differ from the ticket's table to match the namespace's layout: `fields.calloutExpandedRadiusKm`,
  `deliveryTypes.fieldHints.calloutExpandedRadiusKm`, `deliveryTypes.warnings.expandedRadiusNoEffect`. Same text, en and
  ar. **Arabic is still a draft to review.**

**Proof.** `delivery-type-form.test.ts` (+4: placement, warn-and-save at/below the radius, no warning at 0/above/negative,
`SDC-00053` on the field) and `delivery-types-i18n.test.ts` (new keys en + ar). `tools/delivery-types-drive.mjs` step 9:
**72/72 STUBBED** in LTR and RTL. It covers detail and dialog order, the hint, `SDC-00053` on the field, the warning with
Save open, the PUT's before/after, the copy, and the History label. Note: RTL in this drive sets direction only, with no
runtime language switch, so the Arabic text is proven by the unit test, not the drive. Gates: typecheck green;
`npm test` 599 files / 8449 tests green. Lint: grid-base, contrast, palette and controls are green. **check-boundaries
fails on a pre-existing violation** (`insurance-rules/aliases/door-shapes.test.ts` imports `fields`/`labels`, from
`e9243c46`/3271), which this ticket did not touch.

**Remains (live, unticked).** Walk against the deployed door after `Callouts/Sql/005`–`007` and `Sd/Sql/064`: read,
save and copy carry the field. **QC-stale check:** once the owner's seed sets `QC` to 10, save `QC` from this screen.
It should succeed. Today's screen (without the field) is expected to get `SDC-00004`.

