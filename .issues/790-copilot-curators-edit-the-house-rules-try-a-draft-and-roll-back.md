---
status: open
spec: 734
blocked-by: BackOffice 3395
---

# 790 — Copilot curators edit the house rules, try a draft and roll back

## What to build

A screen at **`/copilot/rules`** where a copilot curator edits the copilot's **house rules**: the style and shape
part of its system prompt. This is the web half of BackOffice **3395**, which holds the decision: a locked core in
code, plus editable house rules, versioned. On 2026-11-05 the owner had to ask three times for a comparison table
with one column per compared thing. That rule (12) and the markdown rule (8) become house-rules version 1, so the
next rule like them is a save, not a deploy.

### Access

- **`GET Copilot/Access`** gains `canCurate`. `access.ts` reads it as `canCurateCopilot`, and absent or failed means
  denied, as `canAsk` is today.
- **The menu:** one item under Administration, *Copilot rules*, behind an `accessProbe` on `canCurate`.
- **The route** sits in the copilot feature: `features/copilot/CopilotRulesPage.tsx`. It is top-level, not an area,
  per `.claude/rules/feature-structure.md`.
- **Opening it without the grant** shows the standard no-access state. A `COPILOT-410` from any door shows the same.

### The screen (`core/ui` controls only, logical Tailwind, every string through `t('copilot:rules.*')`)

1. **The core, read-only:** a collapsed *"What the copilot always follows"* section showing `core` from
   `GET Copilot/Prompt` as text. The curator sees what they add to, and cannot change it.
2. **The house rules:**
   - a `Textarea` with the active text;
   - the version, who saved it and when, all machine values in `Ltr`;
   - a character count *n / 4,000*, built with `formatCount`;
   - an optional note, *Why the change*;
   - Save is disabled while nothing has changed or the text is blank or too long.
3. **Try it:**
   - a question box and **Try with this draft**, which calls `POST Copilot/Prompt/Try` with the textarea's text as it
     stands, saved or not;
   - the answer is drawn by the copilot's own answer rendering: blocks, inline marks, tables, provenance;
   - it is labelled *Draft. Not saved, not in your conversations*;
   - the curator can try several times before saving;
   - a line under the box says a try counts toward their copilot limit.
4. **Save:** `POST Copilot/Prompt` with `baseVersion`.
   - **On success:** a toast *Saved as version N. The next question uses it.*
   - **On `COPILOT-411`** (someone saved first): a dialog showing theirs and yours side by side, with *Keep theirs*
     (reload) or *Save mine on top* (re-post with the new `baseVersion`). Nothing is lost silently.
   - **On `COPILOT-412`:** the field's error.
5. **History:**
   - the last 20 versions, newest first: version, who, when and note, plus *reverted from N* where set;
   - each opens read-only beside the current text;
   - **Restore this version** calls `POST Copilot/Prompt/Revert`, after a confirm naming the version;
   - the active one is marked.

### Leaving with unsaved changes

The router's blocker asks before leaving with an edited textarea, as the rule editors do.

### The copilot panel

The answer's provenance line gains the house-rules version: *Answered by gemini/… · rules v3*, in `Ltr`. A version
of 0 (the fallback) reads *built-in rules*.

## Proof

- [x] `access.test.ts`: `canCurate` true only when the reply says true; absent, false or failed means denied.
- [x] A pure `rules.ts` with tests:
  - [x] *dirty* (text or note changed);
  - [x] *can save* (dirty, not blank, at most 4,000 characters, nothing in flight);
  - [x] the 411 merge offer's two texts;
  - [x] history rows (*reverted from*, active mark).
- [x] `answer.test.ts`: `promptVersion` is read: a number gives *rules vN*, 0 gives *built-in rules*, absent gives
  nothing.
- [ ] Drive (`tools/copilot-rules-drive.mjs`, against BackOffice 3395 locally):
  - [ ] a viewer without the grant gets no menu item and the no-access state at the URL;
  - [x] a curator sees the core and version 1;
  - [ ] removing rule 12 and trying a comparison question shows a "Metric | Value" list;
  - [ ] putting it back and trying again shows one column per compared thing;
  - [x] save makes version 2 and the copilot panel's next answer reads *rules v2*;
  - [x] restoring version 1 makes version 3, reverted from 1;
  - [x] two tabs: saving in the second after the first gives the 411 dialog.
- [ ] Under Arabic, the version, times and count read the right way round, and the house-rules text keeps its own
  direction (`<bdi>` / `dir="auto"` on the textarea).
