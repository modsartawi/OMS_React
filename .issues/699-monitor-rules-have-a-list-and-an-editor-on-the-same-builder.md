---
status: done
spec: BO 3271 (brief C:\Work\DMSCO\BackOffice\.issues\assets\3271-oms-react-fhir-insurance-rules-brief.md)
blocked-by: 693
---

# 699 — Monitor rules have a list and an editor on the same builder

## What to build

Stories 38, 41, 42; A1, A2, A7, A9; doors 3290, 3292. A rule kind `monitor`, listed beside guards and edited on the same
builder, scope `claimResponse` (pre-auth and claim `use`). It can read `$claimResponse.reissue.reason` and
`$previous.claimResponse.<key>`. Its only effect is a review item, so the editor shows severity **info / action** and EN
and AR text, and offers none of the guard's till effects: no REFUSE / OVERRIDE / WARN, no acknowledgement, no suggestion
to the pharmacist. The page says plainly that a monitor never touches a sale.

**Decision (overrulable):** monitors live in the existing `guards` feature as a kind on the same list and editor, so
"same builder" needs no new feature and no move into core.

## Spine reach

model/api (kind, scope, effect) · store/logic (what the editor offers per kind, `$previous` keys) · component (list,
editor) · i18n (en + ar) · test (pure + drive)

## Proof (→ `tdd` red-green cycles)

- [x] per kind: a monitor offers no guard effect and a guard offers no monitor severity — pure
- [x] `$previous` keys are offered on a monitor and never on a guard — pure
- [x] create a "reissue cut the approved quantity" monitor, save, reopen, read it; every existing guard drive stays
      green — flow

## Boundaries

No new door beyond the kind and scope. Approval, shadow and back-test are 700; other scopes are 701. Doors stubbed; 711
reconciles.

## Done when

An author writes a monitor on the builder they know, and cannot give it an effect on a sale.

## Blocked by

693.

## Comments

**2026-10-30, built, all stubbed (no live SIS.Api).** Pure proofs in `core/insurance-rules/monitor.test.ts`; drive 80/80 in LTR and RTL. RTL is
direction only (692's `lng: 'en'` finding), so the Arabic words are proved against the locale in the pure test. SIS.Rules 2.1.0 (3273) and door
3290 are open, so every spelling below is a guess.

Shape guesses for 711:
- A monitor is a rule in the guard draft (`GET / PUT Guards/Draft`, no new door): `kind: "monitor"`, `scope: "claimResponse"`,
  `uses: ["preauthorization", "claim"]` (FHIR's `use` codes). A rule with no `kind` is a guard, and a guard is sent byte-identical.
- `then: [{ effect: "reviewItem", severity: "info" | "action", says: { en, ar } }]`, and no `codes`, `suggest`, `audience`, `window` or `onUnknown`.
  The codec strips those both ways, and an effect with any other severity reads and goes out as `info`.
- `$previous.claimResponse.<key>` as the spec spells it. A line field is `$previous.line.claimResponse.<key>`: the spec does not spell a line one,
  and `outcome` is both a message and a line key. As a block: `{ check: "previous", field: "line.claimResponse.<key>", <test> }`.
- Comparing with the answer before is a formula: `["<", "$line.claimResponse.approvedQuantity", "$previous.line.claimResponse.approvedQuantity"]`.
- The catalog door serves a row `reissue.reason` on `claimResponse` (stubbed type `code`). The client derives the `$previous` rows; no door serves them.
- `GET Guards` row: `kind`, and `severity` holding `info` / `action`.
- Id `M-001`, minted by the client as a guard's `G-` is.

**Asks for 711:**
- 693's `schema: 1` pin still stands: a ruleset holding a monitor goes out as `schema: 1`. 3273 is a new engine version, and I did not guess the number.
- Monitors share the guard draft's revision, so saving a monitor bumps it and a pending guard draft freezes monitors too. If 3290 gives monitors a ruleset of their own, this moves.
- 700 and 701 inherit: the back-test, approval and shadow screens still read a monitor as a guard. Nothing here hides them.

Overrulable decisions:
- The list is one grid with a Kind column, sortable, no kind filter. The title stays "Guards".
- "The page says plainly" is on all three screens (list, rule, editor).
- A monitor's palette is history, typed fact, formula and group. History is kept because A1 says "plus the patient's history", though its fields (`sameItem`, this line) were written for a till; 3273 should say what it reads.
- The fact block on a monitor has no registry dropdown, only the catalog. A monitor's catalog is `claimResponse` and `$previous`; a guard never sees `$previous` or `reissue.*`, the Fields page still lists what the door serves.
- `onUnknown` is hidden on a monitor (`warn` would warn a pharmacist) and replaced by a line saying unknown never fires, and that the first answer's `$previous` reads unknown.
- No placeholder chips on a monitor's text: the guard's are the till's, and 3273's "typed placeholders" are not named yet.
- A monitor offers no Open in playground and no Save as template: both would treat it as a guard.
- At least one `use` stays on. The scope is shown, not chosen, until 701.
- `action` wears the attention tone and `info` the primary one, ranked below every guard severity.
- The ƒx helper on a monitor lists single values only (no list, date or coded key), and two recipes (cut quantity, reissue reason, whose `correction` is an example code).
