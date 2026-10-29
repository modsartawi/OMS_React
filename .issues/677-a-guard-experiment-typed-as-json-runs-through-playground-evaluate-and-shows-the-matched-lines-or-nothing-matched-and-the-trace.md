---
status: open
spec: BO 3243 (brief C:\Work\DMSCO\BackOffice\.issues\assets\3243-oms-react-rule-playground-brief.md; spec C:\Work\DMSCO\BackOffice\.issues\3243-insurance-rule-playground-spec.md)
blocked-by: —
---

# 677 — A guard experiment typed as JSON runs through Playground/Evaluate and shows the matched lines (or "nothing matched") and the trace

## What to build

**Tracer bullet.** It retires the biggest unknown, which is the new door's envelope and reply shape. It does that
before any form, editors, lessons or compare exist.

Insurance rules → **Playground** at `/insurance-rules/playground`, a new feature
`features/insurance-rules/playground/` (`PlaygroundPage.tsx` + `api.ts`). It has three panes: **Data | Rule |
Outcome**.

- **Data:** one JSON box holding the door's `data` (engine shape, brief "HQ contract"), seeded with a one-line guard
  example.
- **Rule:** one JSON box holding the scratch `document` (`{ schema: 1, kind: "guard", revision: 0, fields: [],
  lists: [], rules: [...] }`), seeded with one guard rule.
- **Run** button: `POST InsuranceRules/Playground/Evaluate` `{ kind: "guard", data, document, asOf }`, with `asOf`
  set to local now as `yyyy-MM-ddTHH:mm:ss` and no `Z`. Auto-run and the kind picker are 678's.
- **Outcome, tab A ("What the engine saw"):**
  - the **matched lines**, or, when no line matched, **"nothing matched"** (the brief's null);
  - per line, the **trace**: each `{ ruleId, blockPath, value: true|false|unknown, why }`, with the value as a tone
    badge and `why` as free text in `<bdi>`;
  - a non-empty `errors[]` shows only the reader errors (`path` + `message`), with nothing else. Pointing them at a
    block is 679's.
- JSON that does not parse is said in words and never sent.
- `reads` is drawn nowhere yet (686), and `verdict` nowhere yet (678).

Registration (feature-structure checklist; area slots):
- namespace **`insurance-playground`**, EN + AR mirrored, registered in `core/insurance-rules/locales.ts` under a
  new `677` slot;
- the route in `app/insurance-rules-routes.tsx`;
- a leaf in `layout/menu-insurance-rules.ts` (`insurance-rules:menu.playground`, EN + AR).

**Decision (overrulable):** the leaf is **ungated like the rest of the group** (the 607 ruling). No probe door can
answer `BackOfficeScreen[InsuranceRulePlayground, 01]` yet. A bare 403 from the door is said in words on the page
("You do not have access to the playground"). 691 adds the gate.

A pure module turns the reply into the view model: matched lines, null, trace rows per line, and errors. Defensive
`…In()` readers treat absent arrays as empty, following the simulator's `simulateIn` precedent.

## Spine reach

model/api (core model types for the Evaluate body + reply, `api.ts`) · store/logic (reply → view model) ·
component/route (page, route, menu leaf) · i18n (new ns, en + ar) · test (vitest + new drive)

## Proof (→ `tdd` red-green cycles)

- [ ] `outcomeView` — a reply with matched lines gives those lines with their trace rows; a reply where no line
      matched gives null ("nothing matched"); a non-empty `errors` gives only the errors; absent arrays read as empty — pure
- [ ] `i18n-keys.test.ts` (playground) — en and ar `insurance-playground` mirror key-for-key, and every key the code
      builds exists — pure
- [ ] `tools/insurance-playground-drive.mjs` (new; stub `Playground/Evaluate` in `tools/insurance-rules-stubs.mjs`
      under a `677` section) — open the leaf, Run, see matched lines and trace; edit the rule so nothing matches, and
      see "nothing matched"; a reader error shows alone; a bare 403 shows the no-access words; LTR + RTL — flow

## Boundaries

New door `POST InsuranceRules/Playground/Evaluate` (BackOffice 3244, guard). Refusals come as `PLAYGROUND_*` codes
in the rule-request refusal envelope: show `apiErrorMessage` and the code, never "unexpected". New namespace
`insurance-playground`. The menu leaf is ungated (see the decision above). The door is stubbed until 691.

## Done when

The drive is green against the stub: a guard JSON experiment runs and shows matched lines or "nothing matched", plus
the trace, in LTR and RTL. typecheck, lint and `npm test` are green.

## Blocked by

None — can start immediately (parallel with 676: no shared files beyond the stubs file's own section).

## Open questions

- Which door answers the grant for the menu leaf? A new `Playground/Access` probe, or a flag on the insurance probe
  618 is getting? This is a BackOffice ask, carried to 691.
