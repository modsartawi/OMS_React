---
status: open
spec: BO 2737 (brief C:\Work\DMSCO\BackOffice\.issues\assets\2737-oms-react-rule-engine-brief.md)
blocked-by: 522, 523, 524, 525, 526, 527, 528, 529
---

# 520 — The rule-campaign screens call the real doors on staging

> **Re-scoped 2026-10-17 (owner: "slice it into tickets").** All seven BO doors are `done` and the brief has its
> contract sections. But the real contract is a **whole-draft model**: `Drafts/Save` takes the whole campaign at
> a revision, and Catalogue, Validate and Simulate take the campaign JSON. 501–519 were built on an invented
> per-resource REST shape (`GET/PUT RuleCampaign/Campaigns/{id}/Settings/*`, their own campaign fields and
> status enum). That re-point rewrites the data layer of the whole wave, so it moved into 522–529. This
> ticket keeps only the **live drives + owner walk**. When this was written, the deployed host
> (172.23.27.111:8099) could not be reached from the dev box.

## What to build

Once 522–529 are done and the doors are on staging with their Ua seeds and owner grants: run every
campaigns drive live, then do an **owner walk**: build one of the five real campaigns, simulate it, ask for
approval, activate as an approver, and flip a pilot store.

## The re-point, sliced (2026-10-17)

| Ticket | Contract | Covers | Blocked by |
|---|---|---|---|
| [522](522-the-campaign-model-is-the-real-schema-1-and-a-draft-loads-and-saves-whole-with-its-revision.md) | 2758 | **keystone**: schema-1 model, `Drafts/Load\|Save\|Delete`, settings save whole, author-picked id | — |
| [523](523-the-builder-reads-the-real-catalogue-validate-lookups-value-maps-and-budgets.md) | 2758 | Catalogue, Validate (also offline + formula), Lookups, ValueMaps, Budgets / SetLimit | 522 |
| [524](524-the-list-dashboard-versions-priority-copy-and-templates-call-the-2759-doors.md) | 2759 | approvals, versions, order (saved with a draft), copy, templates, list composition | 522 |
| [525](525-the-simulator-sends-the-evaluate-request-and-reads-the-evaluate-reply.md) | 2758 | Simulate + the evaluate reply | 522 |
| [526](526-coupons-call-the-real-batch-doors.md) | 2755 | `CouponBatches/Create\|List\|Export\|DeleteUnused` | 522 |
| [527](527-support-sessions-call-the-real-2760-doors.md) | 2760 | Sessions / Session / Cancel (reason + requestId) | — |
| [528](528-the-engine-switch-calls-flip-and-history-and-shows-in-flight-after-the-flip.md) | 2745 | Flip / History; in-flight shown after the flip | — |
| [529](529-access-probes-coupon-finder-and-customers-on-the-doors-bo-adds.md) | BO asks | access probes, coupon finder, Customers | 524, 527, 528 + BO asks B, D |

Frontier: **{522, 527, 528}**. Grill two things before building them: 522's ƒx text vs JSON `expr`, and
524's Priority with no order save.

### BO asks (NOT filed in BackOffice yet; the owner decides)

- **A — a campaigns list door.** Every campaign with draft `state`, `campaignStatus`, live version and window.
  Without it, a disabled campaign that has no draft appears nowhere (524).
- **B — access probes.** Cookie-only `Rules/Authoring/Access` (reader / author / approver),
  `Rules/Support/Access` (view / cancel) and `Rules/Switch/Access` (view / flip), answering booleans with
  200, like the repo's other `X/Access` doors (529).
- **C — engine switch reads.** A store list under the `RuleEngineSwitch` grant, and optionally a dry-run
  in-flight read so the warning can show before the flip (528).
- **D — support lookups.** Find a campaign coupon by code, and a member's wallet + per-member budgets used.
  No door exists in 2744/2754/2755 (529). Or retire the two leaves.
- **E — Audience lists.** Countries and channels have no lookup (523).

### Rulings the real contract settles

These are answered by the contract and reach the slices: `year` has no period (510). Labels are `{en,
ar}`, and placeholders are JSON at a path (503). There is no disabled template (503). The author picks the
campaign id, which voids 502's "HQ mints the code". Hours may cross midnight (509). A support cancel takes
a required reason, which voids 518's "asks no reason". The in-flight warning comes on the flip's reply
(517). Holds and budget events come as separate lists (518). The approver gets a live snapshot from
`Approvals/List` (511). Order overwrites are refused by `RULES_ORDER_STALE` (513). There is still **no
`draftChanged` flag** (512 stands).

## Spine reach

test (live drives) · manual (owner walk). The re-point itself lives in 522–529.

## Proof (→ `tdd` red-green cycles)

- [ ] every campaigns drive green against staging · flow
- [ ] owner walk recorded in this ticket · manual

## Boundaries

Live: BackOffice 2744, 2745, 2754, 2755, 2758, 2759, 2760 deployed, plus their Ua permission seeds and owner grants.

## Done when

The drives pass against staging and the owner walk is recorded.

## Blocked by

[522](522-the-campaign-model-is-the-real-schema-1-and-a-draft-loads-and-saves-whole-with-its-revision.md) through
[529](529-access-probes-coupon-finder-and-customers-on-the-doors-bo-adds.md), which are themselves built on
501–519 (all done).

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

## Triage of the 522–528 re-point reviews and HITLs (2026-10-18)

