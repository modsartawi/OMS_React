# HITL log — ticket 296 (IDoc Inspector access spine)

## Q: Which i18n namespace does the feature use — its own `idoc-inspector`, or the area's `reports`?
**Decision taken:** the AREA's existing `reports` namespace, with every key under an `idocInspector.*` block.
**Why:** the wave brief and `core/i18n.ts`'s own comment both say `reports` is deliberately the area's
name, not the feature's, and later slices ADD keys rather than mint a namespace — the ticket's "its own
namespace" reads as "its own keys", which `idocInspector.*` gives. The block is named
`idocInspector.*` because the AFK runner instructs 297-300 to add their keys there.
**Revisit if:** a third Reports screen makes `reports.json` unwieldy, or the feature-structure rule's
namespace==feature line is enforced by a lint gate.

## Q: The `reports` namespace already holds ONE screen's `access.*` block, worded for invoices. How does a second gated screen get its own denial sentence?
**Decision taken:** added an optional `keyPrefix` prop to `core/ui/ScreenGate` (default `'access'`, so
every existing caller is byte-identical), and the inspector passes `idocInspector.access`.
**Why:** the alternatives were worse — rewording invoices' shipped copy to be generic (changes a live
screen's words), or minting a namespace (contradicts the decision above). The gate already takes `ns`
for exactly this reason; the prefix is the same idea one level down.
**Revisit if:** the namespace==feature rule is restored, at which point the prefix has no callers.

## Q: What URL does the screen live at?
**Decision taken:** `/reports/idoc-inspector`.
**Why:** the spec puts it in the Reports area beside `/reports/invoice` and opens no new nav group; the
path mirrors the feature folder, which is the repo's convention.
**Revisit if:** the nav copy settles on a different name than "IDoc inspector".

## Q: Is the store code required, given invoices treats it as optional?
**Decision taken:** REQUIRED — both halves, refused locally.
**Why:** spec 1386 keys the inspector on store + transaction number together and makes a blank either
half the envelope's 400 branch; the prototype shows two fields. On invoices the store merely narrows an
already-unique number.
**Revisit if:** 297 finds the built route accepts a transaction number alone.

## Q: What are the `IDocInspector/Transaction` query parameter names? (Not on the wire in this slice.)
**Decision taken:** `storeCode` / `trxNumber`, per `lookup-key.ts`.
**Why:** the same key space (`RetailTrx`) the retail-invoice rail binds with those exact names; BackOffice
1387 does not name them.
**Revisit if:** 297 drives the built route and it binds different names — one edit, one module.

## Q: The dependency (BackOffice 1387) is open, so `IDocInspector/Access` does not exist. Proceed?
**Decision taken:** built the client anyway, fail-closed, and drove it against stubbed envelopes in
`tools/idoc-inspector-drive.mjs`.
**Why:** the ticket's own Boundaries say it consumes that route, and the wave brief says nothing has
landed. Failing closed means the unbuilt door hides the leaf rather than advertising it — the opposite
of the `Bby/Access` degrade-to-allowed precedent, which applied to a door with nothing behind it.
**Revisit if:** 1387 lands and the route answers a different shape than `{ screenAllowed }`.

## Q: `ScreenGate`'s `keyPrefix` defaults to `'access'`, and the `reports` namespace's top-level `access.*` block was worded for invoices. A third Reports screen that forgets the prop would silently inherit the wrong screen's denial sentence — the exact trap the prop was added to close. Leave it or close it?
**Decision taken:** closed it — moved the invoices copy to `invoice.access.*` and pointed
`RetailInvoicePage` at it with `keyPrefix="invoice.access"`. The `reports` namespace now has **no**
top-level `access.*` block, so a screen that forgets the prop renders a raw key, which every drive's
raw-key check already catches.
**Why:** a loud failure beats a plausible wrong sentence, and the fix costs one prop on a shipped
screen whose drive (79/79) re-proves it.
**Revisit if:** the default is ever wanted as a genuine area-wide fallback.

## Q: `idoc-inspector/api.ts` is `retail-invoice/api.ts` line for line (key + query options + `canOpen*` + `access()`), the third such copy in the repo. Graduate it to `core/`?
**Decision taken:** NOT in this ticket. Copied, and the duplication is named in the file.
**Why:** `feature-structure` does say shared logic graduates up to `core/` rather than crossing
sideways, and a `core/screen-access.ts` factory would make `retry: false` unforgettable by
construction — but it would touch three shipped, gated features (retail-invoice, collection, and the
`core/oms`/`core/nphies` probes that already went up) on a ticket whose scope is one screen's access
spine. Scaling that refactor in is the owner's call, not an AFK run's.
**Revisit if:** a fourth probe lands, or 297-300 need to change the probe shape anyway — that is the
moment to graduate all of them in one deliberate change.

## Q: The wave introduces IDoc vocabulary (IDoc, IDoc batch, parked entry, verdict, source tag) that `CONTEXT.md` does not define, and CLAUDE.md says the glossary is the ubiquitous language.
**Decision taken:** added the five terms to `CONTEXT.md`, transcribed from spec 1386's own glossary
notes — including the ⚠ **IDoc batch vs batch (CHARG)** collision the spec flags, since both words
appear on this one screen.
**Why:** 297-300 build directly on these words; leaving them undefined guarantees drift across four
slices.
**Revisit if:** `/domain-modeling` wants to reword them — the definitions, not the decision to have
them, are what is provisional.
