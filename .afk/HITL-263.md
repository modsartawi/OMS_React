# HITL — ticket 263 (the Reports group appears only for a granted session)

## Q: Does 263 paste contract §2's `InvoiceCandidate` / `InvoiceSearchResult` / `RetailInvoiceKey`?

**Decision taken:** No. `src/core/models/retail-invoice.ts` lands with only
`RetailInvoiceAccessResult` — the shape 263's probe actually consumes. The three §2
interfaces are pasted verbatim by **264**, the slice that first has a caller for them. The
file's docblock says so explicitly so the next session does not have to re-derive it.

**Why:** 263's Boundaries say "no search box, no grid, no download — resist finishing the
screen", and a wire model with no consumer is the screen finished early. The contract stays
the authority either way; nothing here paraphrases it.

**Revisit if:** 264 finds the paste awkward to land alongside its own diff, or a reviewer
reads "paste §2 verbatim" as a 263 obligation rather than a wave one.

## Q: Port 5199 was already occupied — which port does the drive run on?

**Decision taken:** Ran `tools/invoice-drive.mjs` against **5200** via its existing
`DRIVE_PORT` env override. The drive file still documents 5199 as its port, unchanged.

**Why:** PID 33320 has been listening on 127.0.0.1:5199 since **2026-08-08 06:29** — an
orphaned `vite --port 5199` from the collection wave's AFK run, three days old and not
started by this session. Killing a process this session did not create is not a call to take
unattended; the drive already parameterises its port for exactly this. The vite server this
session started (on 5200) was killed after the run.

**Revisit if:** a human wants that stale server reaped — `taskkill /PID 33320 /F`. Until then
every future drive on this box will keep sliding to the next free port.

## Q: What are the `reports` namespace's key names for the landing state?

**Decision taken:** `invoice.landing.title` / `invoice.landing.hint` ("Nothing to show yet" /
"Enter a transaction number to find the invoice behind it."), rather than `invoice.empty.*`.

**Why:** 264 needs a *different* sentence for a search that matched nothing ("no invoice
carries that number", spec story 5), and that is the one that deserves `empty`. Naming the
pre-search state `landing` leaves it free and keeps the two from being confused — they are
different sentences and the spec is explicit that they must not be collapsed.

**Revisit if:** 264 decides the landing state and the no-results state should read the same,
which would make one key enough.

## Q: Nav icons for the new group and leaf.

**Decision taken:** `FileBarChart` for the **Reports** group, `Receipt` for **Invoices**.
Both already exist in the pinned lucide-react.

**Why:** every other group in `MENU` carries an icon, so an iconless group would be the
exception. A receipt is literally what this screen downloads.

**Revisit if:** the second report screen makes a chart icon read oddly for the group.

## Q: Does the copied `ScreenGate` keep collection's `can` predicate parameter, given this
area has exactly one grant?

**Decision taken:** Kept. The gate takes `can` and the Page passes the shared
`canOpenRetailInvoice`.

**Why:** the ticket asks for the shape to be **copied**, and the shared predicate is what
makes the nav leaf and the screen read one spelling of the grant rather than two. A gate that
hard-coded `screenAllowed` would have to be edited to admit the second report screen — which
the spec says joins this area and this namespace.

**Revisit if:** the second report screen turns out to need its own probe and key, at which
point the gate is per-feature anyway.

## Q: `/code-review` raised two findings in `core/api.ts` — ticket **262**'s shipped code, not 263's. Fix them here?

**Decision taken:** No. Logged here for triage instead. Both are real:

1. `src/core/api.ts:310` — `await res.blob()` is unguarded, so a body-stream failure mid-PDF
   (a dropped connection) escapes `api.blob` as a raw `TypeError` rather than the typed
   `ApiError` the `api-envelope` rule promises. `request<T>` maps every body-read failure
   through `readEnvelope`; `api.blob` does not.
2. `src/core/api.ts:303` — the 2xx guard blacklists only `Content-Type: *json*`, so a
   `200 text/html` (an IIS SPA-fallback shell on a mis-mapped route) or a 204 would still be
   saved as `Invoice-….pdf`. Whitelisting the expected binary type closes the same class of
   silent failure the guard was written for.

**Why:** 262 is a separate, committed, already-reviewed ticket. Editing its seam from 263
would widen this slice's diff into shipped `core/` code the runner told me to stage narrowly
around, and neither finding blocks anything 263 does — 263 never calls `api.blob`.

**Revisit if:** ticket **265** (the row downloads its receipt) is the first real consumer of
`api.blob`, so it is the natural place to take both. Finding 1 in particular will surface as
a `TypeError` the download's error table cannot classify.

## Q: `/standards-review` flagged that `retail invoice`, `transaction number` and `till receipt` are not in `CONTEXT.md`.

**Decision taken:** Not added. Logged for `/domain-modeling`.

**Why:** `CLAUDE.md` names `/domain-modeling` as the skill that maintains `CONTEXT.md`, and
neither spec 261 nor ticket 263 asks for a glossary entry. Minting three domain nouns by hand
inside an area-scaffolding slice is the kind of unasked-for widening the ticket's Boundaries
push back on.

**Revisit if:** 264/265 start spelling the same concept three ways — which is the drift the
reviewer was pointing at. Pinning the canonical term before then is cheap.

## Note (not a decision): the raw-key check needed strengthening

The drive's "namespace is registered" assertion originally looked for `reports:`-prefixed text.
Measured with the registration removed, i18next's missing-key fallback **drops the namespace**
and renders `invoice.title` / `menu.invoices` — so that check would have passed on a screen
showing raw keys. It now matches the key PATH. The mutation was run twice (before and after)
and is recorded in the ticket's Proof.
