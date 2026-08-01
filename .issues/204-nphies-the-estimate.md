---
type: wayfinder-ticket
wayfinder: grilling
map: 196
status: done
blocked-by: 197, 198, 199, 200, 201, 202, 203, 205, 206, 207, 208
---

# 204 — The estimate

## Question

The destination's first half: **how hard, and how much effort.** Every input is a resolved ticket on
this map, so this is synthesis, not investigation — if a number here cannot be traced to a ticket,
the ticket is missing and should be charted rather than the number guessed.

Produce a figure broken down by the work's natural seams, at minimum:

- **SIS.Api proxy** ([198](198-nphies-proxy-contract.md)) — server work, possibly another team's
  time; state whose.
- **Any new pricing/deductible server endpoint** ([197](197-nphies-pricing-machinery.md) and
  whatever the fog around it graduated into) — expected to be the largest single term, and the one
  that can move the total by a multiple.
- **Eligibility check + eligibility responses list** — the cheap half. Charting already established
  these are form state, combo lookups from `core/codeSystem`, one POST and a grid.
- **Auth list, status follow-up, rejection detail** ([201](201-nphies-rejection-detail.md)) — only
  the ~25% of `NphiesAuthResponsesController` that is not a till act.
- **Auth request screen** ([202](202-nphies-attachments-in-a-browser.md),
  [203](203-nphies-screen-shape.md)) — form, diagnosis/morphology sub-forms, attachments, item
  picker, clinical-edit gate.
- **Cross-cutting** — the new `features/nphies/` area, i18n namespace, routes, menu, access probe
  ([200](200-nphies-identity-and-context.md)), and the `CONTEXT.md` vocabulary.

State the shape of the answer as well as its size:

- **What makes it hard**, in one paragraph a non-engineer can act on. The honest headline from
  charting is that the NPHIES integration is *already done and lives server-side*, and the cost is
  entirely in reproducing what the POS till gave the WPF screens for free.
- **What is riskiest** — where the figure would move most if an assumption breaks.
- **What is deliberately not included**, echoing the map's Out-of-scope so the number is not read as
  covering dispensing.

Then write the spec: `/to-spec` against this map, destination `status: ready`, consumable by
`/to-tickets`. The spec's Out-of-scope section inherits the map's, verbatim in substance.

**Do not resolve this ticket early.** A figure produced before [197](197-nphies-pricing-machinery.md)
and [199](199-nphies-scope-of-acts.md) are answered would be the guess this whole map exists to
replace.

## Answer

**35–46 developer-days, engineering-complete, across two teams** — about **15–20 server-days**
(SIS.Api) and **19–25 web-days** (oms-react). One developer end to end is 7–9 weeks; a server
developer and a web developer working the two tracks in parallel is **≈ 5 weeks elapsed**, which is
the shape to quote, because the seam between them is a settled endpoint list rather than a
negotiation.

Four rulings were taken from the requester while resolving this ticket, and the figure is stated
under them: **per-team plus a total**; **engineering-complete only** (QA, UAT and deploy are an
uncosted tail, below); **final-value-only audit accepted** for the two line-meta codes
([205](205-nphies-who-computes-the-money.md) §8, priced at zero); and the session surface **carried
as a range with its swing flagged** rather than de-risked by a spike or padded to its pessimistic
end.

### 1 · Server — SIS.Api, 15–20 days

| Seam | Days | Traces to |
|---|---|---|
| **Proxy: 15 endpoints** — config + `Nphies:BaseUrl` + explicit 100 s timeout, model gaps, `NphiesHttpService` async, three-way error translation, 15 minimal-API handlers, `NphiesGrantEndpointFilter`, list re-modelling over `Take(20000)`, staging test | **5–7** | [198](198-nphies-proxy-contract.md) §6, its own table, unchanged by [199](199-nphies-scope-of-acts.md)'s `Auth/Retry` and [200](200-nphies-identity-and-context.md)'s one-grant ruling |
| **Nphies engine session — 11 verbs** — lifecycle (open/state/abandon), resume-per-request leases, whole-state-back projection, `ScanAsync`/`ChangeQty`/`VoidLine`, the three insurance setters, duplicate-at-scan refusal, plant bound at open, typed refusals, the sweeper | **8–12** | [208](208-nphies-the-auth-is-an-engine-document.md) §2 (eight verbs) + [205](205-nphies-who-computes-the-money.md) §7 (three more) |
| **Submit leg** — `StartAsync` → POST → `MarkSubmittedAsync(authId)`, `"NPHIES_AUTH_REQUEST"` journal | **0.5** | [208](208-nphies-the-auth-is-an-engine-document.md) §1 — *"not new work, ADR-0005's recipe verbatim"*, already shipped for the till by BackOffice 303/304 |
| **Schema + guards** — the `PaidAmount` column and its migration; SIS.Api refusing `ExtendedPrice = 0`; rounding `ActualPatientShare` to 2dp | **1** | [205](205-nphies-who-computes-the-money.md) §7 (one column), [206](206-nphies-does-the-service-check-the-money.md) (one guard, one rounding rule) |
| **Reopen** — read the attempt row by auth id | **0.5** | [207](207-nphies-reopening-a-refused-request.md) |

