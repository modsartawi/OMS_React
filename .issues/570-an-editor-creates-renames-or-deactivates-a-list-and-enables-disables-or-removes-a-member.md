---
status: done
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

- [x] name form: blank EN or AR blocked; 101 characters blocked; an unchanged rename is disabled (vitest)
- [x] deactivate warning: names only the competed pointing types; no warning when there are none (vitest)
- [x] refusal map: each of `SVL-00001`, `00004`–`00007` gives its message; an unknown code falls back to the server text
      (vitest)
- [x] drive script, LTR and RTL, against stubs for each write (ok and each refusal): no edit control without Execute;
      the deactivate confirm lists QC; disable → enable → remove on one member
- [x] `npm run typecheck`, `npm run lint`, `npm test` green

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

## Comments

### Built (2026-10-25, stubbed)

- Pure, tested: `name-form.ts` (`nameCheck` — trimmed, required, ≤ 100 UTF-16 units, unchanged rename; `nameBody`,
  `noteBody` — blank note left out), `deactivate-warning.ts` (competed pointing types only, `null` when none),
  `write-refusal.ts` (`SVL-00001`, `00004`–`00007` → own words, server text as fallback, bare 403 → not granted,
  `stale` for 00001 / 00004 / 00007 → refetch). Tests: `name-form`, `deactivate-warning`, `write-refusal`,
  `writes-i18n` (every built key, EN + AR).
- UI: `WriteDialog.tsx` (shared shell: note ≤ 500 with counter, refusal banner, `useRefreshList` invalidating
  `SERVING_LISTS_KEY`, `[...SERVING_LIST_MEMBERS_KEY, id]`, `[...SERVING_LIST_CHANGES_KEY, id]`), `NameDialog.tsx`
  (create + rename; Arabic field `dir="rtl"`), `HeaderActions.tsx` (Rename, Deactivate / Reactivate),
  `MemberActions.tsx` (`MemberActionsCell`: Disable / Enable, Remove; dialog portalled to `body`),
  `NewListButton.tsx` on `ServingListsPage`. The Changes key is 571's `SERVING_LIST_CHANGES_KEY` (merged from the
  integration tip); no second key.
- Proof: `npm test` 6342 green; typecheck + lint green; `tools/serving-list-writes-drive.mjs` **102/102 stubbed**,
  LTR + RTL; 568's drive 102/102 (its "no actions column until 570" check flipped), 567's 49/49.
- Decisions (overrulable):
  - every write, member enable included, goes through a dialog with the optional note (no one-click toggle);
  - the actions column is left out entirely without Execute (`MembersTab` passes `actions` only when `canEdit`),
    and widened 160 → 210 to fit two labelled buttons;
  - SVL-00005 / 00006 from the door show in the dialog's banner, not inline under the field (the client check
    blocks them first); "Required" appears only after a field is typed in, "too long" at once;
  - a deactivate's answer `warning` toasts as a warning with the server text as its description;
  - the dialog fixes deactivate vs reactivate at open, so a refetch behind it never flips what Confirm sends;
  - toasts name the list in the reader's language (AR name once Arabic is switched on).
