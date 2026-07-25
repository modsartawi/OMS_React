import { describe, expect, it } from 'vitest'
import {
  ELEMENT_COLUMNS,
  SHED_ORDER,
  TRACE_LEVELS,
  columnRole,
  elementColumns,
  traceLevel,
  traceMinWidth,
} from './element-columns'

/**
 * The elements trace's shed order (ticket 119, spec 110 §66/§67).
 *
 * The trace is the only table on the screen that can outgrow its column — it lives
 * *inside* the Results frame at 66% of the work area — so it is the only one that
 * sheds. The rule it sheds by is deliberately a **pure module** rather than CSS: the
 * claim worth guarding is "no numeric column is ever shed", and that is a one-line
 * assertion across every level here, versus a scan of three container-query `hidden`
 * variants spread through a table body.
 *
 * The failure mode this file exists for is a future column being appended to
 * `SHED_ORDER` without thinking — the sweeps below fail on that, whatever the column.
 */

describe('the trace sheds ctr first, then unit, and never a number', () => {
  it('sheds nothing at full, ctr at compact, ctr and unit at tight', () => {
    expect(elementColumns('full')).toEqual(ELEMENT_COLUMNS)
    expect(elementColumns('compact')).toEqual(ELEMENT_COLUMNS.filter((c) => c !== 'ctr'))
    expect(elementColumns('tight')).toEqual(
      ELEMENT_COLUMNS.filter((c) => c !== 'ctr' && c !== 'unit'),
    )
  })

  it('sheds in that order and no other — ctr is never shed after unit', () => {
    expect(SHED_ORDER).toEqual(['ctr', 'unit'])
    // One level per shed, plus the un-shed one: a level with nothing to drop into it
    // would be a silent no-op breakpoint.
    expect(SHED_ORDER).toHaveLength(TRACE_LEVELS.length - 1)
  })

  it('NEVER sheds a number — the one assertion, across all three levels', () => {
    const figures = ELEMENT_COLUMNS.filter((c) => columnRole(c) === 'figure')
    // The corpus's trace carries three figures — base, rate and value. If a fourth is
    // ever added it joins this sweep automatically, because the roles are the source.
    expect(figures).toEqual(['base', 'rate', 'value'])
    for (const level of TRACE_LEVELS) {
      for (const figure of figures) {
        expect(elementColumns(level)).toContain(figure)
      }
    }
  })

  it('and no figure can even be PUT in the shed order — the guard, not the symptom', () => {
    // The rule most likely to be broken later is someone adding a column and dropping
    // it into the order without thinking. This asserts the order itself, so the guard
    // fires on the edit rather than on the level that happens to reach the new column.
    for (const shed of SHED_ORDER) {
      expect(columnRole(shed)).toBe('identifier')
    }
  })

  it('keeps every column that is not in the shed order, at every level', () => {
    const sheddable = new Set<string>(SHED_ORDER)
    for (const level of TRACE_LEVELS) {
      for (const column of ELEMENT_COLUMNS) {
        if (!sheddable.has(column)) expect(elementColumns(level)).toContain(column)
      }
    }
  })

  it('never reorders what it keeps — the pricing procedure\'s own order survives', () => {
    for (const level of TRACE_LEVELS) {
      const kept = elementColumns(level)
      const inSourceOrder = ELEMENT_COLUMNS.filter((c) => kept.includes(c))
      expect(kept).toEqual(inSourceOrder)
    }
  })
})

describe('the level is derived from the column minimums, not chosen', () => {
  it('picks the widest level that fits the measured width', () => {
    // `traceMinWidth` sums the level's own columns, so these three thresholds are
    // consequences of the width table rather than three hand-picked breakpoints.
    expect(traceLevel(traceMinWidth('full'))).toBe('full')
    expect(traceLevel(traceMinWidth('full') - 1)).toBe('compact')
    expect(traceLevel(traceMinWidth('compact'))).toBe('compact')
    expect(traceLevel(traceMinWidth('compact') - 1)).toBe('tight')
  })

  it('narrows monotonically — each level needs strictly less room than the last', () => {
    const widths = TRACE_LEVELS.map(traceMinWidth)
    for (let i = 1; i < widths.length; i++) expect(widths[i]).toBeLessThan(widths[i - 1])
  })

  it('bottoms out at tight — there is no width too narrow to render the trace', () => {
    // Below the floor the shell scrolls (spec 110's 780 px work area); the trace does
    // not answer that by shedding a figure, so `tight` is terminal.
    expect(traceLevel(0)).toBe('tight')
    expect(traceLevel(-100)).toBe('tight')
  })

  it('treats an unmeasured trace as full rather than pre-emptively shedding', () => {
    // The width arrives from a layout-effect measurement; a very wide value must not
    // wrap around into a narrower level.
    expect(traceLevel(10_000)).toBe('full')
  })
})
