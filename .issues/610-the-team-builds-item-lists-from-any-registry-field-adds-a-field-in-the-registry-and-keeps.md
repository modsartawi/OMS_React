---
status: done
spec: BO 3126 (brief C:\Work\DMSCO\BackOffice\.issues\assets\3126-oms-react-insurance-rules-brief.md)
blocked-by: 607
---

# 610 — The team builds item lists from any registry field, adds a field in the registry, and keeps patient and policy lists

## What to build

**Item lists**: filters on registry fields (any of / none of, codes shown with their descriptions),
included and excluded lists (3 deep), a preview of matched items, the "matches no item" warning. **Fields**: the
registry page — add a field from a source, EN + AR label, type / unit; retire (never delete); visible to the
master-data grant. **Patient lists**, **policy lists** and **class lists**: entries with added-by, reason, optional
expiry, and the change log. A class list is a third tab beside the other two: an entry is a policy class code
(upper case, up to 29 characters, no `|`) and an optional insurer (its SAP customer id, shown with its name; blank =
any insurer), and the list shows which entries are for one insurer and which are for any.

**HQ contract:** the brief's sections for BackOffice 3132, BackOffice 3133, BackOffice 3172 (class lists: `InsuranceRules/ClassLists`, the same doors as patient / policy lists with `payer` on entries). Build against those shapes, stubbed in the drive; a shape the
BackOffice ticket changes is recorded in the brief and reconciled in the live-doors ticket.

