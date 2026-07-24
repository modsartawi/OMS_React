---
status: open
spec: 082
blocked-by: 084
---

# 086 — aStatusBadgeTakesASeverityRatherThanAClassString

## What to build

One badge component in `core/ui`, taking a **severity** rather than a class string, with its first
two real consumers converted — so the badge idiom exists in exactly one place before ticket 088
converts the remaining ~44 hand-written strings.

The helper already exists in the wrong place: `admin/ua-admin/helpers.ts` exports a tone map keyed
`ok | warn | bad | muted` — the severity vocabulary, arrived at independently, minus a letter. Two
features already share the shape, so under [feature-structure](../.claude/rules/feature-structure.md)
it graduates **up** to `core/` rather than being copied a third time.

- **`core/ui/severity.ts`** — `type Severity = 'ok' | 'go' | 'warn' | 'bad' | 'mute'`, plus the
  severity → class-string map per shape. The five words are fixed and mean: `ok` = complete and went
  well · `go` = actively in motion · `warn` = needs a human · `bad` = ended badly, terminally ·
  `mute` = not recognised / neutral. ua-admin's `muted` is **renamed** to `mute`, and `go` joins even
  though it has no consumer on the document pill rail — its constituency is the informational sites
  ticket 088 sweeps.

  ```
  ok   → bg-success-050   text-success-800
  go   → bg-primary-050   text-primary-800
  warn → bg-attention-050 text-attention-800
  bad  → bg-danger-050    text-danger-800
  mute → bg-muted         text-muted-foreground
  ```

  **No `dark:` variant on any of them.** That is derived from 084's R4 — `-050` and `-800` are roles
  that swap absolute lightness between themes — not a simplification.

- **`core/ui/StatusBadge.tsx`** — `<StatusBadge sev="warn">{label}</StatusBadge>`. **The label is a
  child, never a key**: the component adds no `t()` call and so needs no i18n namespace, which keeps
  [zero-literal](../.claude/rules/i18n-zero-literal.md) a caller concern.

- **Two feature maps convert to value → `Severity`**, never value → class string:
  - `admin/ua-admin/helpers.ts` `TONE_CLASS` → the derived status carries a `Severity`;
    `StatusPill.tsx` renders through the core component.
  - `pricing/bonus-buy-inquiry/columns.tsx` `STATUS_TONE` (`A`/`I`/`D`/`X`).

- **Two collisions the build resolves rather than renames around:**
  1. `bonus-buy-inquiry/columns.tsx:83` already declares a **local** `StatusBadge` taking `code` +
     `label`. It becomes a thin wrapper — code → `Severity`, then the core component — not a renamed
     import.
  2. **Found while slicing, not in the spec:** `bonus-buy-inquiry/DetailModal.tsx:42` declares a
     **duplicate** `STATUS_TONE` with the same four keys and the same class strings, plus a separate
     `VALIDITY_TONE`. Both copies converge on the one `code → Severity` map — that duplication is
     precisely the drift this ticket exists to stop.

`mute` maps to `bg-muted text-muted-foreground`, which is also where ticket 088's eleven categorical
sites land, so neutral has exactly one spelling in the app.

## Spine reach

`core/ui/severity.ts` (new, pure) · `core/ui/StatusBadge.tsx` (new) · `admin/ua-admin/helpers.ts` +
`StatusPill.tsx` · `pricing/bonus-buy-inquiry/columns.tsx` + `DetailModal.tsx` · drive.

## Proof (→ `tdd` red-green cycles)

- [ ] `everySeverityRendersOneClassStringValidInBothThemes` — the map is exhaustive over the union
      and no entry carries a `dark:` variant · pure (`tsc` proves exhaustiveness; verify by drive
      until the runner lands)
- [ ] Drive ua-admin's user list in **both themes** — the four password-state pills read correctly
      with no theme-specific string · flow (`npm run dev`)
- [ ] Drive BBY Inquiry in **both themes** — the status badge renders identically in the Status
      column, the pinned identity cell **and** the detail modal, which is the assertion that proves
      the duplicate map is gone · flow (extend `tools/bby-inquiry-drive.mjs`)

## Boundaries

New shared `core/ui` primitive, pulled forward because ticket 088 blocks on it. **No i18n** — the
label is a child. No API, no nav change.

`VALIDITY_TONE` in `DetailModal` is **in scope to classify**: decide whether `live` / expired /
future is severity (and convert it) or categorical (and neutralise it under ticket 088's rule that
hue is reserved for severity). Do not leave it as a raw-palette map.

## Done when

`core/ui/StatusBadge` is the only place the badge idiom is spelled; ua-admin and BBY Inquiry render
through it in both themes; and `grep -rn "STATUS_TONE\|TONE_CLASS" src/` returns nothing.

## Blocked by

[084](084-pos-tokens-both-themes.md) — the `-050` / `-800` tiers must exist and be bridged before any
class string can compile.