The 8 reviews: `.afk/REVIEW-522…528.md` and `REVIEW-522-full.md` (gitignored, kept in main's `.afk`).
The 7 HITLs: `.afk/HITL-522…528.md`. The full-522 SERIOUS (S1, S2 deleted tests) and S3/S5 were already
resolved in 3f2f50a. After the fixes below: typecheck, lint 4/4, vitest 5625/5625, and the drives
campaigns 638/638, sessions 73/73, simulator 71/71, engine-switch 56/56, priority 50/50 (all stubbed).

### Fixed in the triage commit

- **527 (hard, bidi):** the refusals badge passed a count into `t()` with no isolate. It is now a `<Trans>`
  `<v>` slot with `formatNumber` (`SessionEvents.tsx`). The shared `V` is exported once from
  `session-ui.tsx`. The movement kinds and event reasons are now model constants
  (`RULE_BUDGET_MOVEMENT_KINDS`, `RULE_BUDGET_EVENT_REASONS`). The `SESSION_STATUSES` alias is gone.
- **522:** the Budgets drawer's stale Reload closes the drawer and drops its unsaved budget, as
  `draft.stale` says (it used to only clear the refusal). Create waits for the campaigns list, so an
  early press cannot draft over a live id. The drive's `SAVE_REFUSED` is now HQ's real 400
  unknown-feature wording. The 529-owned PROVISIONAL doors are tagged 529, not 520.
- **523:** the six ƒx fields that had no label now have one (`session.currency/requestedPoints`,
  `profile.loyaltyId`, `item.lineNet/article/quantity`), and so does the `items` function. The orphaned
  keys (`session.country`, `profile.id/firstPurchase`, `item.price/sku`, `function.abs`) are deleted, and
  `sum` no longer mentions `item.price`.
- **524:** the stub's `Versions/Load` always answers the ruleset, with `campaign: null` for a disable
  version. Only an unknown version number is a 404.
- **525:** the CSV check cell renders each reason as its own span instead of `.join(' · ')` over copy.
- **526 (real bug):** `importCsv` now leads with `code,customerId`. Before, a code literally named CODE
  that led the good rows was skipped by HQ as a header. Test `importCsv_leadsWithAHeader_soACodeNamedCodeIsNotEaten`.
  `BatchCodeStatus` is now `RuleCouponStatus`, and the "Showing n of total" counts use `formatNumber`.
- **528:** the drive's success envelope is the full `{ statusCode, success, message, errors, data }`.

### Not changed (stale, or not worth it)

- 522 #3 (trace `conditionId`) and #4 (`catalogue.formula.fields`): gone after 523/525's rewrites.
- 523 #3 (`lookupName` language in BasketCsv): fixed by 525.
- 524 #2 (`CAMPAIGNS` const): gone after 526.
- 527 spec #3 (no `maxLength` on the reason): the reviewer's own call is no fix.
- 523 #1-spec (`fileIssue` path `''`) is still in the stub. It is cosmetic, and nothing reads it.
- No drawer leg was added to drive 78b. The fix is proven by typecheck and reading only.

### Owner rulings owed (new from 522–528; each built the default named)

- **522:** the ƒx text box over the client codec (reverses 507). The author types the campaign id (and
  Create refuses a listed id). The rule-level all/any select is removed. Hours across midnight are allowed.
- **523:** HQ's sentences and palette names replace the bundle's friendlier wording. A new block takes
  HQ's `example` without its sample codes. Offline follows the saved draft, not the unsaved box. The new
  Settings ▸ Value map page. `held` shows only when above 0 (the review asked for always). The simulator's
  channel select shows bare codes.
- **524:** an order change rides a picked `editing` draft (CarrierDialog). The approval acts follow
  state, not role. The Priority names follow different EN/AR display rules on one screen.
- **525:** a typed unit price per line (VAT 0, gross = net). The country select drives currency and is
  not tied to the store. The earns-points / first-purchase boxes. "Every working copy" is removed.
- **526:** the template id is typed. Export is the whole batch as HQ wrote it (no filtered export, no
  BOM). The two limit boxes (reverses 515). "Expired" only from a code's own `validTo`.
- **527:** a retry after a press that may have landed re-sends the same `requestId` (extends "new per
  press"). If kept, the uncertain press should outlive the dialog (review spec #2). The list's money and
  member columns are dropped.
- **528:** in-flight is shown only after the flip. The "was already on" toast.

### BO asks added (unfiled, on top of A–E)

- **F:** the formula guide in `Rules/Authoring/Catalogue`.
- **G:** a material hit's category code as its own field.
- **H:** each store's country in the stores lookup.
- **I:** the campaign's coupon template(s) on a door, and Create refusing another campaign's template.
- On 2760: the budget's limit kind on a movement; the trace, member and totals on a session.
- **C (widened):** a store list under RuleEngineSwitch and a dry-run in-flight read.
- **A (wider):** a disabled campaign with no draft is unreachable (`Drafts/Load` 404s it).

### Hardening, added to the list above

- `isBareDenial ? denied : apiErrorMessage` repeats across features: wants a core `deniedOrMessage`.
- `CarrierDialog`'s nested ternary of refusal codes, beside `approvalRefusal`.
- `CampaignRow`'s 12 props; `held` meaning two things in `VersionsPage`; the dashboard trail keyed by index.
- The two identical coupon col-defs; the `KNOWN_EFFECTS` set and its `as never` cast in `SimResults`.
- The field-`type` switch in four places; the `'currency|%'` unit strings.
- Sessions still say `status` (URL, keys) where the wire says `state`.
