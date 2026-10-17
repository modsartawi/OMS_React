---
status: open
spec: BO 2737 (brief C:\Work\DMSCO\BackOffice\.issues\assets\2737-oms-react-rule-engine-brief.md)
blocked-by: 501, 502, 503, 504, 505, 506, 507, 508, 509, 510, 511, 512, 513, 514, 515, 516, 517, 518, 519
---

# 520 — The rule-campaign screens call the real doors on staging

## What to build

Once BackOffice 2758 has written its **contract section into the brief** and the doors are deployed to staging,
re-point every provisional api in `core/rules/` and the campaigns / engine-switch features at the real paths and
shapes. Drop the `PROVISIONAL` marks. Add the Ua **access probes** (author / approver for the group, the
engine-switch and session-cancel permissions) and adapt the stubs to the real envelopes. Then run the
drives live and do an **owner walk**: build one of the five real campaigns, simulate it, ask for approval, activate as an
approver, and flip a pilot store.

## Spine reach

model/api (re-point) · component (probes) · test (live drives)

## Proof (→ `tdd` red-green cycles)

- [ ] every campaigns drive green against staging · flow
- [ ] owner walk recorded in this ticket · manual

## Boundaries

Live: BackOffice 2744, 2745, 2754, 2755, 2758, 2759, 2760 deployed, plus their Ua permission seeds and owner grants.

## Done when

The drives pass against staging and the owner walk is recorded.

## Blocked by

[501](501-a-marketer-sees-the-campaigns-list-by-state-and-opens-a-campaigns-dashboard.md) through
[519](519-support-finds-a-coupon-code-and-reads-a-members-wallet-balance-and-budgets-used.md)

## Triage of the 501–519 reviews and HITLs (2026-10-17)

Every SERIOUS finding and every clear rule breach was fixed on main (`01923a2` for 512's Restore, then the
triage commit). What is left is below: questions for HQ that this re-point settles, rulings only the owner
can give (each slice built the default named here), and refactors for a hardening pass. Details are in
`.afk/REVIEW-5NN.md` and `.afk/HITL-5NN.md`.

### Settle with HQ while re-pointing

- **2759** — a `draftChanged` flag: until it exists a live campaign's Restore always asks (512). A live
  snapshot, so an approver sees what differs instead of the draft's rules (511) and a version can carry more
  than its rules (512). The order PUT overwrites a placement HQ made meanwhile: a row version or a merge,
  and confirm HQ places new campaigns itself (513). Template placeholders: the `{placeholder}` object plus
  `{{key}}` text marks, and whether labels and descriptions become `{en, ar}` (503).
- **2758** — the catalogue's display hints and field defaults (504, 505). Function meanings and recipe
  descriptions sent by HQ as `{en, ar}`: today the en bundle restates them and the tiered recipe repeats its
  numbers (507). The formula check should name what a formula reads, so a value it reads cannot be deleted
  silently (507). A currency on the campaign, to retire `COUNTRY_CURRENCY` (504). Offline reasons as `Says`
  or codes (509). Who owns a campaign's code, since Details says "Set by HQ" (509). Whether start and end
  become moments (509). The near-miss items gap by `filterId` with `of: Says` (514). Points totals on a
  dry run (514). How a bonus-buy store answers a dry run (514).
- **2744** — is `year` a period (510)? Per-key counters read as "highest so far" (510). Is adding or
  deleting a budget on a live campaign live, and is "kept in HQ's history" true (510)? Are points budgets
  counted in currency (510, 519)?
- **2755** — is a coupon's `until` inclusive (515)? Are member ids case-sensitive (515)? HQ answers
  `expired` (515). A pre-import check door, or a dry-run flag on import (516). Paging for big batches (515).
- **2745** — the flip-back warning: the client reads it before the flip
  (`GET StorePromotionEngine/InFlight`), while 2745 puts it on the flip's answer. **Ask 2745 for a
  dry-run read**, or show it after the flip (517). `from` on the flip body (517). Structured store budgets
  (517). Rename `openSessions` to `openCustomerSessions` (517, glossary).
