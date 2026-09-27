# HITL — ticket 328 (the Prescription card's Files · N · Show row switches to the tab)

Pre-flight: BackOffice 2061, 2062 and 2063 are `status: done` on pricing2. 2077 is `status: open` (expected, not a
blocker). The drive stubs `attachmentCategory` per its Web contract, and the field has not been renamed. 325, 326, 327,
330 and 331 landed on spec324, and their HITL notes were read. 328 adds no endpoint, so there is no contract to
cross-check.

## Q: `CardRow.action`: a bare callback, or an object?
**Decision taken:** an object, `{ label, ariaLabel, onSelect }`, built by `fields.ts` from the page's `onShow`.
**Why:** the ticket needs a button word ("Show") and an `aria-label` via `t()`. `fields.ts` already resolves every row's
words through the `t` it is handed, so the words travel with the callback, and the rail only draws.
**Revisit if:** another row ever needs an action with different words. The shape already allows that.

## Q: Where does the Files row sit, and what does it read?
**Decision taken:** last on the Prescription card, after the Rx document link. It reads `Files  N · Show`: the label,
the number (tabular), an `aria-hidden` middle dot, then the Show button in the card's ink.
**Why:** the spec writes "Files · N · Show". The link row is unchanged, so the new row goes after it.
**Revisit if:** the owner wants the files above the approval number.

## Q: Wording (waits on the owner's read, map 1199)
**Decision taken:** `document:cards.files` = "Files", `document:cards.show` = "Show", and
`document:cards.showFiles` = "Show the order's files in the Attachments tab" (the button's aria-label, so a screen
reader does not hear just "Show").
**Why:** these are the ticket's words, plus the aria-label it requires.
**Revisit if:** the owner reads them differently. Arabic follows the same read.

## Q: Does Show do more than select the tab?
**Decision taken:** it calls the page's own `selectTab('attachments')`, exactly what the tab's click does. On a first
selection that starts the one ByOwner read. It then moves focus to the tab button. There is no scroll code (focus
brings the tab into view on the narrow layout) and no URL change (no deep link, ruled).
**Why:** keyboard and screen-reader users land where the files are.
**Revisit if:** the owner prefers focus to stay on the rail.

## FIX (in 327's code, found by 328's `/code-review`): a cached list reused without an audited read
Two numbers on ONE route (for example `/oms/document/A` then `/oms/document/B`, with the page kept mounted) can name
the same `attachmentOwnerNo`. The page's own ByOwner observer keeps that key alive while the next document loads, so
`gcTime: 0` never dropped A's list. B's first selection showed it with **no read**, which breaks "read once per visit"
and the audit.
**Decision taken:** fixed here, because Show goes through the same `open()`. The latch's first set now calls
`forgetAttachments` (new, in `core/attachments/api.ts` beside `rereadAttachments`: `resetQueries` on exactly that key).
Every observer of the key is still disabled at that moment, so nothing extra is fetched. Every existing read count in
the drive is unchanged. A new drive check failed before the fix (0 reads) and passes after it (1).
`/oms/document` ↔ `/oms/delivery` is not affected: they are separate route components, so the page remounts (checked).
**Why:** the audited read is the heart of the wave, and the fix is three lines in the order feature.
**Revisit if:** the reviewer wants it split into its own commit or ticket. It is named in 328's commit and Comments.

## FINDING (not 328's): `document-actions-drive` still fails 3 checks
These are the same three as HITL-327/330/331 (7358a84). The other six document drives, the four slip drives
(unedited) and the order drive are green.

## Review outcome
- `/code-review`: one finding, the same-owner cached list above. Confirmed with a failing drive check, then fixed.
- `/standards-review`, standards axis: no hard violations. Applied:
  - `forgetAttachments` in core, so the feature does not handle the cache key itself;
  - a plain `count <= 0` guard;
  - one `tabDomId` for the tab's DOM id, with a comment on `globalThis.document`.

  Kept, as judgement calls:
  - "`href` or `action`, never both" is a documented rule plus a test, not a tagged union. A union would complicate
    `textRow`'s `Partial<CardRow>` for one row;
  - the `allowed` flag (the ticket's own shape);
  - the `onSelect` name.
- `/standards-review`, spec axis: nothing missing or wrong. It flagged three deviations, all accepted and recorded
  here:
  - the object `action`;
  - the focus move;
  - the 327 fix (as scope).
