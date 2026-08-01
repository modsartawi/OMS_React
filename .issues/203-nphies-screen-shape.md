---
type: wayfinder-ticket
wayfinder: prototype
map: 196
status: done
blocked-by: 197, 199
---

# 203 — The shape of the screens: four modals become what?

## Question

The WPF module is a **chain of modal dialogs**, and each one instantiates the next as a side effect
of a button. `NphiesEligibilityResponsesController.New()` opens the eligibility dialog; that
dialog's `AuthRequest()` closes itself, sets `EligibilityResponsesController.DialogResult = false`
to close its *parent*, and opens the auth request dialog; that dialog's `CompleteRequest()` closes
itself and hands control to the **POS till screen**, where the operator adds items and presses a
submit button that lives somewhere else entirely. The `Show()` methods are 130-line blocks of
`_view.SomeButton.Visibility = Collapsed` driven by eight booleans (`IsUpdateAuth`, `Vitality`,
`BupaSabic`, `WithRef`, `ViewOnly`, `IsReferenceToDocument`, `DirectAuth`, `IsBahrain`).

That does not translate. This ticket produces a rough, concrete artifact to react to — not a
finished design — answering:

1. **How many routes?** Four controllers do not mean four screens. Plausibly two list screens under
   an `/nphies/*` prefix with detail panes, or one console with tabs. See
   [feature-structure](../.claude/rules/feature-structure.md): a new nav group means a new **area**
   folder `features/nphies/`, and the area/URL-prefix decision is part of this answer.
2. **Where the eligibility→authorization seam goes.** In WPF the eligibility response is *carried*
   into the auth request as an object (`controller.Eligibility = Response`), and much of the auth
   form is prefilled and locked from it. On the web that is either a route transition carrying an
   id, a step in one screen, or a pane. This is the decision that most shapes the build.
3. **How the item picker sits in the flow.** [197](197-nphies-pricing-machinery.md) will have said
   what a priced line costs to obtain; this ticket places the picker — inline grid, separate step,
   or its own pane — and shows what an operator sees while each line is priced.
4. **What replaces the visibility-flag soup.** The eight booleans encode real variants. Some are
   already out of scope; the survivors need a representation that is not eight booleans.
5. **The diagnosis and morphology sub-forms.** Add/remove rows against `core/diagnoses` and
   `core/morphs` typeaheads, with a *principal* diagnosis that is unique and mandatory, and a
   morphology code that is required if-and-only-if the principal is a cancer diagnosis
   (`GeneralValidation`, line 1285). Non-trivial UI in its own right — the prototype should show it.
6. **Where the clinical-edit gate lands.** `auth/ClinicalEditValidate` is called during validation
   and can return `Fatal` (refuse) or `Warning` (a modal Yes/No that continues on Yes). On the web
   that is a confirm dialog in the submit path — cheap, but it must be *in* the shape.

Blocked by [197](197-nphies-pricing-machinery.md) (the picker cannot be placed before its cost is
known) and [199](199-nphies-scope-of-acts.md) (the variant flows may not survive scoping).

Prototype under `.issues/assets/196-nphies/`, linked from the answer.

## Comments

**2026-07-31, from [200](200-nphies-identity-and-context.md) — three controls are now fixed, before
this ticket prototypes anything.**

- The **eligibility form carries a provider picker**: `core/providers`, no default, no memory between
  acts, and submit blocked until one is chosen. It is the only place a provider is ever picked.
- The **auth form shows the provider read-only**, inherited from the eligibility it references. Not a
  combo — a displayed value. This is one of the controls that *leaves* the screen, alongside the two
  mode dropdowns [199](199-nphies-scope-of-acts.md) removed.
- **Both lists carry a provider filter defaulting to all providers** — deliberately the opposite of
  WPF, where a till is pinned to its own store. Note this filter therefore does **not** help with
  [198](198-nphies-proxy-contract.md)'s `Take(20000)`; whatever narrows the list has to be the
  patient / date / status filters, which is this ticket's problem to solve.

Nothing else about identity reaches the UI: channel, staff id and `SourceCode` are all server-stamped
and invisible.

**2026-07-31, from [201](201-nphies-rejection-detail.md) — the lists' status vocabulary is settled,
and one question was handed here deliberately.**

