/**
 * Ticket 678 — the run loop: about 500 ms after the last edit the experiment runs by itself, edits inside the window
 * make one request, and of two in-flight runs the older one's answer arriving last is dropped (latest-wins by the
 * request sequence, not by arrival). "As of" is local text with no `Z`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { asOfText, latestWins, RUN_DELAY_MS } from './run'

interface Pending {
  body: string
  resolve: (v: string) => void
  reject: (e: unknown) => void
}

function harness() {
  const calls: Pending[] = []
  const events: string[] = []
  const runner = latestWins<string, string>({
    delayMs: RUN_DELAY_MS,
    run: (body) => new Promise((resolve, reject) => calls.push({ body, resolve, reject })),
    onStart: () => events.push('start'),
    onSettle: (s) => events.push(s.ok ? `ok:${s.value}` : `error:${String(s.error)}`),
  })
  return { calls, events, runner }
}

const flush = () => Promise.resolve().then(() => Promise.resolve())

describe('latestWins', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('the delay is about half a second', () => {
    expect(RUN_DELAY_MS).toBe(500)
  })

  it('edits inside the window make one request, with the last edit', () => {
    const { calls, runner } = harness()
    runner.edit('a')
    vi.advanceTimersByTime(300)
    runner.edit('ab')
    vi.advanceTimersByTime(300)
    runner.edit('abc')
    expect(calls).toHaveLength(0)
    vi.advanceTimersByTime(499)
    expect(calls).toHaveLength(0)
    vi.advanceTimersByTime(1)
    expect(calls.map((c) => c.body)).toEqual(['abc'])
  })

  it('of two in-flight runs, the older answer arriving last is dropped', async () => {
    const { calls, events, runner } = harness()
    runner.edit('old')
    vi.advanceTimersByTime(500)
    runner.edit('new')
    vi.advanceTimersByTime(500)
    expect(calls.map((c) => c.body)).toEqual(['old', 'new'])
    calls[1].resolve('NEW')
    await flush()
    calls[0].resolve('OLD')
    await flush()
    expect(events).toEqual(['start', 'start', 'ok:NEW'])
  })

  it('an older failure arriving last is dropped too; the latest failure is told', async () => {
    const { calls, events, runner } = harness()
    runner.edit('a')
    vi.advanceTimersByTime(500)
    runner.edit('b')
    vi.advanceTimersByTime(500)
    calls[1].reject('boom')
    await flush()
    calls[0].reject('late')
    await flush()
    expect(events).toEqual(['start', 'start', 'error:boom'])
  })

  it('an edit that is not a body (JSON that does not parse) sends nothing and drops the waiting one', () => {
    const { calls, runner } = harness()
    runner.edit('a')
    vi.advanceTimersByTime(200)
    runner.edit(null)
    vi.advanceTimersByTime(1000)
    expect(calls).toHaveLength(0)
  })

  it('dispose sends nothing more and tells nothing more', async () => {
    const { calls, events, runner } = harness()
    runner.edit('a')
    vi.advanceTimersByTime(500)
    runner.edit('b')
    runner.dispose()
    vi.advanceTimersByTime(1000)
    calls[0].resolve('A')
    await flush()
    expect(calls).toHaveLength(1)
    expect(events).toEqual(['start'])
  })
})

describe('asOfText', () => {
  it('a local date-time prints as yyyy-MM-ddTHH:mm:ss, no Z and no offset', () => {
    expect(asOfText(new Date(2026, 9, 30, 14, 5, 7))).toBe('2026-10-30T14:05:07')
    expect(asOfText(new Date(2026, 0, 2, 3, 4, 5))).toBe('2026-01-02T03:04:05')
  })

  it("the date-time input's text keeps its seconds, or takes :00 when the input dropped them", () => {
    expect(asOfText('2026-10-30T14:05:07')).toBe('2026-10-30T14:05:07')
    expect(asOfText('2026-10-30T14:05')).toBe('2026-10-30T14:05:00')
    expect(asOfText('2026-10-30T14:05:07.250')).toBe('2026-10-30T14:05:07')
  })

  it('the default is now', () => {
    const now = new Date(2026, 9, 30, 9, 8, 7)
    expect(asOfText(undefined, now)).toBe('2026-10-30T09:08:07')
    expect(asOfText('', now)).toBe('2026-10-30T09:08:07')
    expect(asOfText('not a date', now)).toBe('2026-10-30T09:08:07')
  })
})
