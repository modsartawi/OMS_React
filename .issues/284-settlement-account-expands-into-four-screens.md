---
status: open
spec: 282
blocked-by: 283
---

# 284 — Settlement Account expands into its four screens, highlighting only the one you're on

## What to build

`Settlement Account` stops being a leaf and becomes an **expandable node** under Collections with
four children — Overview · **Open settlements** · Ledger · Bulk upload — pointing at the paths
[283](283-settlement-views-answer-to-paths.md) created.

Three changes, and no more than three:

1. **The shell renders one more level.** A `MenuSubGroup`, used only when a group's child itself has
   children. Its header is a **link beside a chevron** — the node is both a label and a destination
   (Overview), so clicking it navigates while the chevron expands. Everything else about it matches
   the existing group: auto-expand on an active descendant, manual override until the URL changes.

   🚩 **Bounded to one extra level on purpose, not generically recursive.** There is no visual design
   for a fourth level — the group header is uppercase and muted, the leaf is sentence case, and
   there is no third type. When a fourth level is genuinely wanted, promoting the dispatch is a
   visible diff argued at that time.

2. **`isActive` learns `exact`.** One optional field on the menu model, honoured by the matcher.
   Without it the Overview leaf — whose path is a **prefix** of the other three — renders as active
   on all four screens, so two leaves highlight at once, permanently. Only the Overview leaf sets it.
   The parent's own row is never asked `isActive`; it takes its emphasis from having an active
   child, so the group says *"you are somewhere in here"* rather than competing with the leaf that
   says where.

3. **The 268 ruling is overturned in writing.** That comment says Settlement Account is *"a further
   leaf in this group rather than a group of its own, because neither a new nav group nor a new URL
   prefix appears."* Rewrite it to say what changed: a URL prefix now **does** appear, so the same
   rule that made it a leaf makes it a node. The rule is not being abandoned — it is being applied
   to new facts.

🔑 **The permission machinery needs no change and must not get one.** `collectGated` and `filterMenu`
already recurse, so a nested node whose children all hide is already dropped at any depth. Verified
before this ticket was written; the new test below is what keeps it true.

## Spine reach

component (`AppShell.tsx` — one new component + one dispatch line) · logic (`menu-model.ts` — the
`exact` field, `isActive`, the settlement node) · i18n (four keys) · test (pure)

## Proof (→ `tdd` red-green cycles)

- [ ] `isActive: an exact leaf does not claim its siblings' paths` — Overview is active on
      `/collection/settlement` and **not** on `/open`, `/ledger`, `/upload`; the non-exact leaves
      still match their own prefixes · **pure**
- [ ] `useVisibleMenu: a nested node whose children all hide disappears with them` — no empty
      expander is left behind · **pure**
- [ ] Drive `tools/settlement-drive.mjs`: the node expands, each of the four leaves routes, exactly
      one leaf is highlighted on each screen, and clicking the parent navigates to Overview ·
      **flow (Playwright)**

## Boundaries

Shell change — **blast radius is every nav group in the app**, so the drive must confirm an ordinary
two-level group (Collections' four inquiries, Reports) still renders and highlights unchanged.
Four new keys in the existing `settlement` namespace (`menu.overview`, `menu.open`, `menu.ledger`,
`menu.upload`); the group header stays `collection`'s. *Open settlements* is the owner's own wording
and stays exactly that. No API change.

## Done when

The Collections group shows Settlement Account as an expandable node whose four leaves each route
and highlight correctly, every other nav group is visually unchanged, and `npm test` + `npm run lint`
are green.

## Blocked by

[283](283-settlement-views-answer-to-paths.md) — the leaves must point at paths that exist, or the
nav advertises a 404.
