import type { RuleExpr } from '@/core/models/rule-campaign'

// The rule language's expression as text, and text read back (ticket 522). Pure, no React. HQ stores
// a named value and a formula as an operator-first JSON array (ADR 0089:
// `["round", ["*", "$eligible", 0.10], 0, "halfUp"]`); the guided ƒx helper (507) keeps a TEXT box,
// so this codec prints the array as text and reads the text back into the array. It is syntax only:
// whether a name, a path or a function exists is HQ's Validate to say.
//
// The grammar is the 2734 prototype's (engine.js `compile`), adapted to the real language (the
// SIS.Rules checker, BackOffice Tests/Data.Tests/Rules/Fixtures/five-2702.json):
//   12.5  -3            a number (a minus on a number literal is a negative number)
//   'G'                 a text
//   true  false
//   session.total       a path: "$session.total"; a bare name is a named value: back → "$back"
//   eligibility.benefit[GEN].copayPct, eligibility.tob[PHARM]
//                       a path segment may carry one bracketed key (oms 657: the guard's eligibility
//                       keys, `GuardEligibilityKeys`); a key holds no space, quote, bracket, comma,
//                       parenthesis or < > — so a `<code>` placeholder never reads
//   items('Eligible')   a filter of the rule, by its current name: ["items", "<filter id>"]
//   a + b  a >= b  a and b  not a  -a      infix and prefix: ["+", a, b], ["not", a], ["-", 0, a]
//   min(a, b)           any call: ["min", a, b]
//   round(x, 0, halfUp) the mode word bare: ["round", x, 0, "halfUp"]
//   band(x, 200:0.10)   thresholds: ["band", x, [[200, 0.1]]]
// A stored expression it cannot print faithfully is `null` from `printExpr`: the screen then shows
// its raw JSON, editable as JSON.

/** What the codec needs from the rule: its filters, to write `items(...)` by name. */
export interface ExprContext {
  filters: readonly { id: string; name: string }[]
}

/** Why a text cannot be read; `at` is the offset into the text. Machine words — the UI translates. */
export interface ExprProblem {
  code: 'empty' | 'unexpected' | 'unclosed' | 'unknownFilter' | 'roundArgs' | 'bandArgs' | 'pairOutsideBand'
  at: number
  token?: string
}

export type ExprRead = { ok: true; expr: RuleExpr } | { ok: false; problem: ExprProblem }

/** Binding powers of the infix operators (the prototype's). */
const BP: Record<string, number> = { or: 1, and: 2, '>': 3, '>=': 3, '<': 3, '<=': 3, '==': 3, '!=': 3, '+': 4, '-': 4, '*': 5, '/': 5 }
/** Above every infix operator: a prefix binds tighter than any of them. */
const PREFIX_BP = 6
const IDENT = /^[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)*$/
/** A bracketed key of a path segment (`benefit[GEN]`): what the tokenizer reads, and so what a path may print. */
const KEY = String.raw`\[[^\[\]\s'"<>(),]+\]`
const SEGMENT = String.raw`[A-Za-z_][A-Za-z0-9_]*(?:${KEY})?`
/** A path as it prints: dotted segments, each with at most one bracketed key. */
const PATH = new RegExp(String.raw`^${SEGMENT}(?:\.${SEGMENT})*$`)
const KEYWORDS = new Set(['and', 'or', 'not', 'true', 'false'])
/** The words the language keeps for itself: a name spelled like one cannot be read back. */
export const EXPR_KEYWORDS: ReadonlySet<string> = KEYWORDS

// ── Printing ─────────────────────────────────────────────────────────────────────────────────────

class Unprintable extends Error {}

const fail = (): never => {
  throw new Unprintable()
}

function printNumber(n: number): string {
  const text = String(n)
  // The language has no exponent: `1e-7` would read as `1`, then a name.
  if (!Number.isFinite(n) || /e/i.test(text)) fail()
  return text
}

function printText(s: string): string {
  if (s.includes("'")) fail()
  return `'${s}'`
}

function printPath(s: string): string {
  const name = s.slice(1)
  if (!PATH.test(name) || KEYWORDS.has(name)) fail()
  return name
}

