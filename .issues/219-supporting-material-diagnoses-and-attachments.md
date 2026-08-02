---
status: done
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

- [x] `morphologyExistsOnlyWhileThePrincipalIsANeoplasm` — it appears with the radio and disappears
      with it, rather than being validated at submit · pure
      (`src/features/nphies/authorizations/diagnosis-form.test.ts`, 6 cases — including that the
      morphology **value** leaves with the field, and that "a neoplasm" is read off the service's
      own `isNeedMorph` for the **exact** code, never off a sibling the search brought back)
- [x] `choosingAPrincipalDeselectsTheOther` — uniqueness is structural, not asserted · pure
      (same file, 7 cases — the demoted row is kept as a `secondary`, and `principal` is asserted
      **absent** from the type dropdown's values)
- [x] `theAttachmentTypeIsDerivedFromTheFile` — no dropdown, and a PDF over the cap is refused at the
      picker · pure (`src/features/nphies/authorizations/attachment-prepare.test.ts`, 7 cases —
      a PNG derives `image/jpeg` too, an image is not size-capped because the downscale is what
      makes it small, and an untypeable file is a refusal rather than a guess)
- [x] `theSameTitleTwiceIsAllowed` — stated as an assertion so it is not "fixed" into a refusal by
      analogy with duplicate items · pure (same file — two `Prescription` rows survive and
      `sequence` is what distinguishes them; the body carries §3.5's four fields and no file name)
- [x] a large image is downscaled, Submit stays disabled until one attachment exists, the lightbox
      shows what will be sent · flow (`tools/nphies-authorization-session-drive.mjs`, scenarios
      24–30, **122/122**) — a real 4000×3000 JPEG made in the page goes 3.0 MB → 679 KB, the
      lightbox's `src` is asserted **identical** to the row's thumbnail and to a `data:image/jpeg`
      URL, the oversized PDF is refused at the picker, and Submit goes disabled → enabled →
      disabled again as the last attachment is removed

**Tier note:** React Testing Library is still not installed (spec 083's ruling), so the two
sub-forms are verified by driving the real app against a stubbed engine — the `setHeader` bodies are
asserted from the captured POSTs, not from a component's props.

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

## What landed

`setHeader` (contract §1.2), the two lookups (§1.1 #14/#15), two pure modules — `diagnosis-form.ts`
and `attachment-prepare.ts` — the browser-only `attachment-file.ts` (FileReader + canvas, no
library), and two components on the existing form. **Ten of the eleven session verbs are now wired;
only `submit` is left, and it is [220](220-a-refused-submit-keeps-the-agent-on-the-form.md)'s.**

Three rulings worth carrying forward:

- **"A neoplasm" is `isNeedMorph` on the diagnosis lookup row**, fetched for the principal's own
  code — the service's own per-code column, not an ICD range spelled into the browser, which would
  disagree with the exchange's table silently and only for the codes nobody tested.
- **Submit's gate is here; Submit's act is 220's.** The button renders disabled while any of this
  slice's three blockers holds and each names itself. It has no handler: §3.5 puts
  `clinicalEditValidate` before the submission, and wiring a partial one would send a request to a
  national exchange without the gate that is supposed to precede it.
- **The attachments are page state, never the projection.** The engine has never heard of them
  (§1.2: "not verbs, deliberately"), so a `State` read must not clear what the agent attached.

Twelve decisions in `.afk/HITL-219.md`, including the two lookups' shapes (read from the service's
`DiagnosisModel` / `MorphModel`, since §1.1 says only "lookup") and the diagnosis type values (read
from `DiagnosisTypes.cs` rather than guessed at a value set the contract does not name for it).
