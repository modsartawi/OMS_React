// Grid-base gate for oms-react (spec 380 F25, ticket 383; measured in 378 §1–§2).
//
// Refuses any file that mounts `<AgGridReact` without the core base `defaultColDef`
// (`OMS_GRID_BASE_COL_DEF`, `src/core/theme/grid-base.tsx`). The base carries the cell renderer
// that bidi-isolates every value; a grid without it mirrors under RTL with its values reversed
// (`10:00 - 08:00`, `…966+`). An opt-in is exactly what failed for direction — 5 of 22 grids
// never spread the old `omsGridDirection` — so the opt-in is checked here, not remembered.
//
// For every `<AgGridReact …>` element the gate reads its `defaultColDef={…}` and follows the
// expression to a definition that spreads the base (`...OMS_GRID_BASE_COL_DEF`) or IS it. It
// follows what this codebase actually writes, a few hops deep:
//   defaultColDef={DEFAULTS}                         → a local or imported const
//   defaultColDef={defaultColDef}                    → const defaultColDef = useMemo(() => build(…))
//   build(…)                                         → an imported `function build() { return { … } }`
// The file holding the spread must import the base from `@/core/theme/grid-base`, so a local
// look-alike does not pass.
//
// Deliberately dependency-free, like check-boundaries.mjs: a small bracket-aware scanner, no
// TypeScript compiler. Anything it cannot parse is reported, never passed. Before checking the
// tree it runs its own fixtures (a bare mount, a defaultColDef that never reaches the base, a
// look-alike base, and two shapes that do reach it), so a scanner regression fails loudly here
// rather than letting every grid through.
//
//   node tools/check-grid-base.mjs          (part of `npm run lint`)

import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname, sep } from 'node:path'

const BASE = 'OMS_GRID_BASE_COL_DEF'
const BASE_MODULE = '@/core/theme/grid-base'
const MOUNT = '<AgGridReact'
const MAX_HOPS = 5

const toPosix = (p) => p.split(sep).join('/')

function walk(dir, acc = []) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry)
    if (statSync(p).isDirectory()) walk(p, acc)
    else if (/\.(ts|tsx)$/.test(entry)) acc.push(toPosix(p))
  }
  return acc
}

// ---- a bracket-aware scanner ------------------------------------------------------------------

class ParseError extends Error {}

// Index just past the end of a comment starting at `i`, or `i` when there is none.
function skipComment(s, i) {
  if (s[i] !== '/') return i
  if (s[i + 1] === '/') {
    const end = s.indexOf('\n', i)
    return end < 0 ? s.length : end
  }
  if (s[i + 1] === '*') {
    const end = s.indexOf('*/', i + 2)
    if (end < 0) throw new ParseError('unterminated comment')
    return end + 2
  }
  return i
}

// Index just past the string or template literal opening at `i`.
function skipString(s, i) {
  const q = s[i]
  for (let j = i + 1; j < s.length; j++) {
    if (s[j] === '\\') {
      j++
      continue
    }
    if (q === '`' && s[j] === '$' && s[j + 1] === '{') {
      j = closeOf(s, j + 1) - 1
      continue
    }
    if (s[j] === q) return j + 1
    if (q !== '`' && s[j] === '\n') throw new ParseError('unterminated string')
  }
  throw new ParseError('unterminated string')
}

const PAIRS = { '{': '}', '(': ')', '[': ']' }

// Index just past the bracket that closes the one at `open`.
function closeOf(s, open) {
  const stack = []
  for (let i = open; i < s.length; i++) {
    const afterComment = skipComment(s, i)
    if (afterComment !== i) {
      i = afterComment - 1
      continue
    }
    const c = s[i]
    if (c === '"' || c === "'" || c === '`') {
      i = skipString(s, i) - 1
      continue
    }
    if (PAIRS[c]) stack.push(PAIRS[c])
    else if (c === '}' || c === ')' || c === ']') {
      if (stack.pop() !== c) throw new ParseError(`unbalanced '${c}'`)
      if (stack.length === 0) return i + 1
    }
  }
  throw new ParseError('unbalanced brackets')
}