Both lists show **two status columns**: **Request** (`Cancelled` / `Failed` / `Pending` /
`Complete`) and **Verdict** (blank until Complete — auth: `Approved` / `Partly approved` /
`Rejected` / `No approval needed`; eligibility: `Eligible` / `Not in force` / `Not eligible`), plus
two row **markers** — payer query (`NeedComm`) and dispensed (`IsDispensed`). The auth detail always
carries a per-line *Verdict / Approved qty / Rejected / Reason* block and a header
`Disposition` + `ProcessNote` block; there is **no separate rejection surface** to place. Any status
filter this ticket designs to tame `Take(20000)` should filter on those two axes, since they are what
the row displays.

**Handed here as a layout question:** whether the Request state governs which acts a row offers —
Failed ⇒ Retry, Pending ⇒ Status check, Complete-and-undispensed ⇒ Cancel, nothing otherwise — or
every row offers every act and an inapplicable one comes back as a business refusal. 201 recommended
the state-driven form (the row then teaches its own vocabulary); the requester ruled it belongs with
the rest of the affordances, here.

One more control is fixed: the eligibility detail lists **every coverage** (`MemberId`, `InForce`,
network, plan, class, policy holder). With exactly one coverage the auth is raised under it silently;
with two or more the agent **must pick** before submit, with no default.

## Answer

Prototype: [screen-shape-prototype.html](assets/196-nphies/screen-shape-prototype.html) — six
screens plus the two submit gates, self-contained, open it in a browser.

**Four modals become two lists, each with a detail route and a form route — six routes in one new
area, `features/nphies/` behind `/nphies/*`.**

```
/nphies/eligibility          list + filters        /nphies/authorizations
/nphies/eligibility/new      the check form        /nphies/authorizations/new?from=<eligId>
/nphies/eligibility/:id      response detail       /nphies/authorizations/:id
```

Per [feature-structure](../.claude/rules/feature-structure.md) this is a **new area** — a new nav
group and a new URL prefix arrive together — holding two features, `eligibility` and
`authorizations`, with their own i18n namespaces.

### 1 · The seam is a route transition carrying an id

`Raise authorization` on an eligibility navigates to
`/nphies/authorizations/new?from=<eligibilityId>&coverage=<memberId>`; the patient / payer /
provider / policy block is rendered from that eligibility as **displayed values, not disabled
controls** — a disabled combo holding null is the exact WPF trap [200](200-nphies-identity-and-context.md)
removed.

Chosen over a wizard and over a pane for one reason: **the auth is not always raised in the same
sitting as the check.** v1 is `WithReferenceToEligibility`-only ([199](199-nphies-scope-of-acts.md)),
so *every* auth has an eligibility behind it, but that eligibility may be a row picked off the list
days later. A step in a wizard serves only the run-it-now case and then needs a second entry point
anyway; a route with an id in it serves both, is linkable, and survives a refresh. It also means the
`controller.Eligibility = Response` object-carrying that WPF does becomes **a fetch by id**, which is
what makes the two screens independently buildable.

### 2 · The item picker is an inline add-row on the form's grid

A typeahead above the grid; picking an item appends a line, which prices in place and says so while
it waits (`⟳ pricing…` in the money columns). Money comes from the engine's insurance pass
([197](197-nphies-pricing-machinery.md)), never from the browser; submit waits for every line.
The whole form stays one scrolling page — **no modal opens anywhere in the flow**, which is the
thing this port exists to escape.

This is the piece with no WPF counterpart at all: `BuildAuthRequestForSubmit()` read
`POSCommon.CurrentPOSController.ViewModel.Lines`. The grid and its per-line
Net / Deductible / Patient-share / Payer-max columns are new build, not a port.

### 3 · The visibility-flag soup does not need replacing — it is already gone

The eight booleans were dissolved by the two tickets that blocked this one, not by this one:

| Flag | Where it went |
|---|---|
| `IsUpdateAuth`, `DirectAuth`, `BupaSabic`, `IsBahrain`, `Vitality` | out of v1 ([199](199-nphies-scope-of-acts.md)) |
| `WithRef` | superseded by the patient-id **Fill** button on a cold form ([199](199-nphies-scope-of-acts.md)) |
| `ViewOnly` | **a detail route is not a form route** — the flag was WPF's way of reusing one dialog for both |
| `IsReferenceToDocument` | the `?from=` parameter — presence of a reference, not a mode |

