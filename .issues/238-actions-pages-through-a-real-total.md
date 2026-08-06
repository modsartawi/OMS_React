---
status: done
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

- [x] the request — 🚩 `LoyId` is present on **every** call including page 2+; the page size asked
      for is 25, not the pager's other caller's 50 · **pure** — `actions-request.test.ts`, 7 cases,
      asserting the **URL that leaves the browser** rather than a params object (the layer that could
      lose the parameter sits between the two)
- [x] the row — an unknown main/sub action code renders as the **raw code**, never an empty cell; no
      member-snapshot field reaches a column · **pure** — `action-columns.test.ts`, 9 cases
- [x] `tools/loy-member-drive.mjs` (extended) — a 312-action member states its real total and pages
      Prev/Next at 25; a 4-action member grows no pager; the tab offers no sort or filter · **flow** —
      scenarios 31–35, plus 33c below · **175/175** green (was 135/135)
- [x] 🚩 **a page number does not outlive the member it was a page of** — the review pass found the
      stranding state reachable from the other side: React Router keeps the same element across a
      `:loyId` change, so `ActionsTab`'s page survived into the next member and page 3 of a
      four-action member is an empty grid with no pager. Fixed with `key={loyId}` on the tab shell
      (`MemberLookupPage.tsx`) · **flow** — scenario 33c, which drives the one navigation that
      reaches it (browser Back between two members whose Actions tab was open) and fails without
      the key

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

## Answer

Built 2026-08-06. `features/loy/member/{action-columns.ts,ActionsTab.tsx}`, `LoyMemberActionRow` +
`LoyMemberActionsPage` in `core/models/loy.ts`, `actionsQuery`/`actionsKey`/`LOY_ACTIONS_PAGE_SIZE`
+ `loyReportsApi.actions` in the feature's `api.ts`, the `tabs.actions.*` block in `loy.json`, and
the third branch in `MemberTabs.tsx` (which retires 236's `tabs.notYet` placeholder — deleted with
its key). No registration point moved; the area, namespace, routes and menu all landed with 233–234.

🚩 **The `LoyId` guard is a throw, not a convention.** The ticket asked that the client send the
LoyId anyway; the build found the sharper version of the same problem: `core/api`'s `buildQuery`
**drops an empty string**, so an accidental `''` would not fail loudly — it would silently become the
bare `LoyMemberActions` call that answers the first 25 actions of the whole estate. `actionsQuery`
therefore throws before the call rather than trusting the caller, and the suite pins that `fetch` is
never reached. Belt, braces, and a third thing.

🚩 **The paging path really is the total-bearing one.** `isCapped` is *omitted* at the `GridPager`
call site, which is 232's compiler-checked way of saying this caller holds a count and not a flag —
so Next is `page < pageCount` and goes inert on the last page by arithmetic. Driven, not asserted
from a prop: 312 walks to *Page 1 of 13*, and a 30-action member's page 2 is the 5-row remainder.

🚩 **An empty page keeps its pager.** Raised by the spec review: the first cut hid the footer
whenever `rows.length === 0`, which is right on a member with no actions and wrong on a page inside a
real total — no rows to read *and* no Previous to leave by is the one stranding state this tab can
produce. The empty sentence is a fact about the page; the way back is not the page's to remove.
`clampToLastPageWhenCurrentPageEmpties` was considered and not used: it is a *post-mutation* rule and
nothing on this read-only screen removes a row.

**Page lives in component state, not in the URL.** Spec 231 §4 puts exactly two things in the address
— the LoyId and the open tab — and gives the reason: a link should land on the right *question*, and
page 3 of an audit trail is not a question anyone sends a colleague. Logged with three other calls in
`.afk/HITL-238.md`.

**The caption appears only once the read answers**, which is a deliberate, logged deviation from spec
§9's "loading, with the volume caption already visible": the capped tabs' caption describes the
*query* and is knowable in advance, while this one **is** the answer. There is no honest total to
state before the server sends one.

Noted, not taken: the loading / error+Retry / empty scaffolding is now its **third** hand-rolled copy
across the three tabs (only the three sentence keys differ) — a `core/ui` tab-state wrapper is the
obvious extraction, but it would rewrite two landed tickets' files and belongs to a hardening pass.
Same posture as 234's backstop-card note.

🚩 Nothing driven against a live SIS.Api — the read is BackOffice
[978](../../../Work/DMSCO/BackOffice/.issues/978-loyweb-the-four-member-reads.md), whose constraint 3
makes the LoyId-less call unrepresentable at the door. Proof is typecheck + lint + build + 1197 pure
cases + the drive against stubbed envelopes built from 223's field inventory. One drive flake seen
twice under CPU contention (233's scenario 9 double-reading the member on a cold load) did not
reproduce on a quiet machine; left alone rather than re-timed on a guess.

## Post-review fix (2026-08-06)

`.afk/REVIEW-238.md` finding 1, confirmed and fixed: `<MemberTabs>` mounted without a `key`, so
`ActionsTab`'s `useState(1)` carried across a member change. The reviewer's stated trigger (the
*Change* button) does **not** reach it — Change drops `?tab=` and the shell lands on Activities,
which remounts the tab — but browser **Back** between two members whose Actions tab was open does,
and that is what scenario 33c drives. Verified both ways: with the key, 175/175; with it removed,
33c reads `page=3` of the four-action member.

Findings 2 and 3 from the same report, both fixed with it:

- **The empty sentence now belongs to the page it is on.** `tabs.actions.emptyPage` (*"No actions on
  this page."*) is chosen above page 1; `tabs.actions.empty` stays the member's own sentence. The old
  string under a caption reading *"312 actions."* contradicted the line directly above it — and
  scenario 33b was *asserting* that contradiction, so the drive assertion is corrected too, plus one
  that pins the member sentence is absent there.
- **The caption is plural-aware.** `caption_one` / `caption_other`, selected by a `count` param while
  `total` still carries the grouped number the sentence prints. A one-action member read
  *"1 actions."* Driven with a trail of one.

Drive now **177/177**.