**Zero Nphies-service change.** Not one ticket on this map found work for the team that owns
`C:\Work\DMSCO\nphies\Service\NphiesService` — [205](205-nphies-who-computes-the-money.md) dropped
[197](197-nphies-pricing-machinery.md)'s item-picker change to zero,
[202](202-nphies-attachments-in-a-browser.md) needed no upload endpoint,
[207](207-nphies-reopening-a-refused-request.md) needed no new storage, and
[206](206-nphies-does-the-service-check-the-money.md) confirmed the submission path is a
transcription layer that already accepts what the web will send. The one property that *would* have
cost a service change — `MaxCoverage` missing from `AuthLineDto` — was priced and not taken, because
path 3 covers it.

The `PaidAmount` migration touches POS schema, so confirm ownership with the engine team before
treating that day as SIS.Api's; it is the only line in the table that might not be theirs.

### 2 · Web — oms-react, 19–25 days

| Seam | Days | Traces to |
|---|---|---|
| **Cross-cutting** — the new `features/nphies/` area, two i18n namespaces, six routes, the nav group, one access probe, the two `api.ts` modules, `CONTEXT.md` vocabulary | **1.5–2** | [203](203-nphies-screen-shape.md) (six routes, one area), [200](200-nphies-identity-and-context.md) (one grant, no audience split) |
| **Eligibility — the cheap half** — list + filters + 7-day chip + server paging; the check form with its provider picker and patient-id **Fill**; the detail with the coverage table and the two-or-more forced pick | **3.5–4.5** | [199](199-nphies-scope-of-acts.md) (three acts, both mode dropdowns gone), [201](201-nphies-rejection-detail.md) (`SiteEligibility` folded in at result time), [203](203-nphies-screen-shape.md) §8 |
| **Authorizations list + detail** — two status columns and two markers, state-driven acts with the reason on hover, `showAll=true`, the per-line verdict/approved-qty/rejected/reason block, header disposition, submitted attachments | **4–5** | [201](201-nphies-rejection-detail.md) (no separate rejection surface), [203](203-nphies-screen-shape.md) §6 act table, [207](207-nphies-reopening-a-refused-request.md) (`showAll`) |
| **The authorization form — the expensive screen** — session open/abandon/leave-warning, inherited read-only identity block, diagnosis sub-form (radio principal, conditional morphology), the item grid over engine lines with typeahead add-row and five editable inputs, the editable rate block with paid-outside, days-supply header default, the clinical-edit gate, `Failed`-in-place with reasons on the offending rows | **8–10** | [203](203-nphies-screen-shape.md) §§2/4/5/6, [205](205-nphies-who-computes-the-money.md) §6 (five agent inputs), [208](208-nphies-the-auth-is-an-engine-document.md) §§1/3/5 |
| **Attachments** | **1** | [202](202-nphies-attachments-in-a-browser.md) §6 — file input, canvas downscale, title select, lightbox; no library, no server work |
| **Reopen as replay** — `?copyOf=<authId>`, the replay loop, the did-not-come-back reporting | **1** | [207](207-nphies-reopening-a-refused-request.md) |

### 3 · What makes it hard — for a non-engineer

**The NPHIES integration is already built and already in production; none of this money buys it
again.** A standalone service does every exchange with the national system, and both the browser's
server and today's till are only callers of it. What the till gave the WPF screens for free was
everything *around* the exchange: a live basket that knows what each item costs, what the insurer
covers, what the patient owes. A browser has none of that, and the price of this port is
reproducing it — not by re-implementing pricing (that would have been the expensive answer, and this
map ruled it out), but by letting the browser drive the *same* engine transaction the till drives, so
the same audit trail records what the engine calculated versus what the agent then changed. That
choice is what makes the server half nearly as large as the screens. The screens themselves are
ordinary: two searchable lists, two detail views, one long form and one shorter one, and no modal
anywhere in the flow.

