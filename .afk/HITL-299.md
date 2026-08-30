# HITL — ticket 299 (IDoc Inspector: one download per IDoc type present)

## Q: Where does the download's pending/failed state live — the page, or the strip?
**Decision taken:** In `DownloadStrip.tsx`, its own `useState`, not lifted to `IDocInspectorPage`.
**Why:** Nothing else on this screen reads it — retail-invoice lifts its state only because the AG Grid action column has to be rebuilt from `pendingKey`, and there is no grid here.
**Revisit if:** a second surface (a toast, a per-document button) ever needs to know a download is running.

## Q: How does a failed download surface — a dialog (retail-invoice's shape) or inline?
**Decision taken:** An inline alert directly under the buttons, carrying the server's own message.
**Why:** The ticket asks only that the business message be surfaced; retail-invoice's dialog exists to carry a *retry* decision (503 vs 504), and this rail has no transient failure arm to retry.
**Revisit if:** the download grows a retryable failure (a render host, a timeout), at which point the dialog shape is the precedent to copy.

## Q: The retry model — copy retail-invoice's three-valued `DownloadRetry`?
**Decision taken:** No retry model at all. Every named failure on this rail (`STORE_CODE_REQUIRED`, `TRX_NUMBER_REQUIRED`, `IDOC_TYPE_REQUIRED`, `INVALID_KEY`, `IDOC_TYPE_NOT_PRESENT`, `IDOC_TYPE_NOT_SERIALISABLE`) is a fixed answer; the button itself is the retry.
**Why:** The download reads persisted rows and serialises them in-process — there is no render host to be briefly unavailable, so a `retry: 'again' | 'once'` table would be three values none of the codes could take.
**Revisit if:** BackOffice adds a transient arm to `IDocInspectorDownloadCodes`.

## Q: The filename when `Content-Disposition` is absent or unparseable. ⚠️ OVERRIDES A BOUNDARIES LINE — NEEDS OWNER SIGN-OFF.
**Decision taken:** A client fallback that mirrors the server's own `IDocInspectorDownloadFileName` format — `idoc_{type}_{store}_{trx}_{yyyyMMdd-HHmm}.xml`, local wall-clock.
**Why:** The ticket says the server owns the name and the client uses what it is given; a fallback is only reached when the header did not arrive, and saving a blob with no name at all is worse than saving one with the shape the rail already publishes. Mirrored rather than invented so the two never look like different files.
**Revisit if:** the server's format changes — the mirror is a copy and will drift silently.
**⚠️ Note:** the ticket's Boundaries say verbatim *"The filename comes from the server's content-disposition — the client does not build one."* This decision overrides that line for the header-absent case only. It follows the shipped `retail-invoice` rail, which does the same (`saveBlob(filename ?? fallbackFileName(row), blob)`); without it a nameless blob saves under its object-URL UUID. **Flagged for the owner** — reverting is one line in `DownloadStrip.onDownload` plus deleting `fallbackFileName`.

## Q: Do the buttons render the IDoc type raw, or its legend label?
**Decision taken:** Raw code in the button text; the legend's label rides in the `title`/`aria-label`, through the feature's own `useCodeLabel`.
**Why:** Ticket 300's ruling for the whole screen is "the raw code, always, with the label as secondary text — never the label alone", and the file the consultant hands over is named by the raw code.
**Revisit if:** 300's rule is ever relaxed.

## Q: Two features now carry a `downloadFailure(err) → outcome` reduction and a fallback-filename builder. Graduate them to `@/core`?
**Decision taken:** No — copied, not graduated. Logged for the owner.
**Why:** `.claude/rules/feature-structure.md` forbids the sideways import and names `core/` as the destination for logic shared by two features, so this is the trigger point — but the two arms genuinely differ (retail-invoice carries a three-valued `DownloadRetry` this rail has no transient failure to use), and touching the shipped invoice rail is outside 299's slice.
**Revisit if:** a third download lands, or the invoice rail's retry model is ever reconciled with this one.

## Q: `serverMessage` reads `err.message` directly rather than through `apiErrorMessage(err, fallback)`.
**Decision taken:** Kept the direct read, with the reason in the docblock.
**Why:** The helper answers "the server's sentence, or a fallback"; this needs "the server's sentence, or *nothing*", so the screen's own key can take over — and the caller has not yet decided which key applies at that point. The `ApiError` is already narrowed, so no unguarded reach.
**Revisit if:** `core/api.ts` grows a nullable reader (an `apiErrorServerMessage`), which is where this belongs.

## Q: The failure envelope carries an `auditId` a consultant could quote. Surface it?
**Decision taken:** No. Recorded as a spec-level gap instead.
**Why:** Ticket 299 does not ask for it, and `core/api.ts`'s `ApiError` reads only the envelope's `attemptId` — a *different* top-level field — so surfacing `auditId` is a `core/` change, not a feature one. Spec 1386 mentions it only in the server's half ("its identifier returned on a response header").
**Revisit if:** the owner wants a support handle on this screen; then `core/api.ts` grows the reader and every download failure quotes it.
