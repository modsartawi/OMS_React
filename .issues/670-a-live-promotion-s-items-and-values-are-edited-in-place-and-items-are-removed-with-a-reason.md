---
status: done
spec: C:\Work\DMSCO\BackOffice\.issues\3201-hungerstation-promotions-are-made-on-oms-react-and-sent-to-hungerstation-spec.md
blocked-by: 668, 669 (live: BackOffice 3215)
---

# 670 — A live promotion's items and values are edited in place, and items are removed with a reason

## What to build

- **Edit** a sent promotion: add or remove items (paste again or edit rows), change values, max
  quantities, limits and display names. Save + re-send with a reason.
  - Before sending, the Check preview shows what changes on HungerStation: items leaving a part, a
    new part, a part switched off because it is left empty.
- **Remove items**: select rows on the detail → remove with a reason. They read inactive and stay
  visible.
- The editor **locks the name, stores, start and end** of a sent promotion. Changing any of them is
  the Replace flow (671); the locked fields say so ("Changing this replaces the promotion").
- Disabled while any part is Sending. The server refusal for an identity change while editing shows
  inline and points to Replace.

Wire shapes: the contract's edit and RemoveItems sections (added by BackOffice 3215).

## Spine reach

UI → app (BackOffice doors, stubbed)

## Proof (→ `tdd` red-green cycles)

- [x] `identityLocked`: name/stores/start/end locked once sent, everything else editable (vitest)
- [x] drive (LTR + RTL), against stubs: edit preview shows a moved item and a switched-off part; edit and remove-items bodies with reason; disabled while Sending
- [x] `npm run typecheck`, `npm run lint`, `npm test` green

## Boundaries

oms-react only.

## Done when

A live promotion edits and removes items from stubs, with the bodies matching the contract.

## Blocked by

[668](668-a-same-item-bundle-sheet-with-mixed-values-is-previewed-as-the-parts-it-will-be-sent-as.md),
[669](669-a-promotion-hungerstation-partly-refused-shows-what-did-not-take-per-store-and-a-part-is-resent.md)

## Comments

