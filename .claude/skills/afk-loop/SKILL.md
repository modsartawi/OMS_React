---
name: afk-loop
description: Generate a project-root PowerShell runner that drives /implement + /standards-review over a list of related tickets in fresh unattended Claude sessions, sequentially and overnight. Use this whenever the user points at a group of tickets and wants them run AFK, unattended, overnight, "while I sleep", in a loop, or in batch — e.g. "run 215-221 overnight", "make me a loop script for the spec 209 tickets", "leave these building". Also use when the user wants to regenerate, extend, or re-order an existing run-implements-*.ps1, or when a wave spans this repo and the C# BackOffice repo and needs splitting.
---

The user points at a set of related tickets; this skill writes **one PowerShell file at the project root** that runs them unattended, one after another, each in a fresh `claude -p` session.

The harness itself is finished and proven — it lives verbatim in `assets/runner-template.ps1` and you copy it, you do not re-derive it. Every line of it exists because an earlier loop failed that way: the file-redirected stdin (a session can never block on input), the stall watchdog and 60-second heartbeat (a quiet terminal is never ambiguous), `WaitForExit` before reading `ExitCode` (a `-PassThru` object hands back a null exit code that reads as failure), the `AFK-DONE` marker cross-checked against ticket status *and* a moved HEAD *and* a clean tree.

**Your real work is the briefing** — the `WAVE_FACTS` block inside the AFK system prompt. At 3am there is nobody to ask, so anything a human would have said out loud during the wave has to already be in that block. A generated runner with a thin briefing runs fine and produces work you throw away.

> A sibling `afk-loop` skill lives in the C# repo at `C:\Work\DMSCO\BackOffice\.claude\skills\afk-loop\`. Same harness, different house rules and verification. See **Waves that span both repos** below.

## Process

### 1. Establish the ticket set and its spec

Ask for the tickets if the user didn't list them. Then read, in this order:

1. Each ticket file `.issues/<N>-*.md` — full text, not just the frontmatter.
2. The `spec:` the tickets point at, and the wayfinder map above it. **The `spec:` may be an absolute path into the C# repo** (`spec: C:\Work\DMSCO\BackOffice\.issues\503-web-pos-simulation-spec.md` — tickets 013-015 are the precedent). Read it there; it is still the governing spec.
3. `.issues/INDEX.md` for siblings in the same wave that have already landed, and any `*-AFK-HANDOFF.md` / `*-MORNING-REPORT.md` from a previous run of the same effort — those hold exactly the kind of decision a fresh session would otherwise re-take.
4. The committed diffs of the already-landed tickets in the wave.

### 2. Confirm the branch

This matters more here than in the C# repo: waves are often built on a feature branch, and **the tickets themselves may only exist on that branch** (the notification-center wave is the precedent — its tickets lived on `feature/active-sessions-pos-chip`, not `main`). The runner never switches branches; it commits onto whatever is checked out.

Check `git rev-parse --abbrev-ref HEAD`, confirm the ticket files are present on it, and put the expected branch into `EXPECTED_BRANCH` so the runner prints it at pre-flight. If the tickets aren't on the current branch, say so before generating anything.

### 3. Decide the running order

Default to the `blocked-by` frontmatter's topological order, then override it deliberately. Two forces beat it, and when either applies write the reason into `ORDER_RATIONALE`:

- **Deletions and shared-surface changes run early.** A slice that rewrites a layout, a route table, or an i18n bundle that later slices extend should go first, or every later slice carries a doomed version through its own diff.
- **Backend-blocked slices run last, or come out entirely.** A slice whose proof needs an endpoint that isn't built can still land (stubbed at Playwright), but it's the likeliest to burn a session — put it where a blocker costs one ticket, not the night.

State the order and the reasoning to the user before writing the file.

### 4. Measure the baseline

Before generating, run the three gates and record what's *already* red, so the AFK sessions don't spend the night chasing failures that predate them:

```powershell
cd C:\Playground\oms-react
npm run typecheck   # count errors, if any
npm test            # count failing tests / files
npm run lint        # which of the three gates fails, if any
```

Put the counts into `BASELINE_FACTS` as plain statements — "typecheck is clean", "4 pre-existing failures in `src/features/sim/*.test.ts`, all pre-dating this wave". A session that knows the baseline can prove its slice is *additive*; one that doesn't will either fix unrelated things or stop.

### 5. Write the briefing

`WAVE_FACTS` is a bulleted block (each line already indented three spaces). Aim for the things that would otherwise be *silently* wrong. Cover, when the wave has them:

- **Scope walls.** New npm dependency allowed or a blocker. New feature folder or extending an existing one. Whether the slice may touch shared layout/routing.
- **Named traps.** Concretely: the shared component that two slices both want to change, the i18n key namespace that must not collide, the grid column definition that lives somewhere non-obvious. Give the symptom too — in this stack the classic is "renders perfectly in English, wrong in Arabic", which no green gate catches.
- **Reversals.** A decision that was changed at some point is exactly what a fresh session gets wrong, because the old wording still sits in an older ticket.
- **Settled costs.** Anything already ruled on that a thoughtful session would want to re-litigate. Name it as ruled.
- **Design fidelity.** If the wave has a design mock ticket or approved screenshots, name the file and say it governs — otherwise a session will invent a reasonable-but-different layout.
- **What "proven" means for this wave.** Which slices are pure-module (vitest), which are UI (drive the app), and which are backend-blocked (stub the network, leave the Proof box honest).

