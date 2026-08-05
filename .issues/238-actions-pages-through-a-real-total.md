---
status: open
spec: 231
blocked-by: 236, 232
---

# 238 — Actions pages through a real total, and never leaks another member

## What to build

The third tab, and the one that is **different from the other two by contrast**. Activities and Sales
are silently capped windows with no total; Actions has real `OFFSET/FETCH` paging and a true
`recordsCount` — so it states its actual total (*"312 actions."*, no hedging) and pages **25** at a
time through the pager [232](232-the-pager-graduates-to-core.md) graduated to `core`.

**Seven columns:** When (`formatDateTime`) · **Action** · Sub-action · Details · Details 2 · By ·
Branch. *By* is the point of an audit tab — it answers "who did this to my account".

🚩 **`LoyId` is always sent.** A bare `LoyMemberActions` call returns the first 25 actions of the
**whole estate**, newest first, across all members — a silent cross-member data leak, **not an
error**. The door makes it unrepresentable ([BackOffice door issue, constraint 3]); the client sends
it anyway, and a test pins that it does. Belt and braces on a PII surface.

🚩 **The entire member snapshot is dropped from the row** — `Mobile`, `FullName`, `Email`, `Gender`,
`CityName`, `ProfileUpdated`, `InsuranceCompany`, `BlockedReason`, `JoinedDate`. It is the member
already on screen in the header, repeated 25 times per page, and it puts PII in a grid for no reading
benefit. Dropping it also sidesteps a typing trap: this payload's `BlockedReason` is the **joined
description** where the member payload's is the **code** — which is why the model layer names them
apart (`blockedReasonCode` vs `blockedReasonDescription`) and why no shared type spans the two.

**`ActionData2` is shown** — the user's ruling, over the recommendation to drop it. Nothing is hidden
from the agent, even where the field is undocumented and empty on most rows.

**Both description fields are LEFT JOINs** and go null on an unknown code — each **falls back to its
raw code** rather than rendering an empty cell.

🚩 **No sort, no filter.** *Sort what you hold, never what you're paging through.* The Nphies lists
set `sortable: false` for exactly this stated reason — *a sort over the 50 rows of page 3 would
reorder a page, not the result* — and that binds here and only here. The line between this tab and
the other two is principled, not inconsistent: their whole window is already in the browser.

Per the pager's house rule, **a one-page result grows no pager** — which is most members.

## Spine reach

model · **api** (`LoyWeb/Reports/LoyMemberActions` + `LoyId` + paging) · **logic** (paging state,
using the graduated pure arithmetic) · component · i18n · test

## Proof (→ `tdd` red-green cycles)

- [ ] the request — 🚩 `LoyId` is present on **every** call including page 2+; the page size asked
      for is 25, not the pager's other caller's 50 · **pure**
- [ ] the row — an unknown main/sub action code renders as the **raw code**, never an empty cell; no
      member-snapshot field reaches a column · **pure**
- [ ] `tools/loy-member-drive.mjs` (extended) — a 312-action member states its real total and pages
      Prev/Next at 25; a 4-action member grows no pager; the tab offers no sort or filter · **flow**

## Boundaries

- **New API dependency:** `GET LoyWeb/Reports/LoyMemberActions` — BackOffice, not built. Returns a
  paged envelope with a real `recordsCount`; an empty page for a member with no actions is `200` with
  empty records, not a refusal.
- **Depends on [232](232-the-pager-graduates-to-core.md)** — without it, importing the pager from
  `features/admin/ua-admin` **fails `npm run lint`**'s import-boundary gate, the page size is stuck
  at 50, and Next is driven by a capped flag this envelope does not have.
- ⚠ This is the only tab where sort/filter are **deliberately absent**. A reviewer reading it as an
  oversight should read this section instead.

## Done when

Both pure suites green, `npm run lint` green (the boundary gate is load-bearing here), and the drive
shows a real total, 25 a page, no pager on a one-page member, and no sort or filter controls.

🚩 Nothing driven against a live SIS.Api.

## Blocked by

[236](236-activities-fetches-when-opened-and-states-its-ceiling.md) — the tab shell.
[232](232-the-pager-graduates-to-core.md) — the pager cannot be imported from a feature.
