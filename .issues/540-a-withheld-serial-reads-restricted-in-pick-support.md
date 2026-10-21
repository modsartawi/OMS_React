---
status: open
spec: C:\Work\DMSCO\BackOffice\.issues\assets\2875-oms-react-withheld-serial-brief.md
blocked-by: — (live walk: BackOffice 2872–2874 deployed, seed run, one support user bound to OMS_PICK_SUPPORT_SERIAL and one without)
---

# 540 — A withheld serial reads Restricted in Pick support, for a granted and an ungranted support user

## What to build

A picked unit's GS1 serial is now seen only by holders of `BackOfficeScreen[PickSupportSerial,03]`
(BackOffice spec 2871, built by 2872–2874). **SIS.Api withholds the serial itself**: for an ungranted
caller no serial leaves the server in any field. The client's job is to **draw a withheld serial as
Restricted**, keep a unit that never had a serial as "—", and word the search hint from the probe.
Brief 2875 is the source and wins over the spec. This one ticket covers both the build (stubbed) and
the staging walk that closes it.

**The rules (decided in the brief; do not re-derive):**

1. **The server decides, per unit**, through `serialWithheld`. The client never works out visibility,
   and never decides it from the probe flag. If the flag and the data disagree, the data wins.
2. **Restricted ≠ "—".** `serialWithheld: true` (with `serialNumber: ""`) → **Restricted**.
   `serialWithheld` false or absent with an empty serial → "—" (`Val`), as today. A non-empty serial →
   the serial, as today.
3. **Server text arrives already withheld.** Copy text, copy JSON, timeline details and hold
   explanations carry `[restricted]` where a serial stood. Show and copy them **as sent**: never
   replace, translate or strip the marker.
4. **The probe flag is advisory and fails closed.** `canSeePickSupportSerial` reads `false` while the
   probe is pending, when it failed, and when an older SIS.Api leaves it out.
5. **The no-match view needs no special case.** For an ungranted caller a serial key gets the plain
   unknown-key sentence. Never add a "this may be a restricted serial" hint.

Vocabulary: say **Restricted** / **withheld**. Never say "masked" or "hidden".

### Wire (additive; an older SIS.Api omits both)

```ts
// core/models/pick-support.ts — on the diagnosis unit (PickDocumentUnitModel) and the serial hold
/** True when SIS.Api withheld this unit's serial (BackOffice 2872). Absent reads false. */
serialWithheld?: boolean

// core/models/oms-access.ts — beside canOpenPickSupport / canFixPickSupport, and in OMS_SCREEN_FLAGS
/** `BackOfficeScreen[PickSupportSerial,03]` — Pick support returns serials (BackOffice 2874). */
canSeePickSupportSerial?: boolean
```

A withheld diagnosis unit also has `scannedText: ""` (a GS1 scan embeds the serial). It is not drawn
today. If it is ever drawn, it is "—", never Restricted. A hold's `serialWithheld` is always `false` (only
a granted caller gets holds), but it is modelled and drawn by the same rule so one cell serves
every table.

### Screen

- **One serial cell** in `core/pick-support`: a pure decision (`restricted | serial | none`) plus a
  small component. Restricted is a muted badge or italic text with the lock icon (lucide `Lock`) and a tooltip
  ("Serials are visible only to users with the serial permission", UI wording). Isolation follows
  [bidi](../.claude/rules/bidi.md): the serial is a machine value (`Ltr`), and the tooltip is a string sink.
- **Used in:** the units table in `DiagnosisPanel.tsx` (the console's diagnosis and the Document
  Details Pick support section both follow from it), and the console's serial holds table in
  `PickSupportPage.tsx`.
- **Search hint:** `search.placeholder` names "serial" among the key kinds only when
  `canSeePickSupportSerial` is true. Use a second key without "serial" otherwise.
- **Table note:** a one-line "Serials are restricted for your account" on the units table (and the
  holds table) when the flag is false.
- Keys in the `pick-support` namespace, **EN and AR**.

## Spine reach

model/api (two optional wire fields + one probe flag) · store/logic (pure serial-cell decision,
`omsGrants` flag) · component (one cell, two tables, placeholder, note) · i18n (EN+AR
`pick-support`) · test (vitest + stubbed drive) · live walk on staging

## Proof (→ `tdd` red-green cycles)

- [x] `serialCell reads Restricted when serialWithheld is true`: pure, vitest
- [x] `serialCell reads none for an empty serial without the flag, and serial for a non-empty one; an absent serialWithheld draws as today`: pure, vitest
- [x] `omsGrants reads canSeePickSupportSerial false when absent, false, or the probe is pending/failed`: pure, vitest (extend `core/oms/access.test.ts`, including its `OMS_SCREEN_FLAGS` set-equality)
- [x] Stubbed drive: a withheld GS1 unit shows the Restricted badge, a plain unit shows "—", a granted
      stub shows the serial; the placeholder drops "serial" when the flag is false; the copy text
      with `[restricted]` is copied verbatim. Verify via typecheck + drive.