- 2026-10-29 (built, `impl/670`): **done against stubs only. No BackOffice door exists, and the
  contract asset has no edit or RemoveItems section yet (BackOffice 3215).** So "done" means vitest +
  typecheck + lint + the drive green against stubbed envelopes (real `errors[]` shape). Nothing was
  called live.
  - **Pure modules (vitest):** `promotion-edit.ts`: `lockOf` / `identityLocked` (once sent, the name,
    stores and window are `replace`, the chain and type `fixed`, everything else editable; a draft
    locks nothing), `editMode` (`draft` / `inPlace` for live, livePartlyRefused, failed, scheduled /
    `sending` / `closed`), `editCheckBody`. `edit-changes.ts` `editChanges` reads the server's
    per-part answer into new / switched-off / re-sent / unchanged parts, and per material: moved
    (left A, joined B), left, joined, plus the HungerStation call count. `checkSummary` carries it as
    `changes`; `checkOfRefusal` reads it defensively.
  - **Editor, in place:** a sent promotion opens in the same editor (`?edit=<id>`). The name, start /
    end and stores are disabled, each with "Changing this replaces the promotion."; the chain and type
    read "Fixed once the promotion is sent." Display names, reason, limits, defaults and the paste stay
    editable. **Check** runs on the edit AS TYPED (it is the Check body) and shows "What changes on
    HungerStation": a table per part (New part / Switched off / Re-sent, combination, SKUs after,
    leaving, joining), the moves, the items that leave (inactive there) and join. A change after Check
    drops the answer. **Save and re-send** checks first, then takes a reason (`PUT` with the save
    body); the detail takes over. DHS-00021 shows inline in the dialog with the Replace pointer;
    DHS-00017 re-reads the detail so the editor locks; DHS-00018 puts its Check answer in the panel.
  - **Replace hook for 671:** `PromotionEditor` takes `onReplace?: () => void`. When it is passed, a
    **Replace…** button appears in the in-place note, under each locked field and beside the DHS-00021
    refusal (`data-editor-replace=<field>`). Nothing passes it yet: 671 wires it from
    `PromotionsPage` to its dialog. The words show either way.
  - **Detail:** **Edit** for a sent promotion (disabled while Sending, "Edit draft" kept for drafts).
    **Remove items**: a tick column on active items, plus tick-all → "Remove N items" → the area's reason
    dialog → `POST …/RemoveItems { materialNumbers, reason }`. The items read Removed and stay listed.
  - **Sending lock = ANY part** (spec 3201's "any write"), via `editMode`: a QUEUED part that is not
    `unanswered` locks Edit, Remove items and the editor, whatever the status word says. 669's Resend
    keeps its per-part lock.
  - **Drive 435/435** (346 before + 89 for 670), § 13 (LTR + RTL). Its doors are overrides (`doors670`), so the DOORS table is
    untouched for 671. The stub does 3215's recompute. Three older checks were updated: § 4's item
    cells skip the new tick column, and § 6 now expects Edit disabled while Sending, where before there
    was no Edit. 666–668's Check stubs now emit `changes: null`.
  - 🚩 **Assumptions for the contract (BackOffice 3215):** (1) **the edit preview rides `POST …/Check`
    with the edit as its body** (`HungerStationPromotionEditCheckBody` = save body less reason). A live
    promotion's save IS its re-send, so there is no saved version to check. **BO ask:** accept the body
    on Check, or add a preview door. (2) The answer gains `changes: HungerStationPromotionPartChange[] |
    null` (partId null for a new part; `change` new / updated / switchedOff / unchanged; `leaving` /
    `joining` as our material numbers), and it is `null` for a draft's no-body Check. (3) The edit is the same
    `PUT Promotions/{id}` with the full save body, identity fields as sent. (4) DHS-00021 = the
    identity-change refusal (665's numbering). (5) Chain and type are fixed once sent: they are neither
    in place nor in Replace's body.
  - **Open:** "edit rows" is covered by pasting the sheet again (it replaces the list, and what is left
    out leaves its part). There is no per-cell grid editing. Is that enough, or should the grid edit rows
    in place?

- 2026-10-29 (reconciled to the contract, `impl/3201-review`): **reconciled to the BackOffice door contract on 2026-10-29** (`C:\Work\DMSCO\BackOffice\.issues\assets\3201-hungerstation-promotion-door-contract.md`, BO 3211–3216 done). Shapes are now field for field the asset (`core/models/hungerstation.ts`; the drive's § 0 parses the asset's JSON examples and fails on any drift). **Still stubs only — no live SIS.Api call has been made.** Each "decision" below follows the contract over this ticket and is overrulable by the owner.
  - **Decision (overrulable): no edit preview.** The contract's Check takes NO body and has no per-part `changes`, so the "what changes on HungerStation" preview is gone. Save and re-send now opens the reason dialog directly; the PUT runs every check and refuses (DHS-00018 / 19, the message names the rows, nothing sent), then answers with `check`. The editor says so in place of the Check panel.
  - **BackOffice ask A1:** an edit dry-run — `POST Promotions/{id}/Check` taking the edit as its body (or `PUT …?dryRun=true`) — answering the Check plus the per-part plan (re-upserted / new / switched off, materials leaving and joining). With it the preview comes back as built before.
  - Review B5: an "all stores" promotion's edit sends `storeCodes: null` = the stores frozen at send (3215), never the chain's stores now.
  - Remove items: ticking EVERY active item is refused before the call (the contract: that is a switch-off). DHS-00017 / `HungerStationPromotionSent` re-read the detail.
  - Review C6: the item columns (`editor-columns.ts`), the stores picker (`EditorStores.tsx`) and the Remove items dialog (`RemoveItemsDialog.tsx`) are their own files.
