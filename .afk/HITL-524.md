# HITL — ticket 524 (list, dashboard, versions, priority, copy and templates on the 2759 doors)

## Q: Priority has no order-save door. How does an edited order reach HQ?
**Decision taken:** Settled default applied. Save opens "Which draft carries the order?" (`priority/CarrierDialog.tsx`). It lists `Drafts/List` drafts in state `editing` only; pending drafts are frozen and sent-back drafts are excluded by the literal default. The pick is loaded whole (`Drafts/Load`), then saved with `Drafts/Save { campaign, features, revision, tree }`. The dialog and the page both say "the order goes live when that draft is activated". After the save, the page keeps showing the order it saved, and later edits build on it, until the reader presses "Show the live order". A draft that already carries a tree of its own is not overwritten unless the reader confirms with "Replace its order". The exception is the draft this page just saved with.
**Why:** BackOffice's ruling that an order-only change rides a campaign draft. The /code-review found that saved edits seemed to vanish and that another draft's order could be replaced silently.
**Revisit if:** HQ adds an order-save door, sent-back drafts should carry the order too, or Drafts/List starts saying which drafts carry a tree (today that is known only after Load).

## Q: The campaigns list with no list door
**Decision taken:** Settled default applied. `ruleCampaignApi.list()` combines `Drafts/List`, `Order` and `Versions/Load { versionNo: Order.versionNo }` (pure `core/rules/campaign-list.ts`):
- A draft whose `publishedVersionNo > 0` and which is not in `Order.campaigns` counts as **Disabled**, because a disable makes the next version without it.
- A live campaign shows its LIVE window. A draft never published shows no window.
- A live campaign with no draft shows no last-saved stamp.

A failed Versions/Load fails the whole list rather than counting live campaigns as running with no window.
**Why:** No list door exists (BO ask A). A list with wrong states is worse than a list that fails openly.
**Revisit if:** BO ask A lands. Only `list()` changes then.

## BO ask A (still open, now wider): a disabled campaign with no draft is unreachable
Disable makes the next version without the campaign. With no draft it is then missing from Drafts/List, Order and the ruleset, **and `Drafts/Load` answers it 404** (`LoadPublished` only reads the newest version). The dashboard keeps what it had loaded, marked Disabled, so the page that just disabled it stays readable. The list drops it, and so does any later visit. Deleting the draft of a disabled campaign has the same effect, and its delete dialog now says so (`bodyDisabled`). The ask to HQ: a list door, plus a way to read a disabled campaign that has no draft.

## Q: No roles door. Which approval acts does the dashboard draw?
**Decision taken:** The acts follow the campaign's STATE:
- editing or sentBack: Ask, Delete
- pending: Activate, Send back
- live with nothing pending: Disable

Every grant is HQ's to refuse. A bare 403 names the missing grant: author 02, approver 06, reader 03. `RULES_SELF_APPROVAL` is said in our words, and the author who asked sees Activate but is refused.
**Why:** The Roles door is removed, the contract gives each door its own grant, and BO ask B (access probes) is ticket 529's.
**Revisit if:** 529 lands the probes. `actionsFor` takes them again then.

## Q: Approval notes
**Decision taken:** Ask, Send back and Disable require a note, and spaces alone do not count (`RULES_REASON_REQUIRED`). The Activate note is optional and goes on the approval trail. The version carries the author's request note, because HQ publishes `RequestNote` with it. Notes are at most 500 characters, as before.
**Why:** The contract, plus `RuleLifecycleService.ActivateAsync`.
**Revisit if:** —

## Q: Refusals of the approval doors
**Decision taken:** `approvalRefusal` maps each refusal code to our own words and an offer. `RULES_NOT_PENDING`, `RULES_NOT_LIVE`, `RULES_DRAFT_STALE` and `RULES_DRAFT_PENDING` offer "Read it again". `RULES_ORDER_STALE`, and `RULES_INVALID_CAMPAIGN` at Activate, offer "Send it back", which opens the Send back dialog. HQ's own message and code are shown under our words.
**Why:** The ticket surfaces the codes, and the contract says "on either refusal it stays pending: send it back".
**Revisit if:** —

## Q: The approver's live snapshot
**Decision taken:** On a pending draft over a live campaign, Pending changes reads `Approvals/List` and shows the draft's rules next to the live ones, both as rule summaries.
**Why:** The ticket says to show it.
**Revisit if:** The owner wants a field-level diff.

## Q: Versions
**Decision taken:**
- With no draft (`source: published`), Restore runs at once at revision 0, as the ticket says. With a draft it still asks first, because 2759 still has no draft-changed flag.
- 512's "disabled" hold is lifted. HQ says "activating one brings it back", so a disabled campaign's draft may restore.
- A `disable` version is listed ("Disabled here") with nothing to view or restore.
- A version is read from `Versions/Load`'s whole campaign. When that campaign is null, the page says "nothing to read" instead of showing current rules.
- The order is not restored, and the intro says so.

**Why:** The contract and the ticket.
**Revisit if:** The owner wants the one-click restore to ask too.

## Q: Copy
**Decision taken:** The ⋯ menu's Copy opens a dialog. The id is offered as `<id>-COPY` (at most 40), and the EN and AR names as the source's; all are editable and both names are required. A listed id is refused; HQ's `RULES_CAMPAIGN_EXISTS` is shown verbatim. The id rules moved to `core/rules/campaign-id.ts`, shared by Create, Copy and the template tab.
**Why:** The author picks the id (settled default). Features may not import each other.
**Revisit if:** The owner prefers HQ's name to be kept as-is (send no `name`).

## Q: Templates — how is a JSON placeholder asked for?
**Decision taken:** By its default's JSON type:
- number → a decimal box
- string → a text box
- bool → a checkbox
- string list → the builder's picker when the path ends in `categories`, `articles` or `stores`, otherwise comma-separated
- anything else → a JSON textarea

Each field names its path. The draft's names are offered from the template campaign, and the id is suggested from the English name. The bounds hints, the name preview and the "draft template" card are gone.
**Why:** The contract settles that values are JSON at a path, labels are {en, ar}, and there is no disabled template. The `{{key}}` fill goes.
**Revisit if:** HQ adds a kind, bounds or a lookup to placeholders.

## Q: Priority group names and points mark
**Decision taken:** A group has EN and AR name boxes; English is required, Arabic is optional. Labels follow the reader's language. A live campaign with no draft gets its points mark from its blocks through the catalogue (`featuresUsedBy`, a copy of HQ's `FeaturesUsedBy`).
**Why:** Tree group names are {en, ar}, and a list row has no features without a draft.
**Revisit if:** HQ puts features on `Order.campaigns`.

## Review findings declined (/code-review, /standards-review)
- Caching the immutable ruleset by `versionNo`, and reading the live side from Versions/Load instead of Approvals/List: efficiency only. The ticket asks for Approvals/List.
- The three near-identical labelled inputs, and the repeated `isBareDenial ? … : apiErrorMessage` pattern: left for the hardening pass (core `Field` and denial helper).
- Grant numbers in locale prose, the code→words tables in CarrierDialog vs approval.ts, and `id` / `code` / `campaign` naming: the naming is HQ's wire. The rest is noted for hardening.
- "carrier draft" and "bare denial" as glossary terms: for a `/domain-modeling` pass.
- The case-insensitive `idTaken` check (stricter than HQ): kept from 522's ruling.