- **2760** — `SessionAccess` against `Roles` (518). Holds and budget events as separate lists (518). Is
  the rollback kept on the session read (518)?
- **Members (519)** — the balance's unit (SAR or PTS). A prefix search for the finder needs a paged door.
- **Static leaves** — a campaign whose id is `priority`, `simulator`, `sessions`, `coupon-finder` or
  `customers` is shadowed by the leaf. Reserve these words on create.

### Owner rulings owed (the default each slice built)

- **501** — The list departs from the prototype: tiles show the count first, "n of m" sits in the status
  bar, and State, Arabic name and Created by are separate columns. "No end date" instead of "Running with
  no end". The nav group sits after Pricing.
- **502** — No live code preview in Create (HQ mints the code). The prototype's copy icon on each list row
  is in no ticket.
- **503** — A draft template's card is disabled, not openable read-only.
- **504** — The summary pills show at all times. The receipt label sits under the sentence.
- **505** — No bottom save bar. The palette leaves out blocks whose feature is off (the prototype greys
  them out). The all / any select, the shortfall select and Delete in the panel were built beyond the
  ticket.
- **506** — A006 only, not A008. The Rx flag is a pill beside the chain (the prototype writes it red
  inside the chain). The never-discount list lives on the filter, not on each discount (spec story 8). The
  panel's Done drops an open "Certain items…" draft. A category-only filter without A006 is not flagged.
- **507** — Not built: the "+ Add an attribute" button, and the previews of each recipe and field. Built
  beyond the ticket: reordering values, the text chip, the Fields search.
- **508** — The checks list is a popover, not the prototype's inline card. The face shows two badges.
- **509** — Start and end are days, with daily hours on their own row. Hours across midnight are refused.
  The code is read-only and there are no Tags. Customers has three options.
- **510** — An unnamed budget is not named for you. Delete asks first. A `year` period is offered.
- **511** — Delete draft is a button, where the prototype puts it in the ⋯ menu. Activate is gated on the
  checks too. A waiting campaign cannot be disabled.
- **512** — Restore is held on waiting and disabled campaigns, and is not gated by role. The "Tills still
  run version N" line also shows on 511's drafts.
- **513** — Up / down never steps a campaign out of its group. The menu label's key lives in
  `campaign-list`.
- **514** — Sale inputs are trimmed to the ticket's (no coupon code, no moment). The run is an explicit
  Run. A CSV is used only when every row is good.
- **515** — No separate batch table. `until` is inclusive. Member ids are kept as typed.
- **516** — No "Replace the unused codes" import mode. Import, Export and Delete unused are header
  buttons, not the Create split menu. Delete unused works on one batch, not the whole campaign. The export
  header uses machine names.
- **517** — The in-flight warning is read before the flip (see 2745). A Reason column was added. The
  Country and Currency columns are not built.
- **518** — No discount / net bar. Events are oldest first and flat (the prototype lists them newest first
  and expandable). Cancel is hidden on returned sessions and asks no reason. A store must be picked first.
- **519** — The finder is an exact lookup, not the prototype's search table. Points show without a unit.
  The screen is named "Customers", while the glossary says "member".
- **All** — The new namespaces are en only by ruling, so an Arabic (RTL) eyeball is owed. The rule-engine
  vocabulary needs a `/domain-modeling` pass for CONTEXT.md.

### Left for a hardening pass (not this ticket)

- Popover menus: `CampaignActionsMenu`, `MyViews` and `UserMenu` should share one core `Menu`.
- The drawers repeat the `<dialog>` side-sheet plumbing; it wants a docked-sheet primitive.
- `useDebounced` still has copies in materials and the sync console.
- The CSV cell writer exists in three places, `pricing/coupons` included, and `separatorOf` in two.
- `VersionRuleCard` forks `RuleCard` and wants a shared read-only piece.
- The finder and Customers repeat the same search-form shell.
- Small duplications: `mapRule` (three copies), the filter / value name rule (two), the settings pages'
  set and cancel wiring (five), the approval note box, the session grids' context.
- `{{key}}` text fill joins a pick's codes with `', '` (503).
- `CampaignStateBadge` and `LookupPicks` read feature namespaces; they want a `rule-common` namespace.