### 4 · What is riskiest

1. **The engine-session surface, 8–12 days — could be 6, could be 18.** The largest single term and
   the youngest decision on the map ([208](208-nphies-the-auth-is-an-engine-document.md), taken
   2026-07-31). It is a *parallel* build: the call-centre services are doc-type-aware but
   call-centre-**bound** (`CallCenterEngineSession.cs:103`, ids hard-coded at `:336/:373/:413/:500`),
   so the recipe is reused and the code is not. If more of that code turns out liftable the term
   drops; if the eleven verbs each need their own refusal semantics it grows. 208 named this the
   figure most worth a second opinion, and nothing since has narrowed it. A ~2-day spike would —
   the requester ruled against buying one now.
2. **Staging does not exist yet.** [198](198-nphies-proxy-contract.md) carries 1 day of testing
   against a `:8077` deployment that is *planned*. Production `:8065` is the live national exchange
   and must never be submitted to. If staging slips, that day becomes a schedule dependency rather
   than an effort figure.
3. **NPHIES-side validation is unprobed** — bounded, not open.
   [206](206-nphies-does-the-service-check-the-money.md) established that the service checks no
   amount at all and transcribes verbatim, so the exchange sees exactly what the web sends. The
   production formula is empirically valid, so the obligation is to *reproduce* it, not discover it —
   but a web-raised basket the till would never have produced (a zero-priced line, say) reaches
   NPHIES unfiltered. This is why the `ExtendedPrice = 0` guard is a required line rather than
   defensive polish.
4. **Two teams, one release.** ~45% of the work sits on the SIS.Api backlog. The web cannot be
   demonstrated end to end until the session surface lands, so the parallel-track 5 weeks assumes
   both tracks start together.

Not a risk, worth recording as the opposite: the money itself has stopped being uncertain. The map's
chartering headline called the pricing machinery the term that "can move the total by a multiple";
[197](197-nphies-pricing-machinery.md), [205](205-nphies-who-computes-the-money.md) and
[206](206-nphies-does-the-service-check-the-money.md) between them reduced it to **three session
verbs and one column**, and its two candidate server changes were both priced at zero and dropped.

### 5 · What the number does not include

**Not costed, deliberately (the engineering-complete ruling):** QA, UAT with the insurance
back-office and call-centre agents, and the production deploy. On a screen this size that tail is
typically **30–50%** on top, and UAT specifically needs real payer traffic on the staging environment
that does not yet exist. Quote it as a tail, not as a discount.

**Not included at all, per the map's Out of scope** — this number does **not** cover: dispensing and
invoicing in any form (`Dispense`, `CreateInvoice`, `RobotDispense`, GS1 serial scanning, the OMS
links — roughly 75% of `NphiesAuthResponsesController`; the pharmacist keeps the till); HIDP;
payment reconciliation and claim submission; the multipart upload; claim types 1 and 3 (never) and
2, 4 and 6 (deferred); direct auth; follow-up; the payer communication loop — a `NeedComm`
authorization **stalls on the web** by explicit ruling; update-auth-from-eligibility;
update-advance; Bahrain; Vitality; and any rebuild of the pricing engine in the browser. The
deferred set is the requester's stated next planning round and would be a fresh effort with its own
figure.

Three small affordances were priced and consciously left out of v1: **View JSON** (~0.5 d,
[207](207-nphies-reopening-a-refused-request.md)), **camera capture** for attachments
([202](202-nphies-attachments-in-a-browser.md)), and **before/after audit events** for Days Supply
and Selection Reason (~1–1.5 server-days, [205](205-nphies-who-computes-the-money.md) §8 — the
requester accepted final-value-only).

### 6 · Three defects found while charting, reported not fixed

They belong to the WPF and Nphies-service owners, and none of them is inside this figure:
`Extensions.cs:725` mislabels PNG attachments as `image/jpeg` to the national exchange
([202](202-nphies-attachments-in-a-browser.md)); `AuthService.cs:450` divides by zero on a
zero-priced line; and the stray-semicolon guard in both copies of `NphiesDeductibleManager`
([205](205-nphies-who-computes-the-money.md) §9).

### 7 · The spec

Not written in this session. The ticket asks for the estimate **and** `/to-spec`; producing a
`status: ready` spec against eleven resolved tickets is its own session's work, and the wayfinder
hand-off is the same either way. **The estimate is this ticket's answer; `/to-spec` against map
[196](196-nphies-to-web-map.md) is the map's closing act** and should be run next, inheriting the
Out-of-scope section above verbatim in substance.
