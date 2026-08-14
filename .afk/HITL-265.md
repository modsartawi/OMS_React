# HITL — ticket 265 (a row downloads its receipt)

## Q: The confirm predicate reads `trxStatus` as well as `trxType`. Which statuses count as "a real receipt"?

**Decision taken:** `needsDownloadConfirm(row)` confirms unless **both** `trxType ∈ {Sales, Return}`
**and** `trxStatus ∈ {Closed, Posted}`. Everything else — including an unknown numeric value in
either field, and a blank one — confirms.

**Why:** the ticket's prose says "anything whose `trxType` is not `Sales` or `Return`", but its own
Proof box requires *"a training status and a suspended status → confirm"*, and both of those arrive
on rows whose `trxType` is an ordinary `Sales`. A type-only predicate cannot close that Proof box.
Contract §3 names the same three things together — cash clearances, **training** receipts,
**suspended** sales — so the status is part of "is this a customer receipt", not a separate question.

**Revisit if:** operators report a confirm on ordinary traffic. The candidates for a false confirm
are `ToBePrinted` (a receipt on its way to a printer) and `Order`; neither was in the contract's
"renderable" set and neither was measured, so they confirm today. A confirm does not block anything
— it costs one click — so the conservative direction was the cheap one. If a real store's rows come
back mostly `ToBePrinted`, add it to `RECEIPT_TRX_STATUSES` (one line, one test).

## Q: `retry` as a boolean or a tri-state?

**Decision taken:** `DownloadRetry = 'none' | 'again' | 'once'`, with `canRetry(outcome, attempts)`
deciding whether the button is drawn.

**Why:** the ticket's Proof asks for "503 and 504 map to different sentences **and different
retry-ability**", and the failure table gives 503 "yes" and 504 "yes, once". A boolean would make
those two identical on the only axis the ticket says must differ. `'once'` is real: after a second
504 the button is withdrawn and the sentence points at the `attemptId` instead, which is the
contract's "if it recurs, it is an incident".

**Revisit if:** the render host's timeout behaviour changes such that a second attempt is genuinely
worth offering.

## Q: Where does the "quote this reference" hint go, given `expectsAttemptId`?

**Decision taken:** the `attemptId` itself renders whenever the envelope carried one; the
*"quote this reference to support"* sentence renders only when `outcome.expectsAttemptId` (422/504).

**Why:** `apiErrorAttemptId` deliberately reports whatever the envelope held on whatever arm it
arrived, so hiding a real id would be the screen overruling the server. But the id is only a row in
the `ReportRenderAttempt` log on the arms where a render was actually attempted — telling someone to
quote an id from a 503 would send them to support with a reference support cannot look up.

## Q: The action column is `pinned: 'right'` — is that a physical direction?

**Decision taken:** pinned, using AG Grid's own `'right'`.

**Why:** measured, not assumed — the drive failed on the first run because AG Grid **virtualises
columns off screen** and the 13-column row scrolled the download action out of existence. AG Grid
mirrors `pinned` under `enableRtl` (`omsGridDirection`), so `'right'` is the END of the row in both
directions. `bonus-buy-inquiry` pins its identity column `'left'` on the same reasoning, and
`logical-tailwind`'s exception clause covers third-party widget internals themed through their own
API.

**Revisit if:** the grid is ever rendered with `enableRtl` false under an RTL document.

## Note — vite port

The runner says port 5199; something was already listening there, so vite chose 5200 and the drive
was run with `DRIVE_PORT=5200`. The server this session started was killed afterwards. Whatever holds
5199 was not started by this session and was not touched.
