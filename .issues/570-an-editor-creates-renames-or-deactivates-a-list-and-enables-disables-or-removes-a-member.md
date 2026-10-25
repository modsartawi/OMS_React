---
status: open
spec: C:\Work\DMSCO\BackOffice\.issues\3042-serving-lists-and-store-duty-for-callouts-spec.md
blocked-by: 568 (live: BackOffice 3045 deployed)
---

# 570 — An editor creates, renames or deactivates a list, and enables, disables or removes a member

## What to build

**The serving-list writes**, for BackOffice spec 3042 (stories 29, 30, 32–36). The contract is the spec's
`## Comments` → "oms-react hand-off (2026-10-25)". Every control is shown only when `canEditServingLists`.

**Common to every write:**

- Each write takes an optional **note** (at most 500 characters; the server clamps it).
- Each answers the list's `ServingListRow`. Then invalidate Lists, the list's Members and its Changes.
- Refusals show in the dialog by code. Use the screen's own EN / AR words, and keep the server's `"English / Arabic"`
  string as the fallback.

**List-level actions:**

- **Create**, from a "New list" button on the grid (567):
  - door: `POST ServingListWeb/Lists` `{ nameEn, nameAr, note? }`;
  - both names are required, at most 100 characters each. Check client-side, and map `SVL-00005` / `SVL-00006`;
  - the Arabic field is RTL;
  - on success, open the new list.
- **Rename**, from the detail header:
  - door: `PUT ServingListWeb/Lists/{id}/Name` `{ nameEn, nameAr, note? }`, with the same rules;
  - unchanged names are a no-op on the server, so disable Save until something changed.
- **Deactivate / Reactivate**:
  - doors: `POST ServingListWeb/Lists/{id}/Deactivate` and `.../Reactivate` `{ note? }`;
  - **Warn before deactivating.** When the row's `pointingTypes` holds competed types, the confirm names them: "The
    deliveries of QC, QCS will stop being competed; they go to their fallback store." The door does **not** refuse;
    the confirm is ours;
  - after a deactivate, show the answer's `warning`, if any, as a toast;
  - `SVL-00007`: the list is already in that state (stale screen), so refetch.

**Member actions**, on the Members grid (568):

- **Disable / Enable**:
  - door: `PUT ServingListWeb/Lists/{id}/Stores/{storeCode}/Enabled` `{ enabled, note? }`;
  - a disabled member keeps its place and its history, but is not bid;
  - `SVL-00007` already in that state; `SVL-00004` not on the list.
- **Remove**:
  - door: `DELETE ServingListWeb/Lists/{id}/Stores/{storeCode}?note=`;
  - confirm first: the store is no longer bid from the next callout, and a bid already offered stays;
  - `SVL-00004` not on the list.

## Spine reach

api · logic (name form validation, deactivate-warning text from `pointingTypes`, refusal map `SVL-00004..07`) ·
dialogs · i18n EN + AR · test

## Proof (→ `tdd` red-green cycles)

- [ ] name form: blank EN or AR blocked; 101 characters blocked; an unchanged rename is disabled (vitest)
- [ ] deactivate warning: names only the competed pointing types; no warning when there are none (vitest)
- [ ] refusal map: each of `SVL-00001`, `00004`–`00007` gives its message; an unknown code falls back to the server text
      (vitest)
- [ ] drive script, LTR and RTL, against stubs for each write (ok and each refusal): no edit control without Execute;
      the deactivate confirm lists QC; disable → enable → remove on one member
- [ ] `npm run typecheck`, `npm run lint`, `npm test` green

## Boundaries

- Doors: BackOffice 3045, on branch `spec3042`, stubbed until deployed.
- No delete of a list. No door points a type at a list.
- An edit never withdraws an open bid. Say so in the confirm text; do not build anything for it.

## Done when

The Proof boxes are ticked: on the running app (stubbed), an Execute holder creates and renames a list, disables,
re-enables and removes a member, and is warned before deactivating a list that a competed type points at.

## Blocked by

- [568](568-a-serving-list-s-members-show-their-duty-today-filtered-by-city-enabled-and-duty.md)

## Open questions

—
