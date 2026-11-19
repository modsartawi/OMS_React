---
status: open
spec: BackOffice 4050
blocked-by: BO 4053, 922
---

# 923 — An investigator reveals a case's patient with a reason

## What to build

- **"Show patient" on the case screen**, visible only with `INSURANCE_PATTERN_INVESTIGATOR`.
- **The dialog asks for a reason** (at least 10 characters, EN and AR copy saying the reveal is logged), then calls
  `POST …/{id}/Reveal`.
- **The patient key and member ID** show in the dialog only. They are held in component state, never cached by the
  query client, never written to the URL, local storage or logs, and cleared when the dialog closes.

## Spine reach

UI (case screen dialog).

## Proof (→ `tdd` red-green cycles)

- [x] The button is hidden without the grant
- [x] Submit is disabled under 10 characters
- [x] The identity is shown after the call and gone after closing (no query-cache entry, nothing in storage)
- [x] An error from the call shows the error and no identity
- [x] Lint + build clean (the only lint failures are the 4 pre-existing `check-boundaries` hits in
  `insurance-rules/aliases/door-shapes.test.ts`, on `main` too; see the comment)

## Done when

Proof is green, and there is a live walk with a seeded investigator: the reveal row is in `InsurancePatternReveal`.

## Blocked by

- BackOffice 4053
- 922

## Comments

**2026-11-19 — built and proven against mocks; stays `open` for the live walk on BO 4053.** "Show patient" sits in the
case header's actions (`src/features/insurance/patterns/RevealPatient.tsx`), shown with `canRevealPatient`
(`InsurancePattern:06`) only. Its dialog says the reveal is logged (EN + AR), asks a reason of 10 to 250 characters
counted trimmed, posts `{ reason }` to `…/Cases/{caseId}/Reveal`, and shows the patient key and member id, each a
machine value in `Ltr`, in the dialog only.

- **Where the patient lives:** the dialog's own `useState`, nowhere else. `patternsApi.reveal` is called straight from
  the click: no `useQuery`, no `useMutation` (TanStack's mutation cache keeps `data`). Its answer is read field by field
  in `reveal.ts` (`patientKey` and `memberId` only). Nothing goes to the URL, storage, the console or a toast, and the
  dialog is mounted only while open, so closing it drops the patient; showing them again is another logged reveal. The
  answer is not a model: `core/models/insurance-patterns.ts` stays identity-free and 922's `no-identity` test is
  unchanged.
- **Tests (vitest), mutation-checked (10 mutations, each turned a test red):** `reveal` (the reason at 9/10 and 250/251
  characters, trimmed, Arabic; the body; which failure says what), `reveal-api` (at the `@/core/api` seam: the trimmed
  reason posted, the id escaped, no actor; only the two agreed fields kept from an answer that also carries a policy and
  a name; no patient key is not a reveal; a bad reason is never sent; a refusal passes through), `reveal-contract` (a
  source contract: the dialog names no query or mutation hook or client and no storage, console, toast or address sink;
  no other file of the feature names `patientKey` or `memberId`), `reveal-i18n` (every `reveal.*` key the dialog names
  exists in EN and AR; both say the reveal is logged). Full suite: 11,407 of 11,410 on a machine held at 100% CPU by
  the parallel slices; the 3 misses were timeouts in unrelated files (`core/util/copy-text`, `admin/data-sync`
  create-helpers, `collection/settlement` search), which pass on their own (44/44).
- **Drive** `tools/insurance-patterns-reveal-drive.mjs`: **53/53** on the real app against 922's stubs, with its own
  reveal door chained after `patternsDoors`. No button for an analyst (also with the manager and block keys), "no
  access" for the investigator key alone. The send is held at 0, 9 and 9-with-spaces characters and past 250, its reason
  in its title and under the field, and nothing is sent. The reveal posts exactly `{ reason }` (trimmed, once, with
  `X-Web-Client`), shows the key and member id isolated LTR, never the policy number the stub added, and shows the
  reason back. After Close, and after Escape, the patient is in none of: the page, the app's query and mutation caches
  (the `QueryClient` read off the React tree; no reveal entry in either), local and session storage, the address,
  history state, cookies, the title, the console. The dialog reopens empty, and a second look is a second reveal. A
  failed log write (a coded 500 that even carries an identity in its body) shows the server's sentence and nobody,
  keeps the reason, and a retry then shows the patient; an answer with no patient key says so; a bare 403 names the
  grant, the app re-reads its permissions, and the button goes while the dialog stays to say why. Arabic, RTL: the copy,
  the held send's reason, an Arabic reason sent as typed, labels at the reading start, key and member id still LTR
  (screenshot `923-insurance-pattern-reveal-rtl-ar.png` in the session scratchpad, `SHOT_DIR`). 922's drive is still
  77/77 on this branch.
- **Guessed — reconcile when BO 4053 lands (BackOffice asks):**
  - `POST Insurance/Patterns/Cases/{caseId}/Reveal` `{ reason }` → `{ patientKey, memberId }` (camelCase); no actor.
  - The reason: at least 10 characters once trimmed, counted as the server's string length; at most **250**, from
    4053's `NVARCHAR(250)` (the client refuses past it rather than let the log keep a clamped reason).
  - Refusals: a failed log write as a coded business refusal (`REVEAL_NOT_LOGGED` in the stub; any code shows with its
    sentence); a missing grant as the grant filter's bare 403 (the dialog names the investigator grant). A success with
    no patient key is treated as no reveal and never called logged.
  - A patient with no member id: an empty or absent `memberId` reads "Not given".
  - The grant key `InsurancePattern:06` (922's guess).
- **Judgement calls to review:** (1) the 250 cap. (2) "Logged" is said only beside a patient: 4053 answers the identity
  only after its log row is written. (3) An open dialog stays open if the grant is withdrawn under it, so it can say
  why; the button is gone once it closes. (4) A reveal in flight cannot be dismissed (Escape, backdrop and Cancel held)
  and a second click is ignored: one log row per send, and no logged answer lands on a closed dialog. (5) The sent
  reason is shown back under the patient, and the dialog says the patient shows in this window only. (6) The send reads
  "Log and show", naming the log on the action itself. (7) The two values are `select-all` monospace for a deliberate
  copy; no copy button. (8) Focus: the reason box on open, Close after the reveal (Close is keyed so it mounts;
  unkeyed, React reused Cancel's button and its `autoFocus` never ran).
- **Lint:** grid, contrast, palette, controls and map-build gates are clean. `check-boundaries` still exits 1 on the
  same 4 pre-existing hits in `src/features/insurance-rules/aliases/door-shapes.test.ts` (on `main` too; nothing here
  touches it): the box is ticked on that note. Build clean.
- **Shared files, for the merge with 924:** `api.ts` (one import after `./mark`; `reveal` inserted between `detail` and
  `mark`), `PatternCasePage.tsx` (one import after `./paths`; one element under the 923 slot comment), and both
  `insurance-patterns.json` (a `reveal` block inserted before `case`). No existing line changed.
- **Not here:** "Reveal (patient)" is not in `CONTEXT.md` yet (spec 4050 lists it for the glossary).
- **Still owed:** the live walk with a seeded investigator on BO 4053's local endpoints: the reveal row in
  `InsurancePatternReveal`.
