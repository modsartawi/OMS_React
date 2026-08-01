---
status: open
spec: 209
blocked-by: 217
---

# 219 — Morphology appears with its cause, and a 6 MB photo becomes a 250 KB attachment

## What to build

The request's supporting material: the diagnoses that justify it and the files that evidence it.
Two halves of one slice, merged because each is small and both are "what the agent adds beside the
items".

### Diagnoses

Rows of *type · code · description* against a code lookup, added from a compact row above the table.
Two structural choices, both of which replace a validation with a control:

- **Principal is a radio in the row**, not a fourth value of the type dropdown. Uniqueness becomes
  structural — selecting one deselects the other — so "exactly one, mandatory" is enforced by the
  control rather than by a message box after submit.
- **The morphology field does not exist unless the principal diagnosis is a neoplasm.** It appears
  and disappears with the radio, carrying its own *"required because…"* heading. The old screen let
  the agent submit and then refused; making the requirement **appear with its cause** is the same
  rule stated forward.

Plus the **exception prescription** checkbox — one item group for the whole request. All of its
frightening-looking branches in the source sat inside the direct-dispense path and died with it, so
what is left really is a checkbox and a grouping rule.

### Attachments

**File picker only, no camera** — both audiences already hold the file.

- **Images are canvas-downscaled** to a 2000 px longest edge at JPEG quality 0.85 before base64. A
  6 MB phone photo becomes ~250 KB. This is a deliberate divergence from the old screen, which sends
  the original whole, justified because the payload crosses two hops with no configured limit inside
  a synchronous submit.
- **PDFs pass through untouched** and are refused over 5 MB, with a re-scan message at the picker.
- **The type dropdown dissolves** — the file's MIME derives it. One more control gone.
- **The title is a closed seven-value select**, no free-text escape: a typo reaches a national
  exchange verbatim. **The same title may be used twice** — two prescriptions are two prescriptions,
  and a sequence number already distinguishes the rows. This is the *opposite* of
  [217](217-a-live-engine-session.md)'s duplicate-item refusal, and correctly so: a duplicate line
  really does collide, a duplicate title does not.
- **At least one attachment is mandatory**, and that is a **form state** — a banner while empty and
  Submit disabled — not an exception thrown after everything else is filled in.
- Preview is an **inline lightbox off the same data URL that will be sent**, so the agent previews
  exactly what goes. Removal is per row.

No library: the file reader and canvas are native.

## Spine reach

model/api (diagnosis + morphology lookups; attachments ride on the request body, no endpoint) ·
store/logic (principal uniqueness, morphology visibility, the attachment-prepare module) ·
component/route (both sub-forms on the existing form) · i18n · test

## Proof (→ `tdd` red-green cycles)

- [ ] `morphologyExistsOnlyWhileThePrincipalIsANeoplasm` — it appears with the radio and disappears
      with it, rather than being validated at submit · pure
- [ ] `choosingAPrincipalDeselectsTheOther` — uniqueness is structural, not asserted · pure
- [ ] `theAttachmentTypeIsDerivedFromTheFile` — no dropdown, and a PDF over the cap is refused at the
      picker · pure
- [ ] `theSameTitleTwiceIsAllowed` — stated as an assertion so it is not "fixed" into a refusal by
      analogy with duplicate items · pure
- [ ] a large image is downscaled, Submit stays disabled until one attachment exists, the lightbox
      shows what will be sent · flow (Playwright, extend
      `tools/nphies-authorization-session-drive.mjs`)

## Boundaries

**Server dependency (SIS.Api):** diagnosis and morphology **lookups** only.

**Attachments have no server dependency whatsoever** — no endpoint, no grant, no model, no Nphies
service change. They ride as base64 inside the request body that is already proxied. A real upload
endpoint was priced and dropped: after the downscale there is nothing left for it to buy.

Downscaling in the browser happens to make a hardcoded content type on the server side *true* for
the web's traffic. It does **not** fix the same defect for the old client, and that is reported
separately rather than addressed here.

## Done when

Exactly one diagnosis can be principal, morphology appears and disappears with a neoplasm principal,
exception prescription is settable, a large image is downscaled before it is attached, an oversized
PDF is refused at the picker, and Submit is disabled while there are no attachments — drive green.

## Blocked by

[217](217-a-live-engine-session.md) — both sub-forms live on the request form.
