import { describe, expect, it } from 'vitest'
import type { DeliveryStatisticsBucket } from '@/core/models/delivery-statistics'
import { seriesRows } from './series-rows'

describe('seriesRows', () => {
  it('series maps to chart rows in the server\'s order, nothing filled in', () => {
    const rows = seriesRows(
      [
        { bucket: '2026-10-13T10:00:00', cameIn: 3, handedOver: 0 },
        { bucket: '2026-10-13T09:00:00', cameIn: 12, handedOver: 7 },
      ],
      'hour',
    )
    expect(rows).toEqual([
      { x: '2026-10-13T10:00:00', label: '10:00', values: { cameIn: 3, handedOver: 0 }, slot: null },
      { x: '2026-10-13T09:00:00', label: '09:00', values: { cameIn: 12, handedOver: 7 }, slot: null },
    ])
  })

  it('by the day, a bucket is labelled by its whole date, read as text', () => {
    const rows = seriesRows([{ bucket: '2026-10-31T00:00:00', cameIn: 1, handedOver: 1 }], 'day')
    expect(rows[0].label).toBe('2026-10-31')
  })

  it('a value the server leaves out stays null — never 0', () => {
    const rows = seriesRows([{ bucket: '2026-10-13T09:00:00', handedOver: 7 } as unknown as DeliveryStatisticsBucket], 'hour')
    expect(rows[0].values).toEqual({ cameIn: null, handedOver: 7 })
  })

  it('a bucket it cannot read keeps its row, labelled as sent', () => {
    const rows = seriesRows([{ bucket: 'soon', cameIn: 1, handedOver: 1 }], 'hour')
    expect(rows[0].label).toBe('soon')
  })

  it('no series is no rows', () => {
    expect(seriesRows(undefined, 'day')).toEqual([])
    expect(seriesRows([], 'hour')).toEqual([])
  })
})
