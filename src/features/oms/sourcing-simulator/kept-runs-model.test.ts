import { describe, expect, it } from 'vitest'
import type { AdviseReply, KeptRun } from '@/core/models/sourcing-run'
import reply from './advise-reply.fixture.json'
import kept from './kept-runs.fixture.json'
import replay from './replay-reply.fixture.json'
import { canDelete, keepOffer, keepProblem, keptRunLink, keptRunsList, openedSetting, runToOpen } from './kept-runs-model'

const RUNS = kept as KeptRun[]
const REPLY = reply as unknown as AdviseReply
const REPLAY = replay as unknown as AdviseReply

describe('the list of kept runs (ticket 969, spec 4354 §12)', () => {
  it("lists the caller's own kept runs, newest first: another keeper's run opens by its link only", () => {
    expect(keptRunsList(RUNS).map((r) => r.runId)).toEqual(['01JDQ7M4X9T2B6N8R3K5W1C0VA', '01JDP2Z8C4H6F1Q9Y7E3M5D2KB', '01JDM8T6B3W5N2X4Q9H7L1F0PD'])
  })

  it('lets only its keeper delete a kept run', () => {
    expect(canDelete(RUNS[0])).toBe(true)
    expect(canDelete(RUNS[1])).toBe(false)
  })
})

describe('what a kept run’s link opens', () => {
  it('is the simulator, opened on the run', () => {
    expect(keptRunLink('01JDQ7M4X9T2B6N8R3K5W1C0VA', 'https://oms.example')).toBe('https://oms.example/oms/sourcing-simulator?run=01JDQ7M4X9T2B6N8R3K5W1C0VA')
  })

  it('names the run the simulator opens, and none for an empty parameter', () => {
    expect(runToOpen('?run=01JDQ7M4X9T2B6N8R3K5W1C0VA')).toBe('01JDQ7M4X9T2B6N8R3K5W1C0VA')
    expect(runToOpen('?run=%2001JDQ7M4X9T2B6N8R3K5W1C0VA%20')).toBe('01JDQ7M4X9T2B6N8R3K5W1C0VA')
    expect(runToOpen('?run=')).toBeNull()
    expect(runToOpen('')).toBeNull()
  })

  it("sets the cart of a hand-built run back in the simulator, without the customer's point it never stored", () => {
    expect(openedSetting(REPLY)).toEqual({
      start: 'build',
      form: {
        channel: 'IOS',
        time: '19:42',
        goodsTotal: '',
        lines: [
          { key: 1, item: '100234', quantity: '2' },
          { key: 2, item: '100871', quantity: '1' },
          { key: 3, item: '104410', quantity: '1' },
        ],
        lat: '',
        lng: '',
      },
    })
  })

  it('sets the order of a replayed run back, from its own point', () => {
    expect(openedSetting({ ...REPLAY, kind: 'REPLAY_MOVED_POINT' })).toEqual({
      start: 'replay',
      replay: { orderNumber: '4500718264', withPoint: false, movedTo: null },
    })
  })
})

describe('keeping the run on screen', () => {
  it('offers to keep a held run, not one the door could not hold, nor one already stored', () => {
    expect(keepOffer(REPLY, false)).toBe('keep')
    expect(keepOffer({ ...REPLY, held: null }, false)).toBe('notHeld')
    expect(keepOffer({ ...REPLY, solve: { ...REPLY.solve, marks: ['NOT_HELD'] } }, false)).toBe('notHeld')
    expect(keepOffer(REPLY, true)).toBe('stored')
  })

  it('needs a name, of at most 80 characters', () => {
    expect(keepProblem('  ')).toBe('noName')
    expect(keepProblem('x'.repeat(81))).toBe('tooLong')
    expect(keepProblem(' Malqa replay ')).toBeNull()
  })
})
