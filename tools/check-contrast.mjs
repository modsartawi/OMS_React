// Contrast gate for oms-react (ticket 084 / spec 082 D-12.3).
//
// Turns spec 082's hand-measured contrast table into something that STAYS true.
// It parses the `:root` and `.dark` blocks of `src/app/global.css`, recomputes
// WCAG 2.x relative luminance from the token values themselves, and asserts
// every measured pair still clears its threshold. The input is the token values,
// so it fails on a VALUE edit — not on a code edit.
//
// Same shape as `tools/check-boundaries.mjs`, its prior art: a plain node
// script, no runner, no dependencies, `file:line` hits, exit non-zero.
//
// Two kinds of assertion:
//   - POSITIVE (`min`): this pair must clear its threshold. 4.5:1 for body text,
//     3:1 for large text / UI / non-text graphics.
//   - NEGATIVE (`below`): this pair must FAIL. Only used for white ink on the
//     lifted dark chromatic fills. Under D-3 R2 every dark chromatic fill is a
//     light tonal fill carrying DARK ink; white measures ~2.2:1 on them. Without
//     this assertion a later reader "fixes" the apparent oddity by reverting
//     `--primary-foreground` to white and silently ships unreadable buttons.

import { readFileSync } from 'node:fs'

const CSS = 'src/app/global.css'
const BODY = 4.5 // WCAG AA, normal text
const UI = 3.0 // WCAG AA, large text / UI components / non-text graphics

// --- parse -------------------------------------------------------------------

const source = readFileSync(CSS, 'utf8')
const lines = source.split('\n')

// Token declarations per theme, with the line each was declared on. `.dark`
// inherits every token it does not itself redeclare (that is how the cascade
// resolves it in the browser), so the dark table starts as a copy of light.
function parseBlock(selector) {
  const out = new Map()
  // The selector may open more than one block (`:root` is declared twice — the
  // main table and the brand pair); collect all of them.
  const re = new RegExp(`(^|\\n)${selector.replace('.', '\\.')}\\s*\\{`, 'g')
  let open
  while ((open = re.exec(source)) !== null) {
    const start = open.index + open[0].length
    const end = source.indexOf('}', start)
    if (end === -1) continue
    const block = source.slice(start, end)
    const startLine = source.slice(0, start).split('\n').length
    for (const [i, line] of block.split('\n').entries()) {
      const m = /^\s*(--[\w-]+)\s*:\s*([^;]+);/.exec(line)
      if (m) out.set(m[1], { raw: m[2].trim(), line: startLine + i })
    }
  }
  return out
}

const rootTokens = parseBlock(':root')
const darkTokens = new Map([...rootTokens, ...parseBlock('.dark')])
const THEMES = { light: rootTokens, dark: darkTokens }

// Resolve a token to a hex triple, following `var(--other)` aliases
// (`--destructive` is declared as `var(--danger)` and must measure as danger).
function resolve(theme, name, seen = new Set()) {
  const decl = THEMES[theme].get(name)
  if (!decl) fail(`token ${name} is not declared in the ${theme} table`)
  const alias = /^var\(\s*(--[\w-]+)\s*\)$/.exec(decl.raw)
  if (alias) {
    if (seen.has(name)) fail(`token ${name} aliases itself in a cycle`)
    return resolve(theme, alias[1], seen.add(name))
  }
  if (!/^#[0-9a-fA-F]{6}$/.test(decl.raw)) {
    fail(`${CSS}:${decl.line} — ${name} is "${decl.raw}"; D-1 requires a 6-digit hex`)
  }
  return { hex: decl.raw.toLowerCase(), line: decl.line }
}

const errors = []
function fail(message) {
  errors.push(message)
  return { hex: '#000000', line: 0 }
}

// --- WCAG 2.x relative luminance --------------------------------------------