What is left is **one checkbox** (`ExceptionPrescription`) and **one conditional block** (morphology,
below). Nothing in v1 needs a variant representation, so none is designed. Recorded explicitly so
nobody builds a state machine for flags that no longer exist.

### 4 · The diagnosis sub-form: principal is a radio, morphology is a block that appears

Rows of *type · code · description* against a `core/diagnoses` typeahead, added from a compact row
above the table. Two structural choices:

- **Principal is a radio in the row**, not a fourth value of the type dropdown. Uniqueness is then
  structural — selecting one deselects the other — instead of being validated after the fact, and
  "exactly one, mandatory" is enforced by the control rather than by a message box.
- **The morphology field does not exist unless the principal is a neoplasm.** It appears and
  disappears with the radio, carrying its own "required because…" heading. WPF instead let the agent
  submit and refused at `GeneralValidation:1285`; making the requirement *appear with its cause* is
  the same rule stated forward.

### 5 · Submit is a gated path, not a button

Two gates, neither of them a toast:

- **Clinical edit** (`Auth/ClinicalEditValidate`, a *submit*-time gate per 199) — a `W` warning is a
  modal listing the restrictions with `Back to the form` / `Submit anyway`; an `F` fatal is the same
  surface with the confirm button removed. One dialog, two shapes.
- **NPHIES validation refusal** — see below.

### 6 · `Failed` is a form state, not only a list state — and the retry mapping was wrong

**This ticket corrects [201](201-nphies-rejection-detail.md) on a point of fact, from the
requester and confirmed in the service source:**

