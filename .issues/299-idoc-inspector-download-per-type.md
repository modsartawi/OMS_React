---
status: open
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

- [ ] `oneDownloadButtonAppearsPerIDocTypePresent`
- [ ] `noDownloadButtonAppearsWhenNoDocumentsExist`
- [ ] `anUnbatchedDocumentStillOffersItsDownload`
- [ ] `theReconstructionCaveatIsShownBesideTheButtons`
- [ ] `aFailedDownloadSurfacesItsBusinessMessageNotAGenericError` — a non-2xx carrying the envelope
      with success false is a business outcome, not a crash
- [ ] typecheck + build green

## Boundaries

- Consumes BackOffice `IDocInspector/Download`. Read-only from the client's side; the audit row is
  the server's business.
- The filename comes from the server's content-disposition — the client does not build one.

## Done when

Each IDoc type present yields its own file through the blob helper, the caveat is visible, and a
failed download reads as a business message rather than a crash.

## Blocked by

[297](297-idoc-inspector-lookup-shows-documents.md)

**dep:** BackOffice [1393](file:///C:/Work/DMSCO/BackOffice/.issues/1393-download-returns-one-file-with-one-bom.md)
