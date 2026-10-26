// Ticket 596 — the fifth lint gate's pure core (spec 590, Testing Decisions §3).
import { describe, expect, it } from 'vitest'

import { checkRatchet, featureOf, formatBaseline, lowerBaseline, parseBaseline, scanSource } from './control-ratchet.mjs'

const FILE = 'src/features/oms/deliveries/Panel.tsx'

describe('scanSource', () => {
  it('counts hand-written button, input, select and textarea, never the shared controls', () => {
    const src = `
      export function Panel() {
        return (
          <div>
            <button className="h-7 rounded-md px-3">x</button>
            <input className="border" />
            <select><option>a</option></select>
            <textarea rows={2} />
            <Button variant="outlined">y</Button>
            <Input type="search" />
            <Select />
            <Textarea />
            <IconButton label="z" />
          </div>
        )
      }`
    const rows = scanSource(src, FILE)
    expect(rows.map((r) => [r.tag, r.line])).toEqual([
      ['button', 5],
      ['input', 6],
      ['select', 7],
      ['textarea', 8],
    ])
  })

  it('leaves out the inputs spec 590 keeps native: checkbox, radio, hidden and file', () => {
    const src = `const A = () => <>
      <input type="checkbox" />
      <input type="radio" />
      <input type="hidden" />
      <input type="file" className="hidden" />
      <input type="number" />
      <input type={kind} />
    </>`
    expect(scanSource(src, FILE).map((r) => r.kind)).toEqual(['number', 'dynamic type'])
  })

  it('refuses a file it cannot parse, naming it, rather than counting it as clean', () => {
    expect(() => scanSource('const A = () => <div><input /></div><p/>', FILE)).toThrow(FILE)
  })

  it('reports the line of a control after non-ASCII text', () => {
    const src = "const s = 'عربي 😀'\nconst A = () => <button>x</button>"
    expect(scanSource(src, FILE)).toEqual([{ tag: 'button', kind: 'button', line: 2 }])
  })
})

describe('featureOf', () => {
  it('reads area/feature, a file directly under an area as the area, and skips prototypes', () => {
    expect(featureOf('src/features/oms/deliveries/grid/Toolbar.tsx')).toBe('oms/deliveries')
    expect(featureOf('src/features/auth/LoginPage.tsx')).toBe('auth')
    expect(featureOf('src/features/campaigns/workspace/__prototype__/Try.tsx')).toBeNull()
    expect(featureOf('src/core/ui/Button.tsx')).toBeNull()
    expect(featureOf('src/features/oms/deliveries/api.ts')).toBeNull()
  })
})

const BASELINE = `# header comment

campaigns/workspace 3

oms/deliveries 2
  src/features/oms/deliveries/ViewsRail.tsx button: my-views rows are a row picker
  src/features/oms/deliveries/QueryBar.tsx input
`

const row = (file, tag, line = 1) => ({ file, tag, kind: tag, line })
const byFeature = (obj) => new Map(Object.entries(obj))

describe('parseBaseline', () => {
  it('reads one ceiling per feature and the allowlisted controls under it, reason optional', () => {
    const { entries, errors } = parseBaseline(BASELINE)
    expect(errors).toEqual([])
    expect(entries.get('campaigns/workspace')).toMatchObject({ ceiling: 3, allow: [] })
    expect(entries.get('oms/deliveries').allow).toEqual([
      { file: 'src/features/oms/deliveries/ViewsRail.tsx', tag: 'button', reason: 'my-views rows are a row picker' },
      { file: 'src/features/oms/deliveries/QueryBar.tsx', tag: 'input', reason: '' },
    ])
  })

  it('reports a malformed line, a duplicate feature, and an allowlist that disagrees with its ceiling', () => {
    const { errors } = parseBaseline('a/b 2\n\na/b 1\n\nc/d x\n\ne/f 3\n  src/features/e/f/X.tsx button: one\n')
    expect(errors.map((e) => e.line)).toEqual([3, 5, 7])
  })
})

