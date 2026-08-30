---
status: done
spec: C:\Work\DMSCO\BackOffice\.issues\1386-idoc-inspector-spec.md
blocked-by: 297
---

# 299 — theVerdictStripOffersOneDownloadPerIDocTypePresent

## What to build

The consultant can take the XML away.

**Download sits on the verdict strip, one button per IDoc type present** — never per line, never per
document, never a single button. A transaction that produced an aggregated and a financial document
offers two buttons and yields two files; there is no bundle.

🔑 **Through the blob helper, and it could not be anything else.** The enveloped request helper
unwraps a response body that a raw-XML download does not have. The core client already carries a
blob helper for exactly this reason — the retail-invoice download uses it.

⚠ **A plain link cannot do this.** The server's cookie branch requires a CSRF header that an anchor
or a `window.open` cannot send, so the file must be fetched with credentials and handed to the user
as a Blob. This is also why the route being a `GET` is not a contradiction.

**The reconstruction caveat is carried on screen**, beside the buttons: this XML is rebuilt from the
database rows **as they stand now**. It is valid-shaped and partial, and the screen may **never**
present it as *what SAP received* — the underlying rows record when they were created and never when
they were changed. The filename carries the same caveat, and the server owns the filename; the client
uses what it is given rather than composing its own.

**Export state changes what the consultant is told, not what they can take.** All three states —
exported, batched but not exported, not batched — offer the same file. There is no refusal.

## Spine reach

client feature (verdict strip buttons, blob fetch, save) → server

## Proof

- [x] `oneDownloadButtonAppearsPerIDocTypePresent`
- [x] `noDownloadButtonAppearsWhenNoDocumentsExist`
- [x] `anUnbatchedDocumentStillOffersItsDownload`
- [x] `theReconstructionCaveatIsShownBesideTheButtons`
- [x] `aFailedDownloadSurfacesItsBusinessMessageNotAGenericError` — a non-2xx carrying the envelope
      with success false is a business outcome, not a crash
- [x] typecheck + build green

## Boundaries

- Consumes BackOffice `IDocInspector/Download`. Read-only from the client's side; the audit row is
  the server's business.
- The filename comes from the server's content-disposition — the client does not build one.

## Done when

Each IDoc type present yields its own file through the blob helper, the caveat is visible, and a
failed download reads as a business message rather than a crash.

## Landed

Built in `src/features/reports/idoc-inspector/`: two pure modules — `download.ts`
(`idocTypesPresent`, `fallbackFileName`) and `download-outcome.ts` (`downloadFailure`) — a
`DownloadStrip.tsx` that hangs off `VerdictStrip`'s new `actions` slot, `api.ts`'s `download()`
through `api.blob`, and sixteen `idocInspector.download.*` keys in `reports.json`. 23 pure cases
across two new test files; the drive grew 20 checks (**120/120**), invoice drive 79/79, 2099 pure
cases, typecheck + lint + build green.

🔑 **One button per IDoc TYPE, decided in one pure place.** `idocTypesPresent` is the whole rule —
distinct types in arrival order, so two documents of one type are ONE button and a transaction is
never one bundled file. 297 declined to build this helper without a caller; this is the caller.

🚩 **Export state and `isHeld` are not filters.** Exported, batched-not-exported, not-batched and
held all offer the same file — export state changes what the consultant is *told* (the card badge),
not what they can *take*. Driven four ways.

⚠️ **A blank `iDocType` is dropped**, which is the strip's own empty guard: `idocType` is required on
the wire, so a button for one could only ever produce `400 IDOC_TYPE_REQUIRED` — a refusal the screen
would have offered the user itself. Driven with a graph whose documents carry no type, because the
empty-verdict case cannot reach that branch (a documents-verdict with an empty array is 298's
`verdictContradiction`, which suppresses the strip entirely).

🔑 **The failure reads the server, not a table.** `downloadFailure` prefers the envelope's own
sentence over every key here — `IDOC_TYPE_NOT_PRESENT` explains itself better than this repo could
keep in step — and the six codes' own copy is the *fallback* for an envelope that arrived blank.
⚠️ Two arms carry no sentence and must not read as one: a grant refusal is a **bare 403 with no body
at all**, so it gets the screen's "you don't have access" rather than `ApiError`'s generic
unexpected-status string, and a network fault never reached the server to be answered. **There is no
retry model** and its absence is a decision: every named code is a fixed answer about persisted rows
(the download serialises in-process — no render host to be briefly unavailable), so the button is the
retry. That is the one place this deliberately does *not* copy `retail-invoice/download-outcome.ts`.

Failures are keyed **per type**, not one slot: three buttons can sit here and two can fail for
different reasons, and a single slot would erase the first — leaving a button that had failed reading
as one that had succeeded. The strip is keyed on `lookup.dataUpdatedAt`, because pressing Look up on
the same key takes the *refetch* path and nothing unmounts.

⚠️ **The filename decision overrides a Boundaries line and wants owner sign-off.** The ticket says
"the client does not build one"; `Content-Disposition` *is* the authority and is what the drive
asserts, but a `fallbackFileName` mirroring the server's `IDocInspectorDownloadFileName` covers the
header-absent case — following the shipped retail-invoice rail, and because a nameless blob saves
under its object-URL UUID. Reverting is one line plus a deleted function. Its `safe()` uses
`\p{L}\p{N}`, **not** `A-Za-z0-9`, because the rule being mirrored is `char.IsLetterOrDigit` — an
ASCII class would sanitise a non-Latin store code differently from the server, which is the
two-different-looking-files outcome the mirror exists to prevent (caught by `/standards-review`).

⚠️ **Still no live SIS.Api.** BackOffice 1387–1393 have all shipped and the wire was reconciled
against them file by file — `storeCode`/`trxNumber`/`idocType` are the handler's own `[FromQuery]`
names (note the wire is `idocType` while the payload field is `iDocType`), and all six machine codes
exist server-side — but the drive stubs every envelope and **no call here has met a running server**.
The single-BOM guarantee is asserted at the byte level in `Data.Tests`, not here; what a stub shows is
that the client saves the bytes it was handed, untouched.

**Not built, deliberately:** the failure envelope's `auditId` (a support handle a consultant could
quote). 299 does not ask for it and `core/api.ts`'s `ApiError` reads only `attemptId`, a different
top-level field — so it is a `core/` change, logged rather than smuggled in.

Reviews: `/code-review` high caught three, all fixed (a download failure surviving a same-key
re-lookup, a single failure slot erasing a second type's message, and a drive guard that could not
fail). `/standards-review` found **no hard rule violation on either axis**; its two real catches were
the ASCII sanitiser above and the observation that a `downloadFailure` reduction now exists in two
features — the trigger point for graduating it to `core/`, left for the owner since the arms genuinely
differ. 8 decisions in `.afk/HITL-299.md`.

## Blocked by

[297](297-idoc-inspector-lookup-shows-documents.md)

**dep:** BackOffice [1393](file:///C:/Work/DMSCO/BackOffice/.issues/1393-download-returns-one-file-with-one-bom.md)