The template already carries the repo's standing rules (feature-structure boundaries, i18n zero-literal, logical Tailwind, api-envelope, the `@/` alias) and the whole verification section (typecheck / vitest / lint / build / drives on port 5199 / borrowed Playwright / no RTL). **Don't repeat them in `WAVE_FACTS`** — if you want to, that's a sign the rule belongs in the template instead, so every future wave inherits it.

`REVIEW_WAVE_RULES` is the same material compressed to what an independent reviewer needs. Not a copy — what "correct" looks like from outside.

`OWNER_PROOF_ITEMS` names every proof box the loop must leave unchecked: anything needing a live SIS.Api, a human's eye on a rendering, or a decision only the owner can make.

### 6. Generate, verify, hand over

Copy `assets/runner-template.ps1` to `<project-root>/run-implements-spec<NNN>.ps1` (`<NNN>` = the spec the tickets name; if that spec lives in the C# repo, use its number and say so in the header) and substitute every `{{PLACEHOLDER}}` — full list in `references/placeholders.md`.

Two constraints on the output are load-bearing:

- **ASCII only, no BOM.** PowerShell 5.1 reads a BOM-less `.ps1` as ANSI, so an em dash or curly quote pasted out of a ticket becomes mojibake and can break the parse — at 2am, after the user has gone to bed. Ticket titles in this repo often contain typographic dashes; strip them.
- **No `{{` left anywhere.** An unsubstituted placeholder inside a here-string won't fail the parse check; it will quietly hand a session a briefing with `{{WAVE_FACTS}}` in it.

Then run all three checks and report what each said:

```powershell
$e = $null; [System.Management.Automation.Language.Parser]::ParseFile("<path>", [ref]$null, [ref]$e); $e
Select-String -Path "<path>" -Pattern '\{\{' -SimpleMatch
.\run-implements-spec<NNN>.ps1 -DryRun
```

Tell them to run `-SmokeTest` before bed — one trivial session through the identical harness, about a minute, and the only check that proves the plumbing on tonight's machine rather than the last night it worked.

Hand over short: file path, running order with reasons, preconditions they still own (branch, `npm ci`, a live SIS.Api if any slice needs one), and the outstanding proofs the loop cannot close.

## Waves that span both repos

An effort chartered here often produces tickets for **both** systems: the screen in this repo, the endpoint in `C:\Work\DMSCO\BackOffice`. They are separate git repos with separate `.issues/` and separate numbering, so:

- **One runner per repo, each running only its own repo's tickets.** Never put a BackOffice ticket number in this runner's `-Tickets` — the pre-flight will fail on a missing `.issues\<N>-*.md`, which is the good outcome, but the real cost is a night spent on the wrong half.
- **Split the list first.** When the user hands you a mixed set, sort it by which `.issues/` the ticket actually lives in and say which went where before generating.
- **The seam is the contract, and it is one-directional.** A frontend slice blocked on an unbuilt endpoint doesn't wait: it's proven with the network stubbed at Playwright against the *agreed* envelope shape, and the real integration is a later ticket. Put the agreed shape into `WAVE_FACTS` verbatim — a session that invents a plausible response shape produces a screen that fails the day the endpoint lands.
- **Never let a session in this repo edit the other one.** The `CROSS_REPO_BLOCK` placeholder exists for this: it grants read access to the C# spec and forbids editing, committing, or "helpfully" fixing anything over there.
- If the backend half should also run tonight, generate its runner with the sibling skill in that repo and tell the user to run them in two shells — the two repos share no git index, so they're genuinely parallel. Sequence them only if a frontend slice truly needs the endpoint live.

## Exit codes

| Code | Meaning |
|------|---------|
| 0 | wave complete (or `-DryRun` / `-SmokeTest` passed) |
| 1 | pre-flight failed — ticket status, blocking ticket, missing `node_modules`, or a dirty tree |
| 2 | a session logged `AFK-BLOCKED` — read `.afk\HITL-<t>.md` |
| 3 | ended without `AFK-DONE`, or the marker disagreed with the ticket/HEAD |
| 4 | no `result` event — inspect `.afk\session-<t>.jsonl` |
| 5 | the session returned `is_error` |
| 6 | stall watchdog killed the tree |
| 7 | hit the `-MaxHours` ceiling |
| 8 | the read-only review round edited tracked files |
| 9 | a slice committed but left tracked modifications behind |

## Re-running a partial wave

The loop stops at the first failing ticket, so resuming is dropping the finished ones:

```powershell
.\run-implements-spec209.ps1 -Tickets 219,220,221
```

Exit 9 prints that exact line for you. When resuming, re-check the briefing — a ticket that landed differently than planned can invalidate a `WAVE_FACTS` line, and regenerating is cheap.