// The attributes of the JSX element opening at `at` (`<AgGridReact…`): name → expression text.
// A spread attribute (`{...x}`) is recorded under `...`.
function attributesOf(s, at) {
  let i = at + MOUNT.length
  // A type argument: `<AgGridReact<(typeof rows)[number]>`.
  if (s[i] === '<') {
    let depth = 0
    for (; i < s.length; i++) {
      if (PAIRS[s[i]]) {
        i = closeOf(s, i) - 1
        continue
      }
      if (s[i] === '<') depth++
      else if (s[i] === '>' && --depth === 0) {
        i++
        break
      }
    }
  }
  const attrs = new Map()
  while (i < s.length) {
    const afterComment = skipComment(s, i)
    if (afterComment !== i) {
      i = afterComment
      continue
    }
    const c = s[i]
    if (/\s/.test(c)) {
      i++
      continue
    }
    if (c === '>' || (c === '/' && s[i + 1] === '>')) return attrs
    if (c === '{') {
      const end = closeOf(s, i)
      attrs.set('...', [...(attrs.get('...') ?? []), s.slice(i + 1, end - 1)])
      i = end
      continue
    }
    const name = /^[A-Za-z_$][\w$-]*/.exec(s.slice(i))?.[0]
    if (!name) throw new ParseError(`unexpected '${c}' in <AgGridReact>`)
    i += name.length
    while (/\s/.test(s[i])) i++
    if (s[i] !== '=') {
      attrs.set(name, 'true')
      continue
    }
    i++
    while (/\s/.test(s[i])) i++
    if (s[i] === '{') {
      const end = closeOf(s, i)
      attrs.set(name, s.slice(i + 1, end - 1))
      i = end
    } else if (s[i] === '"' || s[i] === "'") {
      const end = skipString(s, i)
      attrs.set(name, s.slice(i, end))
      i = end
    } else throw new ParseError(`unreadable value for ${name}`)
  }
  throw new ParseError('unterminated <AgGridReact>')
}

// The initializer expression starting at `i` (just past a declaration's `=`), up to the end of
// its statement. The codebase writes no semicolons, so a statement ends at a depth-0 newline
// unless the expression visibly continues on either side of it.
function expressionAt(s, i) {
  const start = i
  for (; i < s.length; i++) {
    const afterComment = skipComment(s, i)
    if (afterComment !== i) {
      i = afterComment - 1
      continue
    }
    const c = s[i]
    if (c === '"' || c === "'" || c === '`') {
      i = skipString(s, i) - 1
      continue
    }
    if (PAIRS[c]) {
      i = closeOf(s, i) - 1
      continue
    }
    if (c === ';' || c === ')' || c === '}' || c === ']') return s.slice(start, i)
    if (c === '\n') {
      const before = s.slice(start, i).trimEnd()
      const after = s.slice(i).trimStart()
      const continues =
        before === '' ||
        /(=>|[=(,&|?:+\-*/<])$/.test(before) ||
        /^([.?:&|+\-*/,)\]}]|as\b|satisfies\b)/.test(after)
      if (!continues) return s.slice(start, i)
    }
  }
  return s.slice(start)
}

// ---- resolution -------------------------------------------------------------------------------