Reference look: [Insurance Rules Builder](https://claude.ai/code/artifact/91vLtKjq47zeaDritTwyJS)
(`C:\Work\DMSCO\BackOffice\.scratch\proto\3096-insurance-rules\index.html`).

## Spine reach

components · logic · test

## Proof (→ `tdd` red-green cycles)

- [x] `listCycle_isRefusedBeforeSave` — pure
- [x] drive `tools/insurance-lists-drive.mjs` (stubbed) — GLP-1 list from ECode values; add an ItemInfo field; add a VIP entry
- [x] drive (stubbed) — add a class entry for one insurer and one for any insurer, then expire one

## Boundaries

— Rules: `feature-structure`, `i18n-zero-literal`, `logical-tailwind`, `api-envelope`, `bidi` (patient keys and codes `Ltr`, Arabic text `<bdi>`). Local time only.

## Done when

Gates green; drive passes.

## Blocked by

[607](607-the-insurance-rules-area-lists-guard-rules-by-folder-with-their-flags-and-opens-a-rule-rea.md)

## Open questions

- **Layout follows the insurance team's walk** of the prototype (https://claude.ai/code/artifact/91vLtKjq47zeaDritTwyJS, BackOffice map ticket 3096, still open). Reactions recorded there before this is built amend this ticket.

## Comments

**2026-10-27 — built on `impl/3126-610`.** Proof: `src/features/insurance-rules/lists/list-graph.test.ts`
(listCycle_isRefusedBeforeSave + three deep / a fourth refused / unknown list / id + names), `entry-form.test.ts`,
`fields/field-form.test.ts`, `lists/i18n-keys.test.ts` (en/ar mirror for `insurance-lists` + `insurance-fields`);
drive `tools/insurance-lists-drive.mjs` 140/140 STUBBED (LTR + RTL): GLP-1 pens from ECode values (search, codes
with descriptions, "matches no item", preview count + first page, PUT of the whole draft), a cycle refused with
its path, a VIP entry added / logged / removed, an `ItemInfo.HouseBrand` field added and offered to the list
editor, ATC retired, bare 403s. 607's drive still 86/86. Typecheck, lint and vitest green.

Shared pieces: `src/core/insurance-rules/registry.ts` (RegistryField, FieldValue, KeyedList, entries, log,
`liveFields`) + `registry-api.ts` (`fieldsQuery`, `fieldValuesQuery`, `keyedListsQuery`) — for 608's palette
(patient / policy list pickers) and 617's eligibility facts. `GuardListAttribute` in `model.ts` is now
`anyOf | noneOf` (exactly one). Stubs section `// --- 610 ---`: `insuranceListsStub` + `newListsState()`
(stateful: a saved draft / added field / entry reads back; call it BEFORE `insuranceRulesStub`).

**Guesses for 618 to reconcile** (each marked ⚠️ PROVISIONAL in code):
- `include` / `exclude` read as **list ids** (contract.md + the spec's "3 deep, no cycle"); 607's stub `chronic`
  has `include: ['100234']` (an article), which now reads as an unknown list id — left as 607 cut it.
- `GET InsuranceRules/PatientLists` | `PolicyLists` → `[{ id, name, entries }]` — the brief spells only the
  Entries and Log doors, so how the lists themselves are listed is guessed. No create/rename of a list.
- Log row `{ at, by, action: added|removed|expired, key, reason?, expiresOn? }`.
- `DELETE …/Entries?key=` (key as a query param — `api.del` takes params, no body).
- `Lists/Preview` body `{ list, lists }` (the draft's other lists so includes resolve before the save) →
  `{ count, items: [{ article, name }], matchesNothing }`.
- Field `type` vocabulary `code | text | number | date | bool`; Values `{ code, description }`.
- Patient key: 10 digits starting 1 (National ID) or 2 (Iqama); SubscriberId: no spaces, up to 40.
- Field key never reused, even a retired one's, compared without case.
- Item lists save through `PUT Guards/Draft` (they are versioned with the ruleset); a 409 says "someone saved first".
- No access probe: Lists and Fields are ungated; a bare 403 reads "You do not have access" (master-data grant
  for add / retire said in the toast).

**2026-10-27 — reopened at the merge to main.** Main added class lists (BackOffice 3172: `InsuranceRules/ClassLists`,
entries carry `payer`) to this ticket after it was built. Everything else stands as built above; the class-list tab
and its drive leg are still to build.

**2026-10-28 — class lists built on `impl/3126r-610` (from `spec/3126-reconcile`).** A **Policy classes** tab
(`?tab=classes`) beside Patients and Policies on `InsuranceRules/ClassLists`: an entry is a class code (upper-cased,
≤29, no `|`, refused in words before the POST) and an insurer picked from `GET InsuranceRules/Insurers` (shown
"payer · name", one `Ltr`; blank = "Any insurer"); the list says how many entries are for one insurer and how many for
any; the same class with and without a payer are two entries (`entryIdentity`). Expired entries stay listed, badged.
Proof: `entry-form.test.ts` (class key, payer ≤10, two-entries identity, body upper-case + payer only when picked,
new-list id/name), `api.test.ts` (`api.delWithBody`), `rule-scope.test.ts` (class `inList` sentence + NOT,
`audience.excludeClassLists`), `lists/i18n-keys.test.ts`. Drive `tools/insurance-lists-drive.mjs` **190/190** STUBBED
(LTR + RTL; new leg 4b: GOLD for Bupa + VIP for any, SILVER added for Tawuniya, GOLD added for any insurer expiring
today then read expired a day on, Remove sends `{ key, payer, reason }`, a new class list with a reason). 607's drive
86/86, 608's 104/104. Typecheck, lint, vitest green.

Shared doors brought to the **built 3133 shapes** (PROVISIONAL marks removed): `GET …Lists` → `[{ id, name, entries,
createdBy, createdAt }]`; `POST …Lists { id, name, reason }` (a "New list" dialog on all three tabs); entries `{ key,
addedBy, addedAt, reason, expiresOn, expired, payer }`; `DELETE …/Entries` with a BODY `{ key, payer?, reason }`
(new `api.delWithBody` in core); log `createList | add | change | remove`. Every write goes through the shared reason
dialog (`INSLISTS_BAD_REQUEST` shown under the reason). Expiry is the last day it counts, so **today is now allowed**.

Rule spelling: the guard palette and the coverage/category palette offer "Policy class in list"
`{ check: "request", field: "class", inList }` (`ClassListCondition`), the audience editor `excludeClassLists`, and the
sentence reads both.

**Left for 618:**
- ⚠️ The policy block is still `{ check: "policy", inList }`; the brief's section spells it `{ check: "request",
  field: "policy", inList }`. Not moved here (kept minimal; stubs, templates and the 617 drive use the old spelling).
- `GET InsuranceRules/Insurers` is still 617's guess; `registryApi.insurers` reads it under the same query key as
  617's Insurers page.
- The add form still refuses a key already listed (`keyListed`) — HQ would treat that POST as a `change`
  (replace reason / expiry). No "change" UI; an expired entry is revived only by remove + add.

**2026-10-28 · review fixes (branch impl/3126r-fix, off spec/3126-reconcile).**
- Request-block grammar: every `check: "request"` block is now read by its `field` (`requestListField` in core
  `model.ts`). The policy-list block moved from `{ check: "policy", inList }` to the brief's
  `{ check: "request", field: "policy", inList }` everywhere (model `RequestCondition`, guard palette, guard and
  coverage editors, sentence, template blanks, stubs, drives). A request block on another field (`payer | channel |
  store | pharmacist` with `anyOf`, `class` with `anyOf`, or a field this build does not know) reads as that
  field and its codes, never as a list block. Test: the seeded C-SABIC block (`sabic-policies`) reads as a policy
  list. This supersedes the "not moved here" note above.
- Insurers: ONE query, `insurerSettingsQuery` in core `registry-api` (the settings rows, `InsurerSettings` now in
  core `insurer-settings.ts`); the class-list picker's `insurersQuery` derives `Insurer[]` with `select` (drops
  `*`, defined once as `ESTATE_DEFAULT`). No two types under one cache key any more.
- Class-list (and patient / policy) entry change: a POST for a key (+ insurer) already listed is a **change** — the
  button reads "Save change", a hint says the reason and expiry are replaced, the toast says "Entry changed"; the
  `keyListed` refusal is gone (`entryAction`). The stub logs it `change`; the lists drive changes VIP for any
  insurer and reads the change log.
- `keyed.class.forOne` + `forAny` merged into one interpolated `keyed.class.split` (en + ar).
- Proof boxes: all three were already ticked; status stays `done`.
- Gates: typecheck, lint, `npm test` (7154) green; drives lists 200/200, coverage 172/172, simulator 122/122,
  approvals 126/126, rules 86/86, guard-editor 106/106, templates 90/90 (all stubbed).
