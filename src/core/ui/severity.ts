// The severity vocabulary and its one class string per shape (spec 082 D-5/D-6,
// ticket 086). The ua-admin helpers module arrived at this shape independently
// (`ok | warn | bad | muted`); two features share it, so under the
// feature-structure rule it graduates UP to core rather than being copied a third
// time. Feature-side maps carry value → `Severity`, never value → class string.
//
// Pure: no React, no i18n, no `@/` imports.

/**
 * The five words, fixed by spec 082 D-5 and used identically in the design notes:
 * `ok` = complete and went well · `go` = actively in motion · `warn` = needs a
 * human · `bad` = ended badly, terminally · `mute` = not recognised / neutral.
 *
 * `go` carries no consumer on the document pill rail today; its constituency is
 * the informational sites ticket 088 sweeps, plus a live validity window.
 */
export type Severity = 'ok' | 'go' | 'warn' | 'bad' | 'mute'

/**
 * Badge (tint) classes per severity — the ground + ink pair only; the shape
 * itself lives in `StatusBadge`.
 *
 * **No `dark:` variant on any entry**, and that is derived, not a simplification:
 * global.css R4 makes `-050` and `-800` ROLES ("the quiet ground of this family"
 * / "ink on that ground") whose absolute lightness swaps between themes. One
 * string is therefore correct in both. Adding a `dark:` twin here would break
 * dark, not refine it.
 *
 * `mute` is `bg-muted text-muted-foreground`, which is also where ticket 088's
 * eleven categorical (non-severity) sites land — neutral has one spelling.
 */
export const SEVERITY_BADGE: Record<Severity, string> = {
  ok: 'bg-success-050 text-success-800',
  go: 'bg-primary-050 text-primary-800',
  warn: 'bg-attention-050 text-attention-800',
  bad: 'bg-danger-050 text-danger-800',
  mute: 'bg-muted text-muted-foreground',
}