function makeChecker(root) {
  const sources = new Map()
  const read = (file) => {
    if (!sources.has(file)) sources.set(file, readFileSync(file, 'utf8'))
    return sources.get(file)
  }

  function resolveModule(spec, fromFile) {
    let base
    if (spec.startsWith('@/')) base = `${root}/${spec.slice(2)}`
    else if (spec.startsWith('./') || spec.startsWith('../')) {
      const parts = []
      for (const part of `${dirname(fromFile)}/${spec}`.split('/')) {
        if (part === '.' || part === '') continue
        if (part === '..') parts.pop()
        else parts.push(part)
      }
      base = parts.join('/')
    } else return null
    for (const ext of ['', '.ts', '.tsx', '/index.ts', '/index.tsx']) {
      if (existsSync(base + ext) && statSync(base + ext).isFile()) return base + ext
    }
    return null
  }

  // name → { name in the source module, spec } for every named or default import.
  function importsOf(s) {
    const map = new Map()
    for (const m of s.matchAll(/import\s+(?:type\s+)?([\w$]+)?\s*,?\s*(?:\{([^}]*)\})?\s*from\s*['"]([^'"]+)['"]/g)) {
      const [, def, named, spec] = m
      if (def && def !== 'type') map.set(def, { name: 'default', spec })
      for (const part of (named ?? '').split(',')) {
        const [orig, alias] = part.replace(/^\s*type\s+/, '').trim().split(/\s+as\s+/)
        if (orig) map.set((alias ?? orig).trim(), { name: orig.trim(), spec })
      }
    }
    return map
  }

  // The text that defines `name` in `file` — a const/let initializer or a function body.
  function definitionIn(name, file) {
    const s = read(file)
    const decl = new RegExp(`(?:^|\\n)[ \\t]*(?:export\\s+)?(?:const|let|var)\\s+${name}\\b`).exec(s)
    if (decl) {
      // Past any type annotation to the `=` that is not part of `=>`, `==`, `<=`…
      let i = decl.index + decl[0].length
      for (; i < s.length; i++) {
        if (PAIRS[s[i]]) i = closeOf(s, i) - 1
        else if (s[i] === '=' && s[i + 1] !== '>' && s[i + 1] !== '=' && !'=!<>'.includes(s[i - 1])) break
        else if (s[i] === '\n' && !/^\s*[:|&<]/.test(s.slice(i + 1))) {
          // A declaration line with no initializer on it and no type continuing.
          const line = s.slice(decl.index, i)
          if (!line.includes(':')) return null
        }
      }
      return expressionAt(s, i + 1)
    }
    const fn = new RegExp(`(?:^|\\n)[ \\t]*(?:export\\s+)?(?:default\\s+)?function\\s+${name}\\s*[<(]`).exec(s)
    if (fn) {
      let i = fn.index + fn[0].length - 1
      if (s[i] === '<') i = s.indexOf('(', i)
      i = closeOf(s, i)
      const body = s.indexOf('{', i)
      return s.slice(body, closeOf(s, body))
    }
    return null
  }

  const IGNORED = new Set([
    'useMemo', 'useCallback', 'const', 'let', 'return', 'true', 'false', 'null', 'undefined',
    'as', 'satisfies', 'typeof', 'new', 'function', 'if', 'else', 'ColDef',
  ])

  // Does `text`, written in `file`, reach the core base within `hops` definitions?
  function reaches(text, file, hops, seen) {
    const imports = importsOf(read(file))
    const fromCore = imports.get(BASE)?.spec === BASE_MODULE
    if (fromCore && (text.trim() === BASE || new RegExp(`\\.\\.\\.\\s*${BASE}\\b`).test(text))) return true
    if (hops >= MAX_HOPS) return false
    for (const [ident] of text.matchAll(/[A-Za-z_$][\w$]*/g)) {
      if (IGNORED.has(ident) || ident === BASE) continue
      let target = file
      let targetName = ident
      const imported = imports.get(ident)
      if (imported) {
        target = resolveModule(imported.spec, file)
        targetName = imported.name
        if (!target || targetName === 'default') continue
      }
      const key = `${target}#${targetName}`
      if (seen.has(key)) continue
      seen.add(key)
      const def = definitionIn(targetName, target)
      if (def !== null && reaches(def, target, hops + 1, seen)) return true
    }
    return false
  }

  // Where `file` mounts a grid. A mention in a comment or a string is not a mount, and
  // `<AgGridReact` followed by a name character is some other component.
  function mountsIn(file) {
    const s = read(file)
    const at = []
    for (let i = s.indexOf(MOUNT); i >= 0; i = s.indexOf(MOUNT, i + 1)) {
      const lineBefore = s.slice(s.lastIndexOf('\n', i) + 1, i)
      if (/^\s*(\*|\/\*)/.test(lineBefore) || lineBefore.includes('//') || /[`'"]$/.test(lineBefore)) continue
      if (/[\w$]/.test(s[i + MOUNT.length] ?? '')) continue
      at.push(i)
    }
    return at
  }

  // Every mount in `file` that does not reach the base, with why.
  function check(file) {
    const s = read(file)
    const found = []
    for (const at of mountsIn(file)) {
      const line = s.slice(0, at).split('\n').length
      try {
        const expr = attributesOf(s, at).get('defaultColDef')
        if (expr === undefined) found.push({ file, line, why: `mounts ${MOUNT} with no defaultColDef` })
        else if (!reaches(expr, file, 0, new Set()))
          found.push({ file, line, why: `defaultColDef={${expr.trim()}} never spreads ${BASE}` })
      } catch (e) {
        if (!(e instanceof ParseError)) throw e
        found.push({ file, line, why: `could not read the ${MOUNT} element (${e.message})` })
      }
    }
    return found
  }

  return { check, mounts: (file) => mountsIn(file).length }
}

// ---- self-test --------------------------------------------------------------------------------

const IMPORT_BASE = `import { ${BASE} } from '${BASE_MODULE}'\n`
const FIXTURES = {
  'cols.ts': `${IMPORT_BASE}
export function buildDefaults(showFilters: boolean): ColDef<Row> {
  return {
    ...${BASE},
    floatingFilter: showFilters,
  }
}
export const PLAIN_DEFAULTS: ColDef<Row> = {
  sortable: true,
}
`,
  'BadNoDefault.tsx': `export default function A() {
  return <AgGridReact theme={t} rowData={rows} columnDefs={columns} />
}
`,
  'BadNeverSpreads.tsx': `import { PLAIN_DEFAULTS } from './cols'
export default function B() {
  return <AgGridReact<Row> defaultColDef={PLAIN_DEFAULTS} rowData={rows} />
}
`,
  'BadLookAlike.tsx': `const ${BASE} = { sortable: true }
const DEFAULTS = { ...${BASE} }
export default function C() {
  return <AgGridReact defaultColDef={DEFAULTS} />
}
`,
  'GoodBuilder.tsx': `import { useMemo } from 'react'
import { buildDefaults } from './cols'
export default function D({ showFilters }: { showFilters: boolean }) {
  const defaultColDef = useMemo(() => buildDefaults(showFilters), [showFilters])
  return (
    <AgGridReact<(typeof rows)[number]>
      theme={t}
      defaultColDef={defaultColDef}
      // Community's own pager — an apostrophe in a comment must not derail the scanner.
      pagination
      onRowClicked={(e) => e.data && go(e.data)}
      {...extra}
    />
  )
}
`,
  'GoodLocal.tsx': `${IMPORT_BASE}
const DEFAULT_COL_DEF: ColDef<Row> = {
  ...${BASE},
  sortable: true,
}
export default function E() {
  return <AgGridReact defaultColDef={DEFAULT_COL_DEF} />
}
`,
  'GoodBare.tsx': `${IMPORT_BASE}
// A comment naming ${MOUNT} is not a mount.
/** Nor is \`${MOUNT}\` in a doc comment. */
export default function F() {
  return <AgGridReact defaultColDef={${BASE}} />
}
`,
}
const SHOULD_FAIL = ['BadNoDefault.tsx', 'BadNeverSpreads.tsx', 'BadLookAlike.tsx']

function selfTest() {
  const dir = toPosix(mkdtempSync(join(tmpdir(), 'check-grid-base-')))
  try {
    mkdirSync(dir, { recursive: true })
    for (const [name, text] of Object.entries(FIXTURES)) writeFileSync(`${dir}/${name}`, text)
    const { check } = makeChecker(dir)
    const failing = Object.keys(FIXTURES)
      .filter((n) => n.endsWith('.tsx'))
      .filter((n) => check(`${dir}/${n}`).length > 0)
      .sort()
    const want = [...SHOULD_FAIL].sort()
    if (JSON.stringify(failing) !== JSON.stringify(want)) {
      console.error(`\n✖ grid-base gate self-test: refused [${failing.join(', ')}], expected [${want.join(', ')}]\n`)
      process.exit(1)
    }
    return Object.keys(FIXTURES).filter((n) => n.endsWith('.tsx')).length
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

// ---- the tree ---------------------------------------------------------------------------------

const fixtures = selfTest()
// The tree is `src` (where `@/` points); another root can be named for a one-off red run.
const root = toPosix(process.argv[2] ?? 'src')
const { check, mounts } = makeChecker(root)
const files = walk(root).filter((f) => mounts(f) > 0)
const violations = files.flatMap(check)
const mountCount = files.reduce((n, f) => n + mounts(f), 0)

if (violations.length > 0) {
  console.error(`\n✖ ${violations.length} grid mount(s) without the core base defaultColDef:\n`)
  for (const v of violations) console.error(`  ${v.file}:${v.line}\n    ${v.why}\n`)
  console.error(
    `Spread it first in the grid's defaultColDef: { ...${BASE}, … } from '${BASE_MODULE}'.\n` +
      'It is what isolates every cell value under RTL (spec 380 F25).\n',
  )
  process.exit(1)
}

console.log(
  `✓ every grid spreads the core base (${mountCount} mounts in ${files.length} files; self-test ${fixtures}/${fixtures})`,
)
