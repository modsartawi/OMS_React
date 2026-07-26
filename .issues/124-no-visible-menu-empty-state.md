---
status: done
blocked-by: —
---

# 124 — A signed-in user with nothing to open is told so, not shown a blank page

## What to build

The landing state for a user whose visible menu is **empty**: a plain card saying there is nothing here
and who to ask, instead of the hero card followed by white space. General copy — it names no screen, no
role and no rollout, because the same state will greet every future user between "account created" and
"role assigned".

This ships **on its own, ahead of [125](125-oms-behind-the-access-probe.md)**. It has no backend
dependency, and 125 is what makes it common rather than rare — so it must be in place first.

### Why the page is blank today

`HomePage` renders `useVisibleMenu(MENU)` straight into a grid of section cards. With no visible groups
the grid renders zero children and the page is the hero card and nothing else. That is exactly what a
newly-created employee sees: `UaAdminService.UpsertEmployeeAsync` writes `UaEmployee` only, the `UaUser`
authorization shell is minted by **first role assignment** in Authz Admin, and until then the server's
snapshot loader answers every probe with an empty list — silently, never an error. The person is
correctly signed in, correctly activated, and correctly entitled to nothing.

### The settled flag — the part that is not cosmetic

`useVisibleMenu` hides a gated item while its probe is **pending** (fail-closed, no flash-then-hide).
Today that is invisible because the OMS group is ungated, so the menu is never empty on first paint. The
moment 125 gates it, **every** group is gated and the menu is empty on first paint for *everyone* — so
a naive `items.length === 0` empty state would flash on every page load before the probes resolve.

So `useVisibleMenu` grows a settled signal: return `{ items, settled }`, where `settled` is true once
every probe has resolved or errored (`!isPending` on each result). Only two call sites —
`AppShell.tsx:173` and `HomePage.tsx` — so change the return type rather than adding a parallel hook that
can drift out of step with the filter it describes.

- `settled === false` → render **nothing** where the cards go. Not a spinner: the hero card is already
  on screen and the probes are one cached round-trip.
- `settled === true && items.length === 0` → the empty-state card.

### The copy

New `noAccess` family in the `home` namespace (`src/locales/en/home.json`):

```
noAccess.title  = "Nothing to show here yet"
noAccess.body   = "Your account is active and you are signed in, but no screens have been assigned to it yet."
noAccess.hint   = "If you expect to see something here, please contact IT support."
```

Three separate keys, not one paragraph: the middle line is the *diagnosis* (you are not locked out —
you are unassigned) and the last is the *action*. They earn different weights, and a future locale
should be able to reword one without the other.

Deliberately absent: any mention of activation, TOTP, roles by name, or "your administrator" (which
reads as a person the user cannot find). "Contact IT support" is what a store user can actually do.

## Spine reach

hook (`useVisibleMenu` return shape) · component (`HomePage` empty state) · i18n · test (pure + drive)

## Proof (→ `tdd` red-green cycles)

- [x] `useVisibleMenu` reports `settled: false` while any probe is pending and `true` once all have
      resolved **or errored** — an errored probe must not hang the flag forever · **pure (vitest)**
- [x] `settled` is `true` immediately when the menu has no gated items at all · **pure (vitest)**
- [x] With every group hidden, the home page shows the `noAccess` card — title, body and hint ·
      **flow (Playwright, new `tools/no-access-drive.mjs`)**
- [x] The card does **not** flash on a normal load: with a slow probe resolving to visible, the
      `noAccess` card is never rendered at any point · **flow (same drive)** — the assertion that makes
      the settled flag worth having
- [x] An entitled user's home page is unchanged — same section cards, same order · **flow (same drive)**

**Green:** `node tools/no-access-drive.mjs` **18/18** on port **5207** (5206 is 125's, and the two
run in the same wave); `npm test` **261/261** (14 files, of which 10 are the new
`src/layout/useVisibleMenu.test.ts`); typecheck, build and all three `npm run lint` gates clean.

The pure seam is `resolveMenu(menu, results)` — the hook now only feeds it `useQueries`' results, so
every rule about what is visible and when the answer is trustworthy is provable with no renderer
(RTL is still not installed).

**What the build found:** the empty menu is unreachable on main — the OMS group is ungated until 125,
so no combination of probe answers empties it. The drive therefore rewrites the served
`menu-model.ts` module in flight, gating every ungated leaf: 125's world, one ticket early, with no
app code touched. That injection is deleted when 125 lands.

Two review findings applied: the **card grid** is now held back on `settled` too, not only on
`length > 0` — the ticket's "render nothing where the cards go" is about the whole slot, and without
it 125 would make the cards pop in probe by probe; and the drive's flash watcher scans the mutation
records' `addedNodes` as well as querying live, so a card added and removed inside one React batch
would still be caught. Scenario 1 asserts the watcher fires on a card that IS on screen — without
that negative control, "never rendered" would also be the reading of a broken observer.

## Boundaries

`HomePage` and `useVisibleMenu` only. No change to what any probe returns, no change to `MENU`, no new
endpoint, no route guard — a deep link still lands on each screen's own denied backstop, which is
[125](125-oms-behind-the-access-probe.md)'s business for OMS. The sidebar simply renders an empty nav and
is **left alone**: the home page carries the message, and repeating it in a 240px rail would be the same
sentence twice on one screen.

**i18n:** the three keys go in `home.json` in this change — a `t()` call with no backing key renders the
raw key to exactly the confused user this ticket exists for.

## Done when

Driving the app as a user with no grants: the home page shows the `noAccess` card rather than empty
space. Driving as an entitled user: the section cards are unchanged and the card never appears, including
mid-load. `npm run typecheck` and `npm run lint` green.

## Blocked by

—

## Open questions

1. ~~**Does the empty state also want a sign-out affordance?**~~ **Settled: no** — built without one.
   The shell's header already carries sign-out, and the card keeps one action: "contact IT support".
