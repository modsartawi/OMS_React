import { describe, expect, it } from 'vitest'
import type { ResultsPanelsReply, ResultsPromiseCheckRow } from '@/core/models/sourcing-results'
import stub from './stub-first.json'
import { promisePanel } from './promise-panel-model'

// `GET SourcingAdvisor/Results/Panels`' promise check (BO 4393): Dawaa Now with its band, pick-up per channel group.
const reply = stub.panels as unknown as ResultsPanelsReply
const dawaaNow = (percent: number, pill: ResultsPromiseCheckRow['pill']): ResultsPromiseCheckRow => ({
  ...reply.promiseCheck[0],
  percent,
  pill,
})

describe('promisePanel — a row per mode, against the 85% to 95% band', () => {
  it('keeps the reply order: Dawaa Now, then pick-up as two rows by channel group, with the counts checked', () => {
    expect(promisePanel(reply.promiseCheck).map((r) => [r.mode, r.channelGroup, r.percent, r.count, r.within])).toEqual([
      ['DAWAA_NOW', null, 88.6, 7640, 6769],
      ['PICK_UP', 'APP_SITE', 74.5, 46600, 34717],
      ['PICK_UP', 'CALL_CENTRE', 56.0, 8260, 4626],
    ])
  })

  it('reads where a share stands off the server\'s pill, never off its own sums', () => {
    expect(promisePanel([dawaaNow(88.6, 'INSIDE'), dawaaNow(84.9, 'UNDER'), dawaaNow(97.2, 'OVER')]).map((r) => r.state)).toEqual([
      'inside',
      'under',
      'over',
    ])
  })

  it('reads pick-up as a target with no band', () => {
    const rows = promisePanel(reply.promiseCheck).filter((r) => r.mode === 'PICK_UP')
    expect(rows.map((r) => r.state)).toEqual(['target', 'target'])
    expect(rows.map((r) => r.gauge.band)).toEqual([null, null])
  })

  it('reads a row with nothing checked as none checked, with no marker', () => {
    const [row] = promisePanel([{ ...dawaaNow(0, 'NONE_CHECKED'), checked: 0, within: 0 }])
    expect(row.state).toBe('none')
    expect(row.gauge.marker).toBeNull()
  })

  it('carries Dawaa Now\'s express stamp share beside it, and none on pick-up', () => {
    expect(promisePanel(reply.promiseCheck).map((r) => r.expressStampPercent)).toEqual([92.1, null, null])
  })

  it('places the marker and the shaded band on a gauge running from 50% to 100%', () => {
    const [row] = promisePanel([dawaaNow(88.6, 'INSIDE')])
    expect(row.gauge.marker).toBeCloseTo(77.2, 5)
    expect(row.gauge.band).toEqual({ start: 70, width: 20 })
  })

  it('holds a share below 50% at the gauge start and the figure as sent', () => {
    const [row] = promisePanel([dawaaNow(41.3, 'UNDER')])
    expect(row.gauge.marker).toBe(0)
    expect(row.percent).toBe(41.3)
  })

  it('gives each row a key the drive can name', () => {
    expect(promisePanel(reply.promiseCheck).map((r) => r.key)).toEqual(['DAWAA_NOW', 'PICK_UP:APP_SITE', 'PICK_UP:CALL_CENTRE'])
  })
})
