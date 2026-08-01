# Placeholders in `assets/runner-template.ps1`

Every `{{NAME}}` must be substituted. Keep every substitution **7-bit ASCII** — the template has
no BOM and PowerShell 5.1 reads a BOM-less `.ps1` as ANSI. Ticket titles in this repo routinely
carry typographic dashes and curly quotes; strip them on the way in or the file becomes mojibake.

## Identity and usage header

| Placeholder | What goes in |
|---|---|
| `{{WAVE_TITLE}}` | The wave in one phrase, as it reads in a sentence: `the spec 209 authorization-request tickets ("a live engine session")` |
| `{{SCRIPT_NAME}}` | The generated file name, e.g. `run-implements-spec209.ps1`. Appears twice — usage block and the exit-9 resume hint. |
| `{{TICKETS_JOINED}}` | Default order, comma-space, for the usage comment: `213, 214, 215, 216, 218` |
| `{{TICKETS_JOINED_COMMA}}` | Same list for the `param()` default |
| `{{TICKETS_EXAMPLE_PAIR}}` | Two adjacent tickets showing `-Tickets` usage: `215,216` |
| `{{WAVE_LABEL}}` | Short label for the completion line: `Spec 209 wave` |
| `{{SPEC_LABEL}}` | How the review prompt names the spec: `spec 209` |

## The map and the order

`{{DEP_MAP_CAPTION}}` — what the map is relative to this run: `209 spec; 210-212 already landed`.

`{{DEP_MAP}}` — the graph as **whole comment lines** (each starts with `#`), read off the tickets'
`blocked-by:` frontmatter:

```
#   213 --> 214 --> 215 --+-- 216 --> 221
#                         \-- 219
#   218 (independent)
```

`{{ORDER_RATIONALE}}` — whole comment lines. One bullet per deviation from the graph order, with
the consequence. If the order is exactly topological, say so in one line rather than leaving it
blank:

```
#   * 215 runs before 216 even though they are siblings: 215 defines the row-affordance component
#     that 216 renders into, so building it second means 216 ships a placeholder and 215 rewrites it.
#   * 219 runs LAST. Its proof needs a live SIS.Api attachment endpoint that is not up, so it is
#     the likeliest to burn a session - a blocker there costs one ticket, not the night.
```

## Preconditions

| Placeholder | What goes in |
|---|---|
| `{{BLOCKING_TICKETS}}` | PowerShell array literal of tickets that must already be `status: done`: `212`. Empty is fine: `@()`. |
| `{{BLOCKING_PRECONDITION}}` | Prose form: `212 must be 'status: done' and committed.` With no blockers: `Nothing outside this wave blocks it.` |
| `{{EXPECTED_BRANCH}}` | The branch the wave builds on, e.g. `feature/authorization-requests` or `main`. Appears twice (comment + the pre-flight line the runner prints). **Verify the ticket files actually exist on it** before generating — the notification-center wave's tickets lived only on a feature branch. |
| `{{OWNER_PRECONDITION}}` | What the owner owns: `A live SIS.Api on :5111 is NOT required - every slice in this wave stubs the network at Playwright. The design mock in 211 is approved; the loop follows it and does not re-decide layout.` |

## The briefing

`{{SPEC_PATH}}` / `{{MAP_PATH}}` — repo-relative with backslashes (`.issues\209-...md`), **or an
absolute path into the C# repo** when the spec lives there:
`C:\Work\DMSCO\BackOffice\.issues\503-web-pos-simulation-spec.md`.

`{{LANDED_TICKETS_SENTENCE}}` — one sentence naming the siblings already on the branch, telling the
session to read them before re-deciding anything:

```
Tickets 210, 211, 212 have already landed on this branch - read their committed
     diffs before re-deciding anything they settled.
```

`{{WAVE_FACTS}}` — the bulleted block, **each line indented three spaces**. See SKILL.md step 5.
Shape:

```
   - This wave adds NO npm dependency. If a slice looks like it needs one, that is a BLOCKER, not
     a decision you take at 3am.
   - 215 and 216 both render into the same row component. 215 owns its shape; 216 only adds the
     reason text. Do not restructure it in 216.
   - The i18n keys for this wave all live under `authz.request.*`. A key invented outside that
     namespace passes every gate and is invisible until someone translates the app.
   - The refusal copy is FINAL as written in the spec - it was argued and ruled. Do not reword it
     for tone, and do not add a second sentence explaining it.
```

Do **not** repeat the standing rules (feature boundaries, i18n zero-literal, logical Tailwind,
api-envelope, `@/` alias) or the verification section (typecheck / vitest / lint / build / drives /
borrowed Playwright / no RTL) — the template carries all of them verbatim.

`{{CROSS_REPO_BLOCK}}` — **only when the spec or a dependency lives in the C# repo.** Three spaces
of indent, same as `WAVE_FACTS`. When the wave is purely frontend, substitute an empty string:

```
   - The governing spec lives in the OTHER repository (C:\Work\DMSCO\BackOffice). You may READ it
     and any ticket it names. You may NOT edit, stage, commit or run anything in that repository -
     it has its own branch, its own loop and its own reviewer. If you believe something there is
     wrong, log it to the HITL doc and carry on with your slice.
   - The endpoint this slice calls is NOT built yet. Its agreed envelope is exactly:
     <paste the agreed shape here, verbatim>
     Stub that shape at Playwright to prove the screen. Do not invent fields, do not soften the
     shape to whatever is convenient - a screen built against a guessed shape fails the day the
     endpoint lands, and it fails silently on the fields you guessed.
```

`{{BASELINE_FACTS}}` — measured, not assumed (SKILL.md step 4). **Five spaces of indent** (it sits
under a sub-bullet). State each gate, even the clean ones — "clean" is itself the fact a session
needs to know a new failure is its own:

```
     * npm run typecheck: CLEAN. Any error you see is yours.
     * npm test: 4 pre-existing failures, all in src/features/sim/keys.test.ts, predating this
       wave. Do not fix them; prove your slice is additive.
     * npm run lint: all three gates CLEAN.
```

`{{OWNER_PROOF_ITEMS}}` — inline phrase completing "In this wave that is ...":
`219's attachment upload (needs a live SIS.Api) and any Proof box asking a human to eyeball the
Arabic rendering`.

`{{REVIEW_WAVE_RULES}}` — the reviewer's version, **indented two spaces**, continuation lines of
the bullet above it in the template:

```
  no new npm dependency; i18n keys confined to authz.request.*; 215 owns the row component's
  shape and 216 must not restructure it; the refusal copy is final as specced; backend-blocked
  Proof boxes must be honest, not faked green.
```

## Closing notes

`{{CLOSING_NOTES}}` — zero or more complete `Say` **statements** (not comments), printed after the
wave finishes. This is the morning's to-do list, so name what the loop deliberately could not do.
Each string must stay on ONE line — a `Say` argument broken across lines will not parse:

```powershell
Say ">>> Still outstanding: 219's attachment upload needs a live SIS.Api - drive it once the endpoint is up. <<<" "Yellow"
Say ">>> The BackOffice half of this wave (tickets 5xx) runs from its own loop in C:\Work\DMSCO\BackOffice - this runner did not touch it. <<<" "Yellow"
Say ">>> Eyeball the Arabic rendering of the new rows before shipping; no gate catches a physical Tailwind utility. <<<" "Yellow"
```
