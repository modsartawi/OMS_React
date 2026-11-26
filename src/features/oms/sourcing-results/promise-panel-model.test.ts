import { describe, expect, it } from 'vitest'
import type { ResultsPromiseRow, ResultsSummaryReply } from '@/core/models/sourcing-results'
import stub from './stub-summary.json'
import { promisePanel } from './promise-panel-model'

const reply = stub as unknown as ResultsSummaryReply
const BAND = { from: 85, to: 95 }
const dawaaNow = (percent: number): ResultsPromiseRow => ({ mode: 'DAWAA_NOW', channelGroup: null, count: 100, percent, band: BAND })

describe('promisePanel — a row per mode, against the 85% to 95% band', () => {
  it('keeps the reply order: Dawaa Now, slot delivery, then pick-up as two rows by channel group', () => {
    expect(promisePanel(reply.promise).map((r) => [r.mode, r.channelGroup, r.percent, r.count])).toEqual([
      ['DAWAA_NOW', null, 88.6, 7640],
      ['SLOT', null, 93.8, 21300],
      ['PICK_UP', 'APP_SITE', 74.5, 46600],
      ['PICK_UP', 'CALL_CENTRE', 56.0, 8260],
    ])
  })

  it('reads a share inside the band as inside, edges included', () => {
    expect(promisePanel([dawaaNow(88.6), dawaaNow(85), dawaaNow(95)]).map((r) => r.state)).toEqual(['inside', 'inside', 'inside'])
  })

  it('reads a share under the band as under', () => {
    expect(promisePanel([dawaaNow(84.9)])[0].state).toBe('under')
  })

  it('reads a share over the band as over: a promise kept too often is padded', () => {
    expect(promisePanel([dawaaNow(97.2)])[0].state).toBe('over')
  })

  it('reads pick-up as a target with no band, whatever its share', () => {
    const rows = promisePanel(reply.promise).filter((r) => r.mode === 'PICK_UP')
    expect(rows.map((r) => r.state)).toEqual(['target', 'target'])
    expect(rows.map((r) => r.gauge.band)).toEqual([null, null])
    expect(rows[0].targetMinutes).toBe(30)
  })

  it('places the marker and the shaded band on a gauge running from 50% to 100%', () => {
    const [row] = promisePanel([dawaaNow(88.6)])
    expect(row.gauge.marker).toBeCloseTo(77.2, 5)
    expect(row.gauge.band).toEqual({ start: 70, width: 20 })
  })

  it('holds a share below 50% at the gauge start and the figure as sent', () => {
    const [row] = promisePanel([dawaaNow(41.3)])
    expect(row.gauge.marker).toBe(0)
    expect(row.percent).toBe(41.3)
    expect(row.state).toBe('under')
  })

  it('gives each row a key the drawer and the drive can name', () => {
    expect(promisePanel(reply.promise).map((r) => r.key)).toEqual(['DAWAA_NOW', 'SLOT', 'PICK_UP:APP_SITE', 'PICK_UP:CALL_CENTRE'])
  })
})
