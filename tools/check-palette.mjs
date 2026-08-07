// Colour-literal gate for oms-react (ticket 089 / spec 082 D-12.1 + D-12.2).
//
// The completion criterion for the POS design system: a colour may be written in exactly one
// place — `src/app/global.css` — and everything else in `src/` reads a token. Without this gate
// the sweep of tickets 085 / 087 / 088 unravels one commit at a time, because the severity layer
// was never untokenised by oversight; it was untokenised because there was nowhere to put it.
//
// Same shape as its prior art `tools/check-boundaries.mjs`: a plain node script, no runner, no
// dependencies, `file:line` hits, exit non-zero.
//
// Three patterns, one pass:
//   1. PALETTE  — a raw Tailwind palette class (`bg-emerald-500`, `text-slate-400`, …).
//   2. LITERAL  — a Tailwind arbitrary colour value (`text-[#FDC801]`) or a `white`/`black`
//                 colour utility, which are palette literals that carry no palette name.
//   3. HEX      — a bare hex anywhere in a source file, including a TypeScript string.
//
// On (3), spec 082 D-12 gives the pattern `-\[#`, which matches only Tailwind arbitrary values —
// but claims the result is that `src/` "contains no colour literal of any kind". A hex in a `.ts`
// string (exactly the form of the two `cellStyle` values ticket 085 removed) would have passed.
// Ticket 089's open question resolved this by widening the pattern to make the claim true: the one
// place this app has ever hidden a colour literal was a `.ts` string, not a class attribute, and
// the whole value of the gate is that the rule stops depending on a reviewer noticing.

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, sep } from 'node:path'

const SRC = 'src'
const toPosix = (p) => p.split(sep).join('/')

// The files where a colour literal is the correct thing to write. Each is excluded whole, not line
// by line, because that is the shape of the permission: these files ARE the colour.
const COLOUR_SOURCES = new Map([
  ['src/app/global.css', 'the token table — the single place a colour value is authored'],
  [
    'src/assets/Al-Dawaa-Pharmacies-01.svg',
    'the al-dawaa mark — brand gold and navy live only here (ticket 087)',
  ],
  // The printed facsimiles (spec 249's documented three-rule exception, established by ticket
  // 251 and extended to the ACR by 252). These are not screens: they reproduce a paper form
  // the WPF also prints, and the
  // form's own ink — the `#C00000` of the خصم فائض rule, the `#EDEDF2` digit-cell fill, the
  // `#8A8A8A` dot leaders, the `#B00020` of the ACR's mismatch mark — IS the document. A token
  // would make the web sheet drift from the
  // paper one the moment a theme moved, which is the one thing these files exist to prevent.
  // They are also theme-independent by construction: a document prints on white paper in black
  // ink, in either theme. NOT a precedent for a screen — the chrome around these documents
  // (`ReceiptPrintPage`, `AcrPrintPage`, `PrintMiss`) holds no exception at all, and neither do
  // the documents' own components: every colour on both sheets lives in a stylesheet below, so a
  // colour creeping into the markup still trips the gate.
  [
    'src/features/collection/inquiry/print-sheet.css',
    'the A4 sheet both documents land on — paper white, the form’s frame (tickets 251/252)',
  ],
  [
    'src/features/collection/inquiry/collection-voucher.css',
    'the سند قبض facsimile — the paper form’s own ink (ticket 251)',
  ],
  [
    'src/features/collection/inquiry/collection-acr.css',
    'the ACR facsimile — the paper form’s own ink, mismatch red included (ticket 252)',
  ],
])

// Sites where a literal is deliberate and must NOT be tokenised. Each carries its reason inline so
// a later reader neither deletes it as noise nor widens it by precedent. Keyed by file + the exact
// class, not by line number, so ordinary edits above them don't rot the list.
const ALLOWED = [
  {
    file: 'src/core/ui/Modal.tsx',
    match: 'bg-black/50',
    why: 'modal scrim — a scrim is black in both themes by intent, it is not a themed surface',
  },
  {
    file: 'src/features/oms/deliveries/ViewManager.tsx',
    match: 'bg-black/50',
    why: 'modal scrim — same intent as core/ui/Modal',
  },
  {
    file: 'src/layout/AppShell.tsx',
    match: 'bg-black/50',
    why: 'mobile-nav scrim — same intent as core/ui/Modal',
  },
  {
    file: 'src/features/auth/LoginPage.tsx',
    match: 'bg-white',
    why: 'QR quiet zone — a QR needs a white module ground to scan, in either theme',
  },
]

const GATES = [
  {
    id: 'palette',
    re: /\b(?:bg|text|border|from|to|via|ring|fill|stroke|divide|outline)-(?:red|rose|amber|orange|emerald|green|blue|sky|violet|slate)-\d+/g,
    why: 'raw Tailwind palette class — use a semantic token (see src/app/global.css)',
  },
  {
    id: 'literal',
    re: /-\[#[0-9a-fA-F]{3,8}\]|\b(?:bg|text|border|from|to|via|ring|fill|stroke|divide|outline)-(?:white|black)\b/g,
    why: 'colour literal in a class — use a semantic token (see src/app/global.css)',
  },
  {
    id: 'hex',
    re: /#[0-9a-fA-F]{3,8}\b/g,
    why: 'hex colour value — colours are authored only in src/app/global.css',
  },
]

function walk(dir, acc = []) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry)
    if (statSync(p).isDirectory()) walk(p, acc)
    else if (/\.(ts|tsx|css|svg)$/.test(entry)) acc.push(toPosix(p))
  }
  return acc
}

const files = walk(SRC)
const violations = []

for (const file of files) {
  if (COLOUR_SOURCES.has(file)) continue
  const lines = readFileSync(file, 'utf8').split('\n')
  lines.forEach((text, i) => {
    const reported = [] // [start, end) spans already reported on this line
    for (const gate of GATES) {
      gate.re.lastIndex = 0
      for (const m of text.matchAll(gate.re)) {
        const [start, end] = [m.index, m.index + m[0].length]
        // The allowed class may be longer than the match (the gate matches `bg-black` inside
        // `bg-black/50`), so compare from the match's own position in the line.
        const allowed = ALLOWED.some((a) => a.file === file && text.startsWith(a.match, start))
        // `bg-[#fff]` trips the literal gate and the hex gate at overlapping positions — one site,
        // one report.
        const already = reported.some(([s, e]) => start < e && end > s)
        if (allowed || already) continue
        reported.push([start, end])
        violations.push({ file, line: i + 1, hit: m[0], gate: gate.id, why: gate.why })
      }
    }
  })
}

if (violations.length > 0) {
  console.error(`\n✖ ${violations.length} colour-literal violation(s):\n`)
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line}\n    ${v.hit}  [${v.gate}]\n    ${v.why}\n`)
  }
  console.error('See spec 082 D-12 — a colour is authored in src/app/global.css and nowhere else.\n')
  process.exit(1)
}

console.log(
  `✓ no colour literals outside the token table (${files.length} files, ${ALLOWED.length} documented exclusions)`,
)