/** One value as an operand: `bp` is the binding power of the operator around it. */
function print(e: RuleExpr, ctx: ExprContext, bp = 0, right = false): string {
  if (typeof e === 'number') {
    // A negative literal reads as one only where a prefix may stand.
    const text = printNumber(e)
    return e < 0 && bp > 0 ? `(${text})` : text
  }
  if (typeof e === 'boolean') return String(e)
  if (typeof e === 'string') return e.startsWith('$') ? printPath(e) : printText(e)
  if (!Array.isArray(e) || e.length === 0) return fail()
  const [op, ...args] = e
  if (typeof op !== 'string') return fail()
  if (op === 'items') {
    if (args.length !== 1 || typeof args[0] !== 'string') return fail()
    const id = args[0]
    const f = ctx.filters.find((x) => x.id === id)
    return `items(${printText(f ? f.name : id)})`
  }
  if (op === 'not' && args.length === 1) {
    const text = `not ${print(args[0], ctx, PREFIX_BP)}`
    return bp >= PREFIX_BP ? `(${text})` : text
  }
  if (op === '-' && args.length === 2 && args[0] === 0 && typeof args[1] !== 'number') {
    const text = `-${print(args[1], ctx, PREFIX_BP)}`
    return bp >= PREFIX_BP ? `(${text})` : text
  }
  if (op in BP && args.length === 2) {
    const p = BP[op]
    const text = `${print(args[0], ctx, p)} ${op} ${print(args[1], ctx, p, true)}`
    return p < bp || (right && p === bp) ? `(${text})` : text
  }
  if (!IDENT.test(op) || op.includes('.') || KEYWORDS.has(op)) return fail()
  if (op === 'band') {
    if (args.length !== 2 || !Array.isArray(args[1])) return fail()
    const pairs = (args[1] as RuleExpr[]).map((pair) => {
      if (!Array.isArray(pair) || pair.length !== 2) return fail()
      return `${print(pair[0], ctx)}:${print(pair[1], ctx)}`
    })
    return `band(${[print(args[0], ctx), ...pairs].join(', ')})`
  }
  if (op === 'round' && args.length === 3 && typeof args[2] === 'string' && !args[2].startsWith('$') && IDENT.test(args[2]) && !args[2].includes('.')) {
    return `round(${print(args[0], ctx)}, ${print(args[1], ctx)}, ${args[2]})`
  }
  return `${op}(${args.map((a) => print(a, ctx)).join(', ')})`
}

/** The expression as text, or null when it cannot be printed faithfully (shown as JSON instead). */
export function printExpr(expr: RuleExpr, ctx: ExprContext): string | null {
  try {
    return print(expr, ctx)
  } catch (e) {
    if (e instanceof Unprintable) return null
    throw e
  }
}

// ── Reading ──────────────────────────────────────────────────────────────────────────────────────

type Token = { t: 'num'; v: number; at: number } | { t: 'id'; v: string; at: number } | { t: 'str'; v: string; at: number } | { t: 'op'; v: string; at: number }

class Problem extends Error {
  constructor(readonly problem: ExprProblem) {
    super(problem.code)
  }
}

const problem = (code: ExprProblem['code'], at: number, token?: string): never => {
  throw new Problem(token === undefined ? { code, at } : { code, at, token })
}

function tokens(s: string): Token[] {
  const out: Token[] = []
  const re = new RegExp(String.raw`(\d+(?:\.\d+)?)|([A-Za-z_][A-Za-z0-9_.]*(?:${KEY}(?:\.[A-Za-z_][A-Za-z0-9_.]*)?)*)|('[^']*')|(>=|<=|==|!=|[-+*/(),:<>])`, 'y')
  let pos = 0
  for (;;) {
    while (pos < s.length && /\s/.test(s[pos])) pos++
    if (pos >= s.length) return out
    re.lastIndex = pos
    const m = re.exec(s)
    if (!m) {
      if (s[pos] === "'") problem('unclosed', pos, "'")
      problem('unexpected', pos, s[pos])
    }
    const at = pos
    pos = re.lastIndex
    if (m![1]) out.push({ t: 'num', v: Number(m![1]), at })
    else if (m![2]) out.push({ t: 'id', v: m![2], at })
    else if (m![3]) out.push({ t: 'str', v: m![3].slice(1, -1), at })
    else out.push({ t: 'op', v: m![4], at })
  }
}

/** An argument of a call: an expression, or a `a:b` pair (only `band` takes them). */
type Arg = { expr: RuleExpr; at: number } | { pair: [RuleExpr, RuleExpr]; at: number }