- [ ] **Staging walk** (live: BackOffice 2872–2874 deployed, `Seed-PickSupport-Authorization.sql`
      run, one support user bound to `OMS_PICK_SUPPORT_SERIAL` and one without; owner acts):
  - the same delivery opened by both users: the ungranted user sees Restricted on the GS1 units and "—"
    on the plain ones, and the granted user sees the serials;
  - the ungranted session's network tab shows no serial in the `PickSupport/Delivery` body;
  - a serial typed by the ungranted user gives the plain no-match sentence, and typed by the granted
    user it gives the holds table.

## Boundaries

- No new endpoint: additive fields on `PickSupport/Delivery`, `PickSupport/Fix` (its `diagnosis`),
  `PickSupport/Resolve` and `SdDocumentWeb/Access`. The doors keep their `PickSupport,03` / `,06` gates
  and 403s exactly as brief 2691 says.
- New keys in the existing `pick-support` namespace (EN + AR). No nav or route change.
- **Approval document units (brief 2808):** not ticketed in oms-react yet, and `PickSupportApprovalUnit`
  does not exist. When 2808 is ticketed, its units table gets optional `serialWithheld` on that model
  and uses **this** cell. Put that in the 2808 ticket, not a separate one.
- Independent of [500](500-the-pick-support-console-calls-the-real-doors-on-staging.md): different
  live preconditions, so the walk is here, not folded into 500.
- Out of scope: the Central invoices Serials dialog, batch/lot/expiry/GTIN, serials outside Pick
  support, auditing views, any client-side mask or partial serial.

## Done when

The three vitest cases and the stubbed drive are green with typecheck. The build can merge on the
stubs. The ticket closes when the owner's staging walk holds for both users: Restricted / "—" /
serial as above, no serial on the ungranted wire, and a serial key gives no-match vs. the holds table.

## Blocked by

None. The build can start immediately. The walk waits on the BackOffice 2872–2874 deploy, the seed
and the two bound users.

## Comments

**2026-10-21 — build done on the stubs; ticket stays open for the staging walk.**

- Pure: `serialCell` in `src/core/pick-support/serial.ts` (+ `serial.test.ts`); `canSeePickSupportSerial`
  joins `OMS_SCREEN_FLAGS` with its reader in `src/core/oms/access.ts` (`access.test.ts` extended,
  set-equality included). vitest 5696/5696.
- Cell: `Serial` + `SerialsRestrictedNote` in `src/core/pick-support/bits.tsx`, used by the
  `DiagnosisPanel` units table (so the console and Document Details both get it) and the console's
  holds table. `DiagnosisPanel` takes `serialsRestricted` for the note only; `DeliveryDiagnosis` feeds
  it from the probe. The hint is `search.placeholder` / `search.placeholderNoSerial`.
- Restricted is muted italic text with the lucide `Lock` and a `title` tooltip (a fixed UI sentence,
  no data in it, so no `fsi`). The note sits once at the top of the Documents section, not once per
  units table (one line per line item read as noise).
- Drive: `tools/withheld-serial-drive.mjs` 36/36 (LTR + RTL; Copy as text AND Copy as JSON verbatim), including the data-wins case (granted
  flag, withheld unit → Restricted). `tools/pick-support-drive.mjs` 290/290 unchanged. typecheck,
  lint and build green.
- Left for the owner: the staging walk (BackOffice 2872–2874 deployed, seed run, two bound users).
- `/standards-review` since 120b8f1: Standards — no hard violations. Judgement calls left as they
  are: the same flag is named two ways (`seesSerials` vs `serialsRestricted`), the probe is read in
  two places, and there is no CONTEXT.md entry for withheld/Restricted (a `/domain-modeling` candidate).
  Spec — no blocking findings. The drive's `copy.json` stub was off-brief and has been fixed in this ticket.
- **Owner sign-offs:**
  1. The note sits once per Documents section, not once per units table.
  2. A unit that is `serialWithheld: true` but still carries a serial reads **Restricted**. That is
     fail-closed, and the brief only defines `true` with `""`.
  3. Restricted's tooltip is a `title`, so a keyboard user cannot reach it.
- Probe flash: while the probe is pending, the flag reads false, so a granted user would see the note
  and the hint without "serial". In practice both hosts open behind the same cached probe, through
  `ScreenGate` or the Details section's gate, so it does not show.

