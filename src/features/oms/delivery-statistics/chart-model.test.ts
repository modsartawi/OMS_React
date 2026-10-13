import { describe, expect, it } from 'vitest'
import type { DeliveryStatisticsBucket } from '@/core/models/delivery-statistics'
import { chartModel, niceTop } from './chart-model'

const DASH = '—'
const hours = (day: string, values: (h: number) => [number, number]): DeliveryStatisticsBucket[] =>
  Array.from({ length: 24 }, (_, h) => {
    const [cameIn, handedOver] = values(h)
    return { bucket: `${day}T${String(h).padStart(2, '0')}:00:00`, cameIn, handedOver }
  })

describe('niceTop', () => {
  it('is the first round step at or above the largest value, as on the till', () => {
    expect(niceTop(0)).toBe(6)
    expect(niceTop(6)).toBe(6)
    expect(niceTop(7)).toBe(12)
    expect(niceTop(61)).toBe(90)
    expect(niceTop(300)).toBe(300)
    expect(niceTop(301)).toBe(600)
    expect(niceTop(1234)).toBe(1500)
  })
})

describe('chartModel', () => {
  it('by the hour: one column per bucket, every third hour labelled "HH", the readout "HH:00"', () => {
    const model = chartModel(hours('2026-10-13', () => [1, 1]), 'hour', DASH)
    expect(model.columns).toHaveLength(24)
    expect(model.columns.map((c) => c.label).slice(0, 7)).toEqual(['00', '', '', '03', '', '', '06'])
    expect(model.columns[9].readout).toBe('09:00')
    expect(model.columns[21].label).toBe('21')
  })

  it('by the day: the day of the month as the label, thinned as the range grows; the readout the whole date', () => {
    const days = (n: number): DeliveryStatisticsBucket[] =>
      Array.from({ length: n }, (_, i) => {
        const d = new Date(2026, 8, 20 + i)
        const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
        return { bucket: `${iso}T00:00:00`, cameIn: i, handedOver: 0 }
      })
    const week = chartModel(days(7), 'day', DASH)
    expect(week.columns.map((c) => c.label)).toEqual(['20', '21', '22', '23', '24', '25', '26'])
    expect(week.columns[0].readout).toBe('2026-09-20')

    const fortnight = chartModel(days(14), 'day', DASH)
    expect(fortnight.columns.map((c) => c.label).slice(0, 4)).toEqual(['20', '', '22', ''])

    const month = chartModel(days(31), 'day', DASH)
    expect(month.columns).toHaveLength(31)
    // Across the month's end the day number starts again: 20 … 30, then 1, 2, …
    expect(month.columns.map((c) => c.label).filter(Boolean)).toEqual(['20', '25', '30', '5', '10', '15', '20'])
    expect(month.columns[30].readout).toBe('2026-10-20')
  })

  it('the largest value of EITHER series scales both, so the two are read on one axis', () => {
    const model = chartModel(
      [
        { bucket: '2026-10-13T08:00:00', cameIn: 30, handedOver: 10 },
        { bucket: '2026-10-13T09:00:00', cameIn: 5, handedOver: 60 },
      ],
      'hour',
      DASH,
    )
    expect(model.top).toBe(60)
    expect(model.columns[0].cameInShare).toBeCloseTo(0.5)
    expect(model.columns[0].handedOverShare).toBeCloseTo(1 / 6)
    expect(model.columns[1].handedOverShare).toBe(1)
    expect(model.axis).toEqual(['60', '40', '20', '0'])
  })

  it('an all-zero series draws flat, without a divide-by-zero', () => {
    const model = chartModel(hours('2026-10-13', () => [0, 0]), 'hour', DASH)
    expect(model.top).toBe(6)
    expect(model.axis).toEqual(['6', '4', '2', '0'])
    for (const c of model.columns) {
      expect(c.cameInShare).toBe(0)
      expect(c.handedOverShare).toBe(0)
      expect(c.cameIn).toBe('0')
    }
  })

  it('an empty series has no columns, and an axis all the same', () => {
    const model = chartModel([], 'day', DASH)
    expect(model.columns).toEqual([])
    expect(model.axis).toEqual(['6', '4', '2', '0'])
  })

  it('reads each value as sent, grouped; a value the server left out reads the dash and draws no column', () => {
    const model = chartModel(
      [
        { bucket: '2026-10-13T08:00:00', cameIn: 1234, handedOver: 0 },
        { bucket: '2026-10-13T09:00:00', handedOver: 7 } as unknown as DeliveryStatisticsBucket,
      ],
      'hour',
      DASH,
    )
    expect(model.columns[0].cameIn).toBe('1,234')
    expect(model.columns[0].handedOver).toBe('0')
    expect(model.axis[0]).toBe('1,500')
    expect(model.columns[1].cameIn).toBe(DASH)
    expect(model.columns[1].cameInShare).toBe(0)
  })

  it('a bucket it cannot read keeps its column, unlabelled, its readout the bucket as sent', () => {
    const model = chartModel([{ bucket: 'soon', cameIn: 1, handedOver: 1 }], 'hour', DASH)
    expect(model.columns[0].label).toBe('')
    expect(model.columns[0].readout).toBe('soon')
  })

  it('keeps the server order: no bucket is sorted, merged or added', () => {
    const model = chartModel(
      [
        { bucket: '2026-10-13T10:00:00', cameIn: 1, handedOver: 1 },
        { bucket: '2026-10-13T09:00:00', cameIn: 2, handedOver: 2 },
      ],
      'hour',
      DASH,
    )
    expect(model.columns.map((c) => c.readout)).toEqual(['10:00', '09:00'])
  })
})