- [x] `npm run typecheck`, `npm test` and `npm run lint` are clean. Any new hand-written control goes in
  `tools/control-baseline.txt` with its reason, or uses `core/ui`. *(2026-11-06: typecheck, the 654 test files and four lint gates clean; the boundary gate's one failure is
  `insurance-rules`', committed before this ticket. No new hand-written control: `core/ui` only.)*

## Boundaries

- **No editing of the core or the tool descriptions.** It is shown, never sent back.
- **No per-role or per-user rules.**
- **No evaluation-set run from the screen** (a later ticket).
- **No diff library:** the side-by-side is two read-only panes.

## Done when

The proofs hold against BackOffice 3395 running locally, and the owner has saved one change and seen the next answer
follow it.

## Blocked by

BackOffice 3395 (the grant, `dbo.CopilotPromptVersion`, the five doors and `promptVersion` on the reply).

## Open questions

- **The menu label and place:** *Administration › Copilot rules* (proposed), or a tab on `/copilot` for curators?
- **Should Try live beside the editor** (proposed, so a change and its effect are in one view), or as a second tab?

## Comments

### 2026-11-06 — client half built against a stub (`/implement 790`)

**Status stays `open`.** BackOffice 3395 is not minted (`C:\Work\DMSCO\BackOffice\.issues` stops at 3394), so
*Done when* (the proofs against 3395 locally, and the owner's save) cannot hold yet. Everything the web owns is
built and driven against a stateful stub.

**The contract this client assumes, for 3395 to adopt or correct** (`src/core/models/copilot.ts`,
`src/features/copilot/rules-api.ts`):

- `GET Copilot/Access` → `{ canAsk, canUseMcp, canCurate }`.
- `GET Copilot/Prompt` → `{ core, active: version }`.
- `GET Copilot/Prompt/History` → `version[]`, the last 20, newest first.
- `POST Copilot/Prompt` `{ text, note, baseVersion }` → the new `version`. `note` is `null` when blank.
- `POST Copilot/Prompt/Try` `{ question, text }` → the `Copilot/Ask` answer shape, kept in no conversation.
- `POST Copilot/Prompt/Revert` `{ version, baseVersion }` → the new `version`, with `revertedFrom` set.
- `version` = `{ version, text, savedBy, savedAt, note, revertedFrom }`. Version 0 is the built-in fallback, with
  `savedBy`/`savedAt` null.
- `promptVersion` on `POST Copilot/Ask`'s answer. 0 means the built-in rules.
- Refusals: `COPILOT-410` means no curator grant, from any door. `COPILOT-411` means saved first; the client then
  re-reads `GET Copilot/Prompt` for *theirs* and needs nothing in the refusal's `data`. `COPILOT-412` means the
  text was refused, and the field shows the envelope's message.

**Proof, stubbed:** `tools/copilot-rules-drive.mjs` passes 84/84, in LTR and RTL. It covers:

- no grant: no menu item, and the no-access state at the URL;
- `COPILOT-410` gives the same state;
- the core is collapsed and read-only, and version 1 shows with its saver;
- the count, the blank and too-long guards;
- Try sends the unsaved draft. Without rule 12 the stub answers `Metric | Value`; with it back, one column per
  compared thing;
- the leave guard;
- save gives v2 with a toast, and the panel's next answer reads `Answered by … · rules v2` (`v2` in `Ltr`);
- restoring v1 gives v3, *reverted from v1*;
- `COPILOT-411`, both ways: *Save mine on top* re-posts on v4, and *Keep theirs* loads v6.

The stub's Try answers as a model would, so the live rule-12 proof still needs 3395 and a real model.

**Open questions:** both were answered with the proposals. The item is *Administration › Copilot rules*, and
Try sits beside the editor on a wide screen, below it on a narrow one.

**Deviations:**

- The count reads `n / 4000`, not `4,000`. `formatNumber` is `String()`, and the panel's own question count
  reads `/ 1000` too. Grouping is an app-wide formatter change, not this ticket's.
- A Try answer hides `rules vN`, because it was answered under the draft, not a saved version.

**Still open:** the live drive items and the Arabic check against 3395. `npm run lint`'s boundary gate fails on
`src/features/insurance-rules/aliases/door-shapes.test.ts`. That failure was already committed in `e9243c46` and
is not this ticket's. The other four gates are clean.

**Seen in review, not this ticket's.** These are in the uncommitted answer-markdown work (headings, numbered
lists, inline marks) in the working tree:

- an order number in `` `code` `` is no longer linked;
- a numbered list split by blank lines restarts at 1;
- `## Migrating to C#` loses its `#`. The closing-hash strip needs `\s+#+`.

### 2026-11-06 — moved onto 3395's real wire (owner: "it's returning error")

After the owner deployed SIS.Api with BackOffice 3395 (`4f9bf5ed2`), the screen failed: the client's proposed
contract did not match what the server built. The client now reads 3395's own wire, mapped at the edge by
`fromPromptWire` / `fromVersionWire` in `rules.ts` (tested), so the screen logic is unchanged:

- `GET Copilot/Prompt` is flat — `{ core, houseRules, version, savedBy, savedAt, note, maxLength }`, not
  `{ core, active }` (the page read `data.active.text` and crashed).
- The text is `houseRules` everywhere: version rows, the Save body `{ houseRules, note, baseVersion }` and the Try
  body `{ houseRules, question }`. `""` means none for saver, time and note.
- `GET Copilot/Prompt/History?take=20`; Revert takes `{ version }` only.
- Without the curator grant the filter answers a **bare 403** first (`COPILOT-410` is the second line); both now
  show the no-access state. Try's answer has `promptVersion: null`.

Drive moved to the same wire: 88/88 (LTR + RTL). 667 test files and build green. Still owed: the walk on the deployed
host (both `COPILOT_USER` and `COPILOT_CURATOR` are needed, and SQL `004_create_copilot_prompt.sql` before the build).

**2026-11-17 - walked live with the owner watching** (local SIS.Api on pricing2 4bbb888a5 against the local dev HQ database, which held v1-v3 from the system seed). Seen: the core ("What the copilot always follows") and the active version; **save** (one line added) made v4 and the panel's next answer read *rules v4* (and named the store by code and name, the line added); **restore** of v3 made v5 *reverted from v3*; **two tabs**: a save posted from the page's own session as the other tab made v6, and saving the stale edit opened "Someone saved first - Version 6 was saved while you were editing" with Theirs / Yours, *Keep theirs* and *Save mine on top*; v3 restored again as v7, so the rules end as they began. The adapted boxes: the local history started at v3, so "version 1 / 2 / 3" read as v3 / v4 / v5.

**Not ticked:** (a) no viewer without the grant was signed in; (b) the two rule-12 boxes - with the Tables rule removed from the draft, *Try* answered both a two-store and a two-period comparison with one column per compared thing, so today's fast model no longer shows the "Metric | Value" list the box expects; the Try draft itself works ("Draft. Not saved, not in your conversations"); (c) **Arabic fails**: under `oms.locale=ar` the page is laid out RTL but its strings stay English, so the version line reads "2026-11-17 20:44 on 14419 saved by 7 Version", "956 / 2000 Characters", "v3 reverted from", and full stops jump to the front. The house-rules textareas keep LTR correctly. Fix on branch `fix/790-rules-arabic`. Also seen: v2's seeded note reads "spec 3408 Â§I" - the `§` was stored double-encoded by its BackOffice seed script.

### 2026-11-17 — the Arabic box: the screen had no Arabic (owner walk)

**Seen:** with `oms.locale = 'ar'` the screen was RTL but English, so the mixed lines read backwards: "2026-11-17
20:44 on 14419 saved by 7 Version", "956 / 2000 Characters", "v3 reverted from", and full stops at the start.

**What was missing:**

1. **The Arabic words.** `ar/copilot.json` had no `rules.*` at all, nor the Try answer's `answer.*`, `ask.*`, `box.*`,
   most of `refusal.*` and `trace.*`, the `failed` fallback or the menu leaf. The namespace was loaded, but every
   key fell back to English. `copilot` is a PARTIAL Arabic namespace, so it never had the en/ar mirror test that
   the full namespaces have (`release-queue`, `doc-type-config`), and the copilot tests read only the English bundle.
   Nothing failed.
2. **The word order was made from pieces.** The version line was "Version", value, "saved by", value, "on", value as
   separate items in a flex row, and the count was a word next to an isolate. Under RTL the flex row laid the pieces
   out right to left. Each is now one `<Trans>` sentence with every value in its own `Ltr` slot:
   `rules.editor.versionLine.{full,by,at,bare}` and `rules.editor.charCount` (shared by the starters, `CharCount`).
   The old `rules.editor.version/savedBy/savedAt/chars` keys are gone.
3. **The empty note and Try question.** Their `dir="auto"` resolved LTR while empty, so the Arabic placeholder's full
   stop moved to its start. They now take the page's direction until something is typed, then `auto`.

**Changed:** Arabic for every string on the screen: the gate, core, editor, default readings, starters, Try, the
411 dialog, the history, the restore confirm, the toasts, the leave guard, the readers' counts (six plural forms)
and the answer the Try panel draws. `src/features/copilot/rules-i18n.test.ts` fails when a key the screen's sources
ask for (`t('…')`, `i18nKey`, the gate's `keyPrefix`) has no Arabic, or when those subtrees stop mirroring English.
Its first run caught `ask.*` and `failed`.

**Proof:** `tools/copilot-rules-drive.mjs` 100/100. It has a new Arabic pass that switches the app's i18n to `ar`,
checks that the version, saver and time sit right to left, checks the count and *مُستعاد من v1*, checks that no
English word is left outside data, and saves `.issues/assets/790-rules-ar.png`. The drive's three body checks were
also updated for 874's `defaultReadings`; they failed before this change.

🚩 **The box stays open for the owner's look, for one reason.** The app's `lng` is still hard-coded to `en`
(`src/core/i18n.ts`). `oms.locale` sets only `dir`, as the other RTL drives note. So outside the drive, a real
browser will still show this screen in English and mirrored until Arabic is switched on app-wide. That switch is not
this ticket's. The screenshot shows the screen as it reads once the switch is made.