- **`Failed` does not mean a transport blip. It means NPHIES refused the request on validation
  before the payer ever saw it** — a missing principal diagnosis, a diagnosis incompatible with the
  patient's gender. It is *fixable*, and the agent is the one who fixes it. So a failed submit
  **keeps the agent on the form**, with the refusal reasons attached to the rows that caused them
  (the prototype's screen 4B). A `Complete` + `Rejected` is the opposite: the payer's final word,
  and the remedy is a new authorization.
- **Retry belongs to `Pending`, not to `Failed`.** `AuthService.RetryAuth`
  (`AuthService.cs:1155`) re-POSTs the **stored request JSON verbatim** (`authJson.RequestJson`) and
  runs `ProcessPendingAuth` on the answer, refusing only an already-dispensed auth. It means *"ask
  again with the same payload, take the newer answer"* — which is meaningless for a request the
  exchange never accepted. 201's `Failed ⇒ Retry` line is superseded.

**The act table the rows implement** — acts are **state-driven and disabled with their reason on
hover**, so the row teaches its own vocabulary instead of the agent learning it by refusal. The
service stays authoritative: a refusal that arrives anyway renders as a business outcome (198's
three-way taxonomy), never as a crash.

| Request state | Acts offered |
|---|---|
| `Pending` | Status check · **Retry** |
| `Complete`, not dispensed | Cancel |
| `Complete`, dispensed | — (`RetryAuth` refuses a dispensed auth; so does cancellation) |
| `Failed` | **Open the refusal** — see [207](207-nphies-reopening-a-refused-request.md) |
| `Cancelled` | — |

### 7 · Freshness: no browser polling, because the server already polls

The map's **Freshness of status** fog item is answered here rather than graduated, and the evidence
is decisive. The Nphies service runs `PollRequestWorker`, a `BackgroundService` looping **every 15
seconds** over every unblocked provider on channel `20`, pulling `PriorAuthResponse` /
`ClaimResponse` / `CommunicationRequest` (plus 1-minute jobs for providers `1000` and `P001` on
advanced authorization). **A `Pending` authorization therefore becomes `Complete` on its own,
server-side, with no user act at all** — the normal path to a verdict is *waiting*, not pressing
anything.

The requester's ruling: **manual refresh only.** A `Refresh` button with the load time stated
beside it; no `refetchInterval`, no live row. `Auth/StatusCheck` and `Retry` stay as the manual
escalations for a row that has waited too long. This costs the estimate nothing and removes a
polling design from the build.

### 8 · The lists: a visible date window is what tames `Take(20000)`

Default **last 7 days, newest first, server-paged**, with the window rendered as a **removable
chip** rather than applied silently — a silently truncated list reads as "that's everything", which
is exactly the failure mode [198](198-nphies-proxy-contract.md) flagged in the source
(`Take(20000)` with the ordering commented out). Filters: patient id, payer, provider (defaulting to
**all**, per [200](200-nphies-identity-and-context.md)), preauth ref, and the two status axes
[201](201-nphies-rejection-detail.md) settled — Request state and Verdict. Provider is a filter
here and a *required pick* on the eligibility form; those are the only two places it appears.

### What this hands forward

- **[207](207-nphies-reopening-a-refused-request.md)** (new): a `Failed` row's "open the refusal" is
  cheap only if the server can hand the request back. `NAuthJson.RequestJson` proves the request is
  persisted and `GET auth/AuthJson/{id}` (`AuthController.cs:590`) is not among 198's fifteen
  endpoints — so this is a real, unpriced fork, and it feeds the estimate.
- **To [204](204-nphies-the-estimate.md):** six routes, two i18n namespaces, one new area; the item
  grid and the diagnosis sub-form are the two pieces with no WPF counterpart to port; the flag soup,
  the mode dropdowns, and any polling design are **all removed from the build**, not reduced.
- **To `/to-spec`:** the prototype is the layout reference. It is a sketch of arrangement and state,
  not a visual design — component choices, AG Grid usage and the token pass are the spec's job.

## Comments

**2026-07-31, after resolution — the deductible rates belong to the seam, not to the picker.**

Asked whether the deductible is considered when items are added, or comes later. It is **v1, on
this screen** — but it splits across two clocks, and the split adds one block to the auth form:

`NphiesDeductibleManager.UpdateDeductible(coverage, request)` **never touches `request.Items`**. It
reads the coverage and writes header fields only: `DeductibleG1/G1Max` from category `66` (generic),
`G2/G2Max` from `57` (brand), `G3/G3Max` from `TableOfBenefits`, plus the policy period. So **the
rates are known when the coverage is picked, before any item exists**, and they ride in on the
`?from=<eligId>` seam like the rest of the inherited block.

**Amendment to the shape:** the auth form carries a **read-only deductible-rate block** beside the
policy block — G1 generic %, G2 brand %, G3 policy copay %, each with its cap. The prototype shows
the per-line consequence (Deductible / Patient share / Payer max) without showing its cause; a
number whose cause is off-screen is a number an agent cannot defend to a caller. Every field in it
is inherited, so it costs a projection, not an input.

The per-line amounts stay the engine's ([197](197-nphies-pricing-machinery.md)), computed as each
line lands. One consequence handed to [205](205-nphies-who-computes-the-money.md) rather than
decided here: the `Max` fields are **caps across the request** (hence `DeductibleG1/G2/G3Paid`), so
a cap can bind across lines and re-quantifying one item can move the money on another — which makes
"is the pricing call per-line or whole-basket?" a contract question, not a layout one.

**2026-07-31, later — one part of this shape is now provisional, pending
[208](208-nphies-the-auth-is-an-engine-document.md).**

The requester established that the new POS raises an authorization as a real `PosTransaction` under
a seeded `NphiesAuth` doc type, `AllowsSubmission = true` / `IsSimulation = false`, because the agent
may modify the deductible or swap items and the audit trail must show what the engine landed versus
what the agent changed. If the web does the same — 208's question — then **the auth form is not a
stateless form that POSTs once; it is a resumable draft carrying a transaction id**, and its items
are engine lines booked by `ScanAsync`, not rows in local state.

What survives unchanged: the six routes, the seam, the inherited read-only blocks, the diagnosis and
morphology sub-forms, the two submit gates, the act table, the list filters, and the manual-refresh
ruling. What becomes provisional: **the item grid's local-state model** and **what an abandoned
draft is** — an unfinished form would leave an OPEN engine transaction, which is a named problem
(BackOffice 249's "OPEN-claim litter") this platform has already had to solve once.

Notably the platform *agrees* with this ticket's most contested ruling: on a transport failure the
engine leaves the transaction **OPEN with its claim held** and does not mark it submitted
(`NphiesAuthRequestSubmissionEndToEndTests.cs:25-26`) — which is the same instinct as "a failed
submit keeps the agent on the form". 304 also draws the same Failed/Complete line this ticket drew:
*any* returned verdict, including a rejection, is a lodgement; only a thrown POST is not.

**2026-07-31, resolved — [208](208-nphies-the-auth-is-an-engine-document.md) settled it: the auth
screen is a live engine session.** Four amendments to the shape above; everything else stands.

1. **The deductible-rate block is EDITABLE, not read-only.** The amendment two comments up is itself
   amended. The agent may override the header rates (G1/G2/G3 and their caps) — that override is one
   of the two things the audit trail exists to catch — and one edit re-prices the whole basket
   through the engine. Line amounts stay derived; there is no per-line deductible override, and no
   unit-price or discount override at all.
2. **The item grid is engine lines over a session, not local state.** Add / change-qty / void are
   `Nphies/Session/AddItem` · `ChangeQty` · `VoidLine`, each returning whole state. A voided line is
   *kept* in the transaction (that is the point) and simply absent from the payload.
3. **A duplicate item is refused at the scan.** WPF refuses at submit
   (`ValidateDuplicateItems`, `NphiesAuthRequestController.cs:1737-1755` — *"should be exists only
   one time per authorization request, consider change quantity"*); the web moves the rule forward to
   the moment it applies and names the quantity control as the remedy. Same instinct as the
   morphology block. `"No Items selected"` stays a submit-time check — there is nowhere earlier for
   it to live.
4. **Leaving the screen discards the request** — `Abandon` voids the transaction, and there are no
   resumable drafts (BackOffice 249's OPEN-claim litter is a defect the till just retired; the web
   does not reintroduce it). So no "Draft" row appears on the authorizations list, and the form owes
   the agent a warning before navigating away with items on it.

One consequence beyond this ticket's own scope, from 208: **the acting store is the pricing plant**,
bound once at open — so it must be settled before the first item, and `StoreSwitcher` is not
irrelevant to this screen after all. That corrects [200](200-nphies-identity-and-context.md), not
this ticket's layout, but the form has to show which store is pricing the request.

**2026-08-01, from [205](205-nphies-who-computes-the-money.md) — the rate block and the item grid
both gain controls.**

The rate block gains **three paid-outside fields** (generic / brand / non-med). They are not a
projection of the coverage — `NphiesDeductibleManager.UpdateDeductible` never writes them — they are
agent input, and they reduce the cap the engine prices against (`Max − PaidOutside`, with a
`999_999` sentinel when paid-outside has already blown the cap). Leaving them out would silently
over-state the remaining cap for any patient part-way through their copay ceiling.

The item grid gains **three editable cells** on top of quantity and void:

- **Max Coverage** — writes the engine's per-line `MaxPayerShare`; changing one line can re-bucket
  its siblings, because per-group caps share a pool. Show that a `0` will not apply (SIS.Pos
  26.4.64 ignores `MaxPayerShare <= 0`).
- **Days Supply** — validated **1–100 at the cell**. This replaces WPF's submit-time sweep and its
  warning dialog outright: an out-of-range value can no longer exist, so there is nothing to repair.
  Same instinct as this ticket's morphology block.
- **Selection Reason** — a select **disabled on `Generic` lines only**, matching the WPF rule
  exactly. Codes come from the already-proxied `core/codeSystem`.

Everything else on the line is derived and read-only, so the grid is mostly display: the money
columns fill in from the engine as each row lands.

## Comments

**2026-08-01, correction from [207](207-nphies-reopening-a-refused-request.md) — `Failed` has two
sources, not one.**

This ticket ruled that `Failed` means **NPHIES refused the request on validation before the payer
saw it**. That is one of two sources. The Nphies service's *own* guards throw before it ever POSTs —
unknown item (`AuthService.cs:402`), item with no Nphies item category (`:514`), unconfigured
provider (`:576`) or payer (`:581`), prescription ref over 40 characters (`:219`) — and the blanket
catch at `:743` sets `Error = true` exactly as a NPHIES refusal does. The row is indistinguishable
on the list.

This **strengthens** the ruling that `Failed` is a form state the agent fixes in place, not a state
to retry: "item X doesn't exist" and "provider not configured" are more fixable in the form than a
diagnosis/gender incompatibility is.

Two consequences the shape has to carry:

- **The list must send `showAll=true`.** `GetAuthResponses` filters `if (!showAll) → Where(c =>
  !c.Error)` (`AuthService.cs:1377`), so refused rows are invisible by default — and the "open the
  refusal" affordance this ticket surfaced 207 for is worth nothing on a row that never appears.
- **A locally-guarded refusal has no lines.** Lines are built at `:562`, *after* those guards, so
  the stored row is header-only. Prefilling a reopen therefore reads SIS.Api's own write-ahead
  `PosIntegrationAttempt.RequestJson`, not the Nphies service — see 207 for the seam and its cost.
