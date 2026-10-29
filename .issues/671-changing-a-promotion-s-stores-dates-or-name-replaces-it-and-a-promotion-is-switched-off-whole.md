---
status: done
spec: C:\Work\DMSCO\BackOffice\.issues\3201-hungerstation-promotions-are-made-on-oms-react-and-sent-to-hungerstation-spec.md
blocked-by: 668, 669 (live: BackOffice 3216)
---

# 671 — Changing a promotion's stores, dates or name replaces it, and a promotion is switched off whole

## What to build

- **Replace**: a dialog to change the name, stores, start or end of a sent promotion, with a reason.
  It says in words what happens: "HungerStation sees a new promotion. The current one is switched
  off first; if that is refused, nothing changes."
  - On success, the old promotion reads **Replaced** with a link to the new one, and the new one links
    back.
  - On a refused switch-off, the refusal names the part and the old promotion is shown unchanged.
- **Switch off** the whole promotion, with a reason and a confirmation in words. It then reads
  **Switched off**. Nothing is deleted.
- The list gains the **Scheduled** and **Ended** filters (from the window) and a **store** filter
  ("which promotions are live on this store").
- Both actions are disabled while any part is Sending.

Wire shapes: the contract's Replace, SwitchOff and list-filter sections (added by BackOffice 3216).

## Spine reach

UI → app (BackOffice doors, stubbed)

## Proof (→ `tdd` red-green cycles)

- [x] `replaceNeeded`: true exactly when name/stores/start/end differ from what was sent (vitest)
- [x] drive (LTR + RTL), against stubs: replace body + both links; refused switch-off shows the part and leaves the old unchanged; switch-off body; Scheduled/Ended/store filters ⇄ URL
- [x] `npm run typecheck`, `npm run lint`, `npm test` green

## Boundaries

oms-react only. The order (switch off first) is the server's; the page only words it.

## Done when

Replace and switch-off work from stubs, with the bodies matching the contract.

## Blocked by

[668](668-a-same-item-bundle-sheet-with-mixed-values-is-previewed-as-the-parts-it-will-be-sent-as.md),
[669](669-a-promotion-hungerstation-partly-refused-shows-what-did-not-take-per-store-and-a-part-is-resent.md)

## Comments

- 2026-10-29 (built, `impl/671`): **done against stubs only. No BackOffice door exists, and the
  contract has no Replace / SwitchOff / list-filter section yet (BackOffice 3216).** So done means
  vitest + typecheck + lint + the drive green against stubbed envelopes (real `errors[]` shape).
  Nothing was called live.
  - **Pure module** `replace-form.ts` (vitest): `replaceNeeded` (name trimmed, start / end to the
    minute, stores as a set), `replaceProblems`, `replaceBody`, `promotionActions` (offered on
    sending / live / livePartlyRefused / failed / scheduled; disabled while the status is sending or
    ANY part is Sending; an unanswered part is not Sending), `replaceRefusalOf` (DHS-00020 data).
  - **Replace** (`ReplaceDialog`, opened from the detail sheet): name, the four Saudi-local window
    boxes, the chain's stores ticked as sent (a sent store the picker no longer offers stays listed),
    the note in words, and the reason. Confirm waits until something HungerStation keys on has
    changed. On success the NEW detail is cached and opened (`?promotion=<new>`); each end links to
    the other (`replacesId` / `replacedById` are now links). DHS-00020 stays in the dialog naming the
    part (its name, HungerStation's HTTP status and answer, the code) and the old detail is re-read,
    unchanged; DHS-00019 shows inline under the name.
  - **Switch off** (`SwitchOffDialog`): the area's reason dialog on the danger button, the note in
    words; `{ reason }` to `…/SwitchOff`; the answer lands in the sheet (Switched off, nothing deleted).
  - **List:** Scheduled / Ended were already chips (665); new **Live on store** box (`store=`,
    applied on Search with the name, emptied by Clear). All three proven URL ⇄ door.
  - **Drive** § 14 (LTR + RTL), door overrides only. 670 (§ 13) had not merged when this was built,
    so its editor hook to Replace is wired only if it landed before the merge (see the merge note).
  - 🚩 **Assumptions for the contract (BackOffice 3216):** (1) DHS-00020 is a 502 whose envelope
    `data` is `HungerStationPromotionReplaceRefusal` `{ partId, name, httpStatus, error }` (a new
    model). (2) Replace always sends `allStores: false` with explicit `storeCodes` (stores freeze at
    send anyway). (3) SwitchOff answers the detail already reading `switchedOff` (no Sending phase).
    (4) Replace / Switch off are offered on a **Failed** promotion too (its completed parts are live).
  - **Open:** should the linked promotions show their names, not only ids? The detail carries ids only.
