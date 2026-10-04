# HITL — ticket 402 (AFK, 2026-10-03)

## Q: Where do the now-step words live? The ticket says reuse 396's words "where 396 put them in `common`", but 396 put them in `deliveries`.
**Decision taken:** `document:step.*` (six words). The `deliveries:status.*` words are untouched.
**Why:** The ticket's condition (words in `common`) does not hold, so the spec's i18n section governs: "`document` gains the now-step badge". A feature reading another feature's namespace would couple them the way the import boundary forbids. 403's spine can reuse `document:step.*`.
**Revisit if:** The owner wants one shared home. Then move both sets to `common:timeline.*` in one change, touching `deliveries` columns, StatusCell and the inspector.

## Q: What happens to 083 D-3's pill rail (the line between the band and the command bar)?
**Decision taken:** It is retired. Its All statuses disclosure (thirteen statuses + provenance) moves to the end of the header's line one, as D2 says. `StatusRail.tsx`, and the pure modules only it used (`rail.ts`, `status-severity.ts`, with their tests), are deleted, along with the `document:rail.*` keys.
**Why:** The ticket says the command bar "sits directly beneath the header", and the approved 371 D captures have no pill rail. The now-step badge is what replaces it as "where the delivery is now".
**Revisit if:** The owner wants the per-status pills back. They are in git at 54a191b.

## Q: Where does Refresh go, now that the pill rail that held it is gone?
**Decision taken:** At the very end of the header's line one, after All statuses. Its behaviour is unchanged.
**Why:** Nothing may be lost. The 371 prototype simply had no Refresh, and the rail was Refresh's home because a refresh most visibly changes the state, which is now the header's badge.
**Revisit if:** 405's Esc/back work or the owner wants Refresh in the command bar.

## Q: What is the "document no." sub-id on a delivery, when the big number is already `documentNo`?
**Decision taken:** `refDocumentNo`, labelled "Document", in mono. It is omitted when blank (the e-Rx capture has none).
**Why:** On a delivery header, `documentNo` is the delivery's own number (8000000174) and `refDocumentNo` is the sales document it delivers (1000000303), which is what the list calls Document No. The prototype printed `documentNo` twice, which is a throwaway's shortcut.
**Revisit if:** The owner reads "document no." as something else.

## Q: When does the e-Rx tag show?
**Decision taken:** When the document carries any of the five prescription facts that draw the Prescription (e-Rx) card: approval number, patient ID, clinician, e-Rx reference, prescription URL (`carriesPrescription`). The card's Files row (uploaded attachments, ticket 328) does NOT count: an order whose card shows only Files gets no tag.
**Why:** These are the payload's e-Rx facts; an uploaded file is a photo of a prescription, not an e-Rx. The prototype used `approvalNumber` alone. (Raised by /code-review as a possible card/tag disagreement; kept on purpose.)
**Revisit if:** e-Rx should mean only an `ERX`-category order.

## Q: What colours does the now-step badge take?
**Decision taken:** Created/Ready neutral (muted ink, strong edge, on `--card`); Out `primary-050`/`primary-800`; Delivered `success-050`/`success-800`; Cancellation requested the `--fam-cancel-request` indigo as ink and edge on `--card` (there is no indigo tint token); Cancelled `danger-050`/`danger-800`. The icon takes the word's ink. Every pair is one the contrast gate already measures.
**Why:** It follows the list's Status column tones (396), so the two surfaces agree. Indigo for requested and red for cancelled are the ruled reversal. Amber is only the Due tag (attention), as on the inspector.
**Revisit if:** The owner wants a filled indigo badge (`--primary-foreground` on `--fam-cancel-request`, also measured).

## Q: The header's `aria-label` and key names.
**Decision taken:** The `document:band.*` keys are renamed to `document:header.*`, keeping the "Document identity" label text. `bandSubIds` → `headerSubIds`, `bandCustomer` deleted.
**Why:** The band is gone, so "band" names would mislead. The label text is unchanged, so other drives still find the header.
**Revisit if:** —

## Q: What happens to `tools/document-band-drive.mjs` and `tools/document-rail-drive.mjs`?
**Decision taken:** Both are deleted. Their checks that still hold (sub-ids per capture, the Overall code, All statuses with 13 + provenance, Refresh at the end, Back) move into the new `tools/document-header-drive.mjs`. `document-detail-drive.mjs` and `document-rtl-drive.mjs` are updated where they asserted the band's customer block or the pill rail.
**Why:** They assert a dark slab and a pill rail this ticket removes by design.
**Revisit if:** —

## Q: The page also serves `oms/document/:documentNo` (an order document). Does the now-step badge and due/paid tag show there too?
**Decision taken:** Yes. The header renders the same way on both routes, and the badge reads the order document's own status block (2000000551 reads Ready).
**Why:** It is one page (`DocumentDetailsPage`) and one header. The status columns the derivation reads are on every SD document, so the badge says nothing a disclosure row does not. Hiding it per route would add a branch the spec never asked for. (Raised by the spec review as unruled.)
**Revisit if:** The owner rules that a sales document has no delivery lifecycle. Then pass `openedAs` into `DocumentHeader` and draw the badge on the delivery route only.

## Note: what the reviews raised and was left alone
- The All statuses disclosure isolates every value with `<bdi>` (dir auto), including Ref Document No, which is a machine value. `FieldRow` carries no kind, and a digit-only value under dir=auto resolves LTR. Its em dash for a blank row is carried over from StatusRail.
- `carriesPrescription` repeats the five fields `railCards` reads. They are listed once each with different jobs (labelled rows versus a yes/no), so no shared constant was extracted.
- `document-rtl-drive` "every isolate is an inert inline box" now lists three entries, all one cause: Plex Mono's inline content area (≈1.65em) is taller than the line box (crumb 22 > 19.5, store chip 20 > 16, the header number 30 > 28). Nothing moves on screen. The first two were already the baseline failure recorded at 401.
- `tools/screen1-smoke.mjs` hardcodes port 5199 and could not be run against this worktree's server on 5280.
