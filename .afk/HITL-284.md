# HITL — ticket 284 (Settlement Account expands into its four screens)

Unattended session, 2026-08-15. Calls a human would normally have weighed in on,
taken conservatively and logged so the next reader can undo one cheaply.

## Q: Do the four third-level leaves carry icons?

**Decision taken:** No. The node keeps its `Scale` icon; its four children are text,
set apart by indentation and a hairline rule.
**Why:** Every leaf in `MENU` carries an icon, but every one of those is a second-level
leaf; four more icons stacked under one would have made the level read as heavy as the
group above it, and there is no design for the third level to copy.
**Revisit if:** the sidebar collapses to icons-only, where a text-only leaf would
disappear.

## Q: Does each of the four children carry its own access probe, or only the node?

**Decision taken:** Only the node. `access: collectionProbe(canOpenSettlement)` stays
where 268 put it; the four children are ungated.
**Why:** One grant opens all four views (spec 282 D2 — "the same settlement grant as
the rest of the screen"), and `filterMenu` already drops a denied node with everything
under it. Copying the probe onto four children would be four chances to key one wrong
for no behavioural difference. Pinned by a test in `useVisibleMenu.test.ts` and one in
`menu-model.test.ts`.
**Revisit if:** a later slice puts a view behind a grant of its own — Bulk upload is
the plausible one, being the write.

## Q: The chevron is an icon-only button and needs an accessible name — which namespace?

**Decision taken:** One new key in `common.json`, `topbar.toggleSection`
("Expand or collapse {{label}}"), beside the existing `topbar.toggleMenu`.
**Why:** The ticket's four new keys are the four menu LABELS, in `settlement`. This
string is the shell's own — the component is generic and a second node would reuse it —
and shell chrome already lives under `topbar.*`. Minting a `settlement` key for a shell
control would have tied the shared component to one feature's namespace.
**Revisit if:** the group header's chevron (which is inside a labelled button today)
ever needs the same treatment — then both should read from one key.

## Q: The three leaf labels the ticket does not word.

**Decision taken:** `Overview` · `Open settlements` · `Ledger` · `Bulk upload`.
**Why:** *Open settlements* is the owner's own wording and is quoted verbatim by both
the spec and the ticket. The other three are the spec's own D3 table wording, minus its
parenthetical glosses.
**Revisit if:** the owner reads "Ledger" as ambiguous against the accounting ledger —
the screen's own title is *Entries across the estate*.

## Q: `aria-current` disagreed with the highlight — fix here, or leave it?

**Decision taken:** Fixed here. `MenuLeaf`'s `NavLink` gets `end={item.exact}`, and the
node's own header row is a plain `Link` rather than a `NavLink` — it points at the same
address as its Overview child, so any `NavLink` there would put `aria-current="page"` on
two elements at once on the Overview.
**Why:** `NavLink` prefix-matches `to` by default, so without it the Overview leaf drew
unhighlighted on `/ledger` while still announcing itself as the current page — the exact
two-leaves bug this ticket exists to remove, one layer down where nobody looking at the
screen would catch it. It is one prop on the component the ticket was already changing,
and it changes nothing for any other leaf (`exact` is undefined everywhere else).
**Revisit if:** a leaf ever wants `activePrefix` to drive `aria-current` too — that
would need the explicit-prop form, not `end`.

## Q: `isActive` went dark on a trailing slash — normalize, or leave it?

**Decision taken:** Normalize. `isActive` strips a trailing slash before matching.
**Why:** `isOverviewPath` (283) already strips it, so `/collection/settlement/` DRAWS
the door — and before this the nav answered that same address by highlighting nothing
and collapsing the sub-menu around it. Two spellings of one screen disagreeing about
where you are is the bug this ticket is about, arriving by a different door.
**Revisit if:** a route is ever added where the trailing slash is meaningful — nothing
in `router.tsx` is today, and react-router treats the two as one route.
**⚠️ Note this is beyond the ticket's "three changes, and no more than three"** — as is
the `end=`/`Link` pair above, and the fifth i18n key. All three are logged here, all
three are the same bug or its prerequisites, and none adds behaviour the spec did not
ask for.

## Q: Which "ordinary two-level group" does the drive compare against?

**Decision taken:** Both the ticket names — Collections' four inquiries AND Reports —
with the Reports probe stubbed granted only for that one check, plus the app's other
`MENU` consumer (`app/HomePage.tsx`).
**Why:** Reports is the ONE-leaf group, a shape the new dispatch could break
differently from a four-leaf one, and the home page renders a group's children flat
without dispatching on `items` at all — it had to be proven the node still draws there
as one card pointing at the Overview rather than four or none.
**Revisit if:** the drive's default nav should simply grant Reports throughout — kept
scenario-scoped so no earlier assertion's nav changes shape underneath it.
