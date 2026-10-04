# HITL-407 — unattended decisions, ticket 407 (the call center console sits inside the rail shell)

## Q: "Collapsed on this route by default, but never forced" — does /callcenter need its own rail default?
**Decision taken:** No route-level override. The rail reads the one per-user preference (`oms.railExpanded`, default collapsed) on `/callcenter` exactly as on every screen. A user who never touched the toggle gets 56px; a user who pinned it open gets 240px here too. The drive proves both.
**Why:** 363 says the preference is "never forced open on any route", and `rail-preference.ts` says "no route forces the rail". A call-center-only default would be a second preference that the ticket's "never forced" forbids.
**Revisit if:** the operator lead wants the console collapsed even for users who pinned the tree open elsewhere. That would be a per-route default, which 363 ruled out.

## Q: How does the console get the content height without a page scroll?
**Decision taken:** An explicit route flag, `handle: { fill: true }` (`layout/shell-route.ts`, beside the palette's `PaletteRouteHandle`). On a flagged route, AppShell holds itself to `h-screen`, and its `<main>` drops `p-4` and becomes an `overflow-hidden` flex column. The console, its status line and its cards fill that with `h-full flex-1` instead of `h-screen`.
**Why:** It is the same mechanism 375 R4 chose for the palette: an explicit route flag rather than a layout guess. No other screen's padding or scrolling changes. Hard-coding `calc(100vh - 44px)` would couple the console to the top bar's height.
**Revisit if:** a second screen needs the same fill. In that case, consider one shared route-flag reader in core: `fillsContent`, `paletteOptedOut` and `singleKeyScreenOf` are three copies of the same check (/standards-review's judgement call).

## Q: Does the console's own header row (New order · document type · store · operator · refresh · Abandon) stay under the shell's top bar?
**Decision taken:** It stays, unchanged, so there are two 44px bars: the shell's, then the console's.
**Why:** It carries Refresh and Abandon order, which the shell has no place for. 379's approved captures draw the console with this row beside a stand-in rail. The ticket asks only for the shell around the console, and 408/409 own the header rework. Removing any of it is outside 407.
**Revisit if:** at S6 sign-off the operator lead finds two bars too tall at 1280×720. The basket gets about 3 lines there until 409 widens the centre and 408 replaces the chip row. Folding the doc type and operator into the crumb would be a 408/409 call.

## Q: Do the console's refusal cards keep "Back to the portal" and "Sign out" now that the rail is there?
**Decision taken:** Kept. `ConsoleCard`'s comment now says why: the exits are named where the agent is already looking. The drive asserts both, and that the rail is present too.
**Why:** The ticket doesn't ask for their removal, and removing them would change 134 §8's shipped behaviour.
**Revisit if:** the owner calls them redundant beside the rail.

## Q: The console's centre column was a `<main>`, which would nest inside the shell's `<main>`.
**Decision taken:** It became a plain `<div>` (same classes). The new drive asserts there is one `main` landmark.
**Why:** A page has one main landmark, and HTML forbids `main` inside `main`. No `src` code or shipped drive selected the console's `<main>`. The coupon-159 and linked-request drives read `document.querySelector('main')` only to compare scrollWidth with clientWidth, and they now read the shell's main (they still pass, or fail only where they already fail at HEAD).
**Revisit if:** a prototype drive (175/176) needs the centre column by tag. Those prototypes mount `ConsoleShell` outside the shell.

## Comments
- Baseline drive failures, each confirmed by running the drive against HEAD's `src` (my patch set aside, then re-applied):
  - `coupon-159-drive` 99/103: the sign-up mobile carry-over.
  - `callcenter-guidance-drive` 105/107: a blank offerId, Bby/*.
  - `address-editor-drive`: a timeout on `[data-cc-district-search]`.
  - `foundation-drive` 1294/1302: the known topbar/bell 8 from 393.
  None of these is 407's.
- The regression drives rewrite committed screenshots under `.issues/assets/159|176|185|194`. I restored those with `git checkout` and committed none of them.
