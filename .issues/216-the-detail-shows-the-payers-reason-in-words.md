---
status: open
spec: 209
blocked-by: 214
---

# 216 — The authorization detail shows the payer's reason per line, in words

## What to build

The authorization detail — and the discovery that there is **no separate rejection view to build**.

The material was assumed expensive and is not. The payer's reason arrives **already decoded into
display text** by the Nphies service, alongside the per-line outcome, approved quantity, rejected
amount, benefit and copay — all of it inside the response this detail already fetches. So the detail
carries, **always and not only on a rejection**:

- **Per line:** verdict · approved quantity · rejected · the reason in words.
- **Header:** the payer's disposition and process note, when they sent them.
- **The attachments as submitted**, which cost nothing — the response already carries them whether
  they are rendered or not, and an agent chasing a rejection can see what the payer was actually
  given without opening the till application.

Because the columns are always populated, this also covers the case the brief forgets: a **partial**
approval, where the header says approved and individual lines were refused.

**The one trap to defuse.** A single field on the response carries *either* a transport error *or*
the decoded adjudication display, depending on which kind of bad news occurred. The rule:
**the Request state picks both the label and the source.**

- `Failed` / `Pending` → render it under a **failure** label — "could not reach the payer".
- `Complete` → **never render it at all.** The payer's words come from the disposition, process note
  and per-line reasons, which are unambiguous.

The ambiguity never reaches the screen because the field is only ever read in one branch. A neutral
"Message" label would re-conflate exactly what the two axes exist to keep apart.

## Spine reach

model/api (auth response by id) · store/logic (the label-and-source rule, per-line projection) ·
component/route (`/nphies/authorizations/:id`) · i18n · test

## Proof (→ `tdd` red-green cycles)

- [ ] `theDualMeaningFieldIsReadInOneBranchOnly` — rendered under a failure label on `Failed` and
      `Pending`, and **absent** on `Complete`, whatever it contains · pure
- [ ] `aPartialApprovalShowsWhichLinesWereRefused` — an approved header with refused lines renders
      both facts · pure
- [ ] the detail renders per-line reasons and submitted attachments · flow (Playwright, extend
      `tools/nphies-authorizations-drive.mjs`)

## Boundaries

**Server dependency (SIS.Api):** authorization **response by id** — one of the three methods that
already exists server-side, so this is the cheapest server ask in the effort.

**No code-system decoding in the browser.** Reasons arrive as display text; if a raw code ever
reaches the UI, that is a server-side mapping gap and not something to paper over with a client
lookup table.

Attachments are rendered from the same base64 the request carried — no upload endpoint, no separate
fetch.

## Done when

The detail shows per-line verdict, approved quantity, rejected and reason for every line, the header
blocks when present, submitted attachments, and never shows the dual-meaning field on a completed
authorization — drive green.

## Blocked by

[214](214-an-authorization-row-states-both-facts.md) — the detail is opened from the list.
