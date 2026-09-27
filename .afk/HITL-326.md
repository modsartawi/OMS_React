# HITL — ticket 326 (the slip drawer renders the shared attachments panel)

Pre-flight: 325 landed on spec324 (6a09afe) and its HITL was read. 326 has no BackOffice dependency (the 2061/2062/2063
check starts at 327).

## Q: Which slip keys are the panel's "own words" (moved to `attachments`) and which are the caller's?
**Decision taken:** a key moves to `attachments` only when its VALUE names no owner — 30 keys (source web / "Web ·
{{uploadedBy}}", File name, Uploaded at, Download, the no-preview / withdrawn-meanwhile / lost-file sentences,
Withdrawn (n) and its three lines, the Add hint / retry / local refusals / five statuses, and the withdraw dialog's
Withdraw / "Withdraw {{fileName}}" / Reason / Note / Optional / note limit / Withdrawing… / Cancel / "was withdrawn").
Every sentence that says "slip", "day" or "drawer" — plus "Till" and "Required when the reason is Other." — stays in
`collection` and is passed in through a typed words object (`AttachmentsPanelWords`, 20 entries). The ticket names only
the empty sentence and the Add label as caller words; the others are the same kind. A script compared every value of
the old `collection.json` with the new pair of bundles: 454 unchanged in place, 30 moved with identical values, none
changed or lost.
**Why:** moving a "slip" sentence into the shared namespace would put slip words on the order tab, or force a rewording
(a behaviour change to the slip drawer). The spec's rule is "the words a caller passes stay in the caller's namespace".
**Revisit if:** the owner wants the dialog chrome (331 says "Withdraw… and the dialog chrome come from `attachments`")
as shared, generic sentences. Then the slip's title / final / confirm words would have to be reworded, which is the
owner's call, not a lift's.

## Q: "Till" — the slip's source-column heading. Shared or the caller's?
**Decision taken:** the caller's (`sourceColumn`). The slip passes "Till", unchanged.
**Why:** an order's source is a till, a partner key (`KEY:<UserId>`) or the web; "Till" would be wrong there.
**Revisit if:** the owner is happy with "Till" on the order tab too — then it can move to `attachments`.

## Q: Who re-reads ByOwner after an Add or a Withdraw?
**Decision taken:** the caller, through `onChanged` (the ticket: "The slip drawer passes `markSlipDayChanged` through
it", and that already invalidates the day's ByOwner). The panel re-reads by itself only after a `/Content` 404, as
before. The prop's docblock says the caller must re-read ByOwner there.
**Why:** if the panel invalidated too, the slip would invalidate ByOwner twice in a row — a possible second audited read —
and dropping the line from `markSlipDayChanged` would change `slip-freshness.test.ts`'s pinned expectations.
**Revisit if:** 327 prefers the panel to re-read on its own; then `markSlipDayChanged` must drop its ByOwner line (and
its test's first expected entry changes, which is a finding).

## Q: Is Add's gate the caller's or the panel's?
**Decision taken:** the caller's, beside Withdraw's: `addOffered` / `withdrawOffered` booleans. The slip passes
`canSeeSlips(access)` and `canWithdrawSlips(access)` from the one shared probe entry. The panel no longer reads the
probe. The bare-403 take-away stays inside the panel.
**Why:** 327 needs the panel without Add (330 brings it), and it keeps every probe read in the caller, through one rule.
**Revisit if:** never for slips — Add's visibility is unchanged (the four drives pass).

## Q: Test hooks in `core/` still say `slip-*` (`data-testid="slip-list"`, `data-region="slip-preview"`, …).
**Decision taken:** kept byte-identical, with a note in the panel's docblock.
**Why:** the four slip drives select on them and must pass without a single edit.
**Revisit if:** 327's drive wants owner-neutral hooks; a hook-prefix parameter (the slip passing `slip`) would do it
without touching the slip drives.

## Q: The loading shimmer — the grids' `ListShimmer` lives in the feature's `GridStates.tsx`.
**Decision taken:** a private `PanelShimmer` in `AttachmentsPanel.tsx` with the same markup.
**Why:** `core/` may not import a feature, and `core/ui` is outside this wave's scope walls; `bonus-buy-inquiry`,
`idoc-inspector` and `retail-invoice` already keep the same local copy.
**Revisit if:** a hardening ticket graduates one shimmer to `core/ui`.

## Q: The slip reason labels as data.
**Decision taken:** `slipWithdrawReasons(translate)` in `slip-withdraw.ts` maps the five bundle keys to
`{ code, label, noteRequired }` (no `labelArabic`: the slip's one value already holds English · Arabic). The dialog
draws `label`, then `labelArabic` in its own `dir="auto"` span only when present (331's server list).
**Why:** the slip DOM is unchanged (no `labelArabic`, no second span), and 331 plugs its list in without a dialog edit.
**Revisit if:** 331 wants a separator between the two labels.

## Q: The review's seam notes for 327 and 331 — build them now?
**Decision taken:** no; recorded here for those tickets.
- **327's first-selection latch.** The panel reads ByOwner on mount (`useQuery` with no `enabled`), which is exactly the
  slip's behaviour. 327 needs "stays mounted, but no read until first selection": either an `enabled` prop on the panel
  (added in 327, defaulting to on so the slip is unchanged) or mounting the panel only after first selection.
- **331's server reasons.** `withdrawReasons` rides on the ByOwner response, which the panel reads. Rather than a
  second observer in the caller (same key, same freshness, or it risks an extra audited read), 331 can let the panel
  take reasons from its own list read (e.g. `reasons` as a list OR "from the response"), keeping the slip's client list.
- **Dialog chrome for 331.** See the first question: title / final / confirm / required-note are caller words today.
**Why:** each is unexercised by the slip drawer; adding them here is speculative and 327/331 own the design.
**Revisit if:** 327 wants the latch shaped differently — it is a one-prop change either way.

## Review outcome
- `/code-review`: no findings.
- `/standards-review`: no hard violations. Applied: `pick` renamed `noSelection`; the `onChanged` docblock narrowed
  (the panel does re-read after a `/Content` 404); every frozen hook named in the docblock. Not applied: `PanelShimmer`
  graduating to `core/ui` (out of the wave's scope walls), `useState<string>` for the reason code (331's codes are the
  server's, open-ended), the 20-entry words bag (see the first question).