function luminance(hex) {
  const channels = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
  const [r, g, b] = channels.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function ratio(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

// --- the assertion table (spec 082 D-4 + D-6, transcribed once) --------------

const WHITE = '#ffffff'

// Body ink on every surface it can land on.
const SURFACES = ['--card', '--background', '--muted', '--card-2']
const positives = [
  ...SURFACES.map((s) => ['--foreground', s, BODY]),
  ['--foreground', '--sidebar', BODY],
  ['--sidebar-foreground', '--sidebar', BODY],
  ['--sidebar-foreground', '--sidebar-accent', BODY],
  ['--accent-foreground', '--accent', BODY],
  // Secondary ink on card/background/muted — the 358-use swap.
  ...['--card', '--background', '--muted'].map((s) => ['--muted-foreground', s, BODY]),
  // Tertiary ink is sub-AA BY DESIGN in both themes (D-4), so it is held only
  // to the UI floor, and only on `--card` — the pair D-4 measures. It sits at
  // 2.92:1 on `--background`, which is why `--ink-3` is for de-emphasised
  // supporting text on a panel and is not a general body-ink token.
  ['--ink-3', '--card', UI],
  // `--primary` used as text, and as the fill under its own ink.
  ['--primary', '--card', BODY],
  ['--primary', '--background', BODY],
  ['--primary-foreground', '--primary', BODY],
  ['--sidebar-active', '--sidebar', BODY],
  // The neutral filled button (D-2's revived `--secondary`) and its press state.
  ['--secondary-foreground', '--secondary', BODY],
  ['--secondary-foreground', '--secondary-press', BODY],
  // D-6's filled chip: ink on a chromatic fill. `--attention` is absent HERE on
  // purpose — D-4 forbids it as a LIGHT fill ground because no ink clears AA on
  // it (white 3.69, --foreground 4.31); in light it is a pill/border/icon/dot
  // only. Dark is unaffected and IS guarded, in `darkOnly` below.
  ['--primary-foreground', '--success', BODY],
  ['--primary-foreground', '--danger', BODY],
  ['--destructive-foreground', '--destructive', BODY],
  // D-8's two command families carry a label on their fill.
  ['--primary-foreground', '--fam-fulfilment', BODY],
  ['--primary-foreground', '--fam-cancel-request', BODY],
  // R4's whole point: each `-800` is legible on its own `-050`, in BOTH themes,
  // from ONE class string. This is what lets the sweep delete every `dark:`.
  ...['primary', 'success', 'attention', 'danger', 'prescription'].map((f) => [
    `--${f}-800`,
    `--${f}-050`,
    BODY,
  ]),
  // D-6's bare-ink shape: `-800` directly on a page surface, no tinted ground.
  ...['primary', 'success', 'attention', 'danger'].flatMap((f) =>
    ['--card', '--background', '--muted'].map((s) => [`--${f}-800`, s, BODY]),
  ),
  // D-6's bare-fill shape (dot, bar, meter) — a non-text graphic, 3:1.
  ...['primary', 'success', 'attention', 'danger', 'fam-fulfilment', 'fam-cancel-request'].map(
    (f) => [`--${f}`, '--card', UI],
  ),
  ...['primary', 'success', 'attention', 'danger'].map((f) => [`--${f}`, '--background', UI]),
  // The focus ring must stay visible against the surfaces it rings, including
  // the filled primary button it lands on when tabbed to (user story 14).
  ['--ring', '--background', UI],
  ['--ring', '--card', UI],
  // D-9's brand panel — one pair, no dark counterpart, white ink fixed.
  ['--brand-panel-foreground', '--brand-panel', BODY],
]

// Pairs that exist in dark only. D-4 rules `--attention` out as a fill ground in
// LIGHT ("the hue sits at the luminance where no ink clears AA") but measures the
// lifted dark twin as fine — "Dark is unaffected (the lifted #E4A249 carries dark
// ink at 7.83)". Guarding it here keeps that documented pair from drifting: dark
// `--attention` may be lifted or re-hued, but not below its own ink.
const darkOnly = [
  ['--primary-foreground', '--attention', BODY],
  ['--primary-foreground', '--prescription', BODY],
]

// The negative assertion. R2 is not a preference — white genuinely fails on
// every lifted dark chromatic fill, and this proves it rather than asserting it.
const negatives = [
  '--primary',
  '--success',
  '--attention',
  '--danger',
  '--secondary',
  '--secondary-press',
  '--fam-fulfilment',
  '--fam-cancel-request',
  '--prescription',
]

// --- the `@theme inline` bridge is complete ----------------------------------
//
// Declaring `--success-050` in `:root` is NOT enough to make `bg-success-050`
// compile — it also needs a `--color-success-050` line in `@theme inline`.
// That is the half of the palette change most easily left half-done, and it
// fails silently: the utility simply produces no CSS, so the element renders
// with a transparent ground and nobody sees an error.
//
// Every colour token therefore needs its bridge line. The non-colour tokens are
// the only exemptions, listed explicitly so a new one has to be considered
// rather than pattern-matched into silence.
const NOT_A_COLOUR = new Set(['--radius'])

const bridged = new Set(
  [...source.matchAll(/^\s*--color-([\w-]+)\s*:/gm)].map((m) => `--${m[1]}`),
)
const unbridged = [...rootTokens.entries()].filter(
  ([name]) => !NOT_A_COLOUR.has(name) && !bridged.has(name),
)
for (const [name, decl] of unbridged) {
  errors.push(
    `${CSS}:${decl.line} — ${name} has no \`--color-${name.slice(2)}\` line in \`@theme inline\`; ` +
      `its utility will not compile`,
  )
}

// --- run ---------------------------------------------------------------------

const failures = []
let checked = 0

for (const theme of ['light', 'dark']) {
  const pairs = theme === 'dark' ? [...positives, ...darkOnly] : positives
  for (const [inkName, groundName, threshold] of pairs) {
    const ink = resolve(theme, inkName)
    const ground = resolve(theme, groundName)
    const r = ratio(ink.hex, ground.hex)
    checked++
    if (r < threshold) {
      failures.push({
        line: ink.line,
        what: `${theme}: ${inkName} on ${groundName}`,
        detail: `${r.toFixed(2)}:1 — below the ${threshold}:1 floor (${ink.hex} on ${ground.hex})`,
      })
    }
  }
}

for (const fillName of negatives) {
  const fill = resolve('dark', fillName)
  const r = ratio(WHITE, fill.hex)
  checked++
  if (r >= BODY) {
    failures.push({
      line: fill.line,
      what: `dark: white ink on ${fillName}`,
      detail:
        `${r.toFixed(2)}:1 — expected BELOW ${BODY}:1. D-3 R2 lifts every dark chromatic ` +
        `fill into the L .66–.76 band precisely so it carries DARK ink; a fill that ` +
        `takes white ink has left the band and the theme's ink rule no longer holds.`,
    })
  }
}

if (errors.length > 0) {
  console.error(`\n✖ ${errors.length} token table problem(s):\n`)
  for (const e of errors) console.error(`  ${e}`)
  console.error('')
  process.exit(1)
}

if (failures.length > 0) {
  console.error(`\n✖ ${failures.length} contrast violation(s):\n`)
  for (const f of failures) console.error(`  ${CSS}:${f.line}\n    ${f.what}\n    ${f.detail}\n`)
  console.error('See .issues/082-pos-design-system-spec.md (D-3, D-4) for the derivation rules.\n')
  process.exit(1)
}

console.log(`✓ contrast gate clean (${checked} pairs measured across both themes)`)