/** Reads `text` into the expression it writes, or the first problem with where it is. */
export function parseExpr(text: string, ctx: ExprContext): ExprRead {
  try {
    if (!text.trim()) problem('empty', 0)
    const toks = tokens(text)
    let i = 0
    const end = text.length
    const isOp = (v: string) => toks[i]?.t === 'op' && toks[i].v === v
    const expect = (v: string, open: number) => {
      if (isOp(v)) {
        i++
        return
      }
      if (!toks[i]) problem('unclosed', open, v === ')' ? '(' : v)
      problem('unexpected', toks[i].at, String(toks[i].v))
    }
    const infix = (): string | null => {
      const p = toks[i]
      if (!p) return null
      if (p.t === 'op' && p.v in BP) return p.v
      if (p.t === 'id' && (p.v === 'and' || p.v === 'or')) return p.v
      return null
    }
    const parse = (minbp: number): RuleExpr => {
      let left = prefix()
      for (;;) {
        const op = infix()
        if (!op || BP[op] <= minbp) break
        i++
        left = [op, left, parse(BP[op])]
      }
      return left
    }
    const call = (name: string, args: Arg[], at: number): RuleExpr => {
      const pairAt = args.findIndex((a, k) => 'pair' in a && !(name === 'band' && k > 0))
      if (pairAt >= 0) problem('pairOutsideBand', args[pairAt].at)
      const plain = (a: Arg) => ('expr' in a ? a.expr : problem('pairOutsideBand', a.at))
      if (name === 'band') {
        if (args.length < 2 || args.slice(1).some((a) => !('pair' in a))) problem('bandArgs', at)
        return ['band', plain(args[0]), args.slice(1).map((a) => ('pair' in a ? [a.pair[0], a.pair[1]] : []))]
      }
      if (name === 'items') {
        const only = args.length === 1 && 'expr' in args[0] ? args[0].expr : null
        if (typeof only !== 'string' || only.startsWith('$')) problem('unknownFilter', at)
        const ref = only as string
        const f = ctx.filters.find((x) => x.name.trim().toLowerCase() === ref.trim().toLowerCase()) ?? ctx.filters.find((x) => x.id === ref)
        if (!f) problem('unknownFilter', args[0].at, ref)
        return ['items', f!.id]
      }
      if (name === 'round') {
        if (args.length !== 3) problem('roundArgs', at)
        const mode = plain(args[2])
        return ['round', plain(args[0]), plain(args[1]), typeof mode === 'string' && mode.startsWith('$') ? mode.slice(1) : mode]
      }
      return [name, ...args.map(plain)]
    }
    const prefix = (): RuleExpr => {
      const t = toks[i++]
      if (!t) return problem(toks.length ? 'unclosed' : 'empty', end)
      if (t.t === 'num') return t.v
      if (t.t === 'str') return t.v
      if (t.t === 'op' && t.v === '-') {
        const n = toks[i]
        if (n?.t === 'num' && n.at === t.at + 1) {
          i++
          return -n.v
        }
        return ['-', 0, parse(PREFIX_BP - 0.5)]
      }
      if (t.t === 'op' && t.v === '(') {
        const e = parse(0)
        expect(')', t.at)
        return e
      }
      if (t.t === 'id') {
        if (t.v === 'not') return ['not', parse(PREFIX_BP - 0.5)]
        if (t.v === 'true') return true
        if (t.v === 'false') return false
        if (t.v === 'and' || t.v === 'or') return problem('unexpected', t.at, t.v)
        if (isOp('(')) {
          if (t.v.includes('.') || t.v.includes('[')) problem('unexpected', t.at, t.v)
          const open = toks[i].at
          i++
          const args: Arg[] = []
          if (!isOp(')')) {
            do {
              const at = toks[i]?.at ?? end
              const a = parse(0)
              if (isOp(':')) {
                i++
                args.push({ pair: [a, parse(0)], at })
              } else args.push({ expr: a, at })
            } while (isOp(',') && (i++, true))
          }
          expect(')', open)
          return call(t.v, args, t.at)
        }
        return `$${t.v}`
      }
      return problem('unexpected', t.at, t.v)
    }
    const out = parse(0)
    if (i < toks.length) problem('unexpected', toks[i].at, String(toks[i].v))
    return { ok: true, expr: out }
  } catch (e) {
    if (e instanceof Problem) return { ok: false, problem: e.problem }
    throw e
  }
}