describe('checkRatchet', () => {
  const baseline = parseBaseline(BASELINE).entries
  const ws = 'src/features/campaigns/workspace/W.tsx'
  const views = 'src/features/oms/deliveries/ViewsRail.tsx'
  const query = 'src/features/oms/deliveries/QueryBar.tsx'

  it('passes at the baseline', () => {
    const r = checkRatchet(byFeature({
      'campaigns/workspace': [row(ws, 'button'), row(ws, 'input'), row(ws, 'select')],
      'oms/deliveries': [row(views, 'button'), row(query, 'input')],
    }), baseline)
    expect(r.failures).toEqual([])
    expect(r.lowerable).toEqual([])
  })

  it('fails when a feature rises above its ceiling, naming the feature', () => {
    const r = checkRatchet(byFeature({
      'campaigns/workspace': [row(ws, 'button'), row(ws, 'input'), row(ws, 'select'), row(ws, 'input', 40)],
    }), baseline)
    expect(r.failures).toHaveLength(1)
    expect(r.failures[0]).toContain('campaigns/workspace')
    expect(r.failures[0]).toContain('4 > 3')
  })

  it('fails a swept feature on a control its allowlist does not name, even at the same total', () => {
    const r = checkRatchet(byFeature({
      'oms/deliveries': [row(views, 'button'), row(views, 'input', 12)],
    }), baseline)
    expect(r.failures).toHaveLength(1)
    expect(r.failures[0]).toContain(`${views}:12`)
  })

  it('fails a feature missing from the baseline that carries any control (ceiling 0)', () => {
    const r = checkRatchet(byFeature({ 'reports/new': [row('src/features/reports/new/P.tsx', 'button', 7)] }), baseline)
    expect(r.failures).toHaveLength(1)
    expect(r.failures[0]).toContain('reports/new')
  })

  it('lists a feature that fell below its ceiling as lowerable, without failing', () => {
    const r = checkRatchet(byFeature({ 'campaigns/workspace': [row(ws, 'button')] }), baseline)
    expect(r.failures).toEqual([])
    expect(r.lowerable).toEqual([
      { feature: 'campaigns/workspace', from: 3, to: 1 },
      { feature: 'oms/deliveries', from: 2, to: 0 },
    ])
  })
})

describe('formatBaseline', () => {
  it('writes one block per feature, sorted, a blank line between blocks', () => {
    const text = formatBaseline(new Map([['oms/deliveries', 4], ['admin/data-sync', 12]]), '# head')
    expect(text).toBe('# head\n\nadmin/data-sync 12\n\noms/deliveries 4\n')
    expect(parseBaseline(text).entries.get('admin/data-sync').ceiling).toBe(12)
  })
})

describe('lowerBaseline', () => {
  const counts = new Map([['campaigns/workspace', 1], ['oms/deliveries', 0]])

  it('lowers an unswept ceiling to the count, keeping a swept-to-zero feature as `0`', () => {
    const text = 'campaigns/workspace 3\n\nreports/x 5\n'
    const out = lowerBaseline(text, new Map([['campaigns/workspace', 1], ['reports/x', 0]]))
    expect(out.text).toBe('campaigns/workspace 1\n\nreports/x 0\n')
    expect(out.lowered).toEqual(['campaigns/workspace 3 → 1', 'reports/x 5 → 0'])
  })

  it('never raises a ceiling, and only touches the features it is asked to', () => {
    const text = 'a/b 2\n\nc/d 5\n'
    const out = lowerBaseline(text, new Map([['a/b', 9], ['c/d', 1]]), ['a/b'])
    expect(out.text).toBe(text)
  })

  it('leaves a swept feature for its allowlist to be edited by hand', () => {
    const out = lowerBaseline(BASELINE, counts, ['oms/deliveries'])
    expect(out.text).toBe(BASELINE)
    expect(out.skipped).toEqual(['oms/deliveries'])
  })
})
