// The batch runner (spec 805, ticket 806): one single-item write per picked item, sequential,
// never stopping on a refusal — only on an expired session.
import { describe, expect, it } from 'vitest'
import { ApiError } from '@/core/api'
import { refusalText, refusalsOf, runBatch } from './batch-runner'

describe('runBatch', () => {
  it('runBatch writes every item in order and reports each outcome', async () => {
    const written: string[] = []
    const refusal = new ApiError('business', 'You may not add this role.', 400)
    const offline = new ApiError('network', 'Network unreachable.', 0)
    const progress: Array<[number, number]> = []

    const result = await runBatch(
      ['A', 'B', 'C', 'D'],
      async (item) => {
        written.push(item)
        if (item === 'B') throw refusal
        if (item === 'C') throw offline
      },
      (p) => progress.push([p.completed, p.total]),
    )

    expect(written).toEqual(['A', 'B', 'C', 'D'])
    expect(result.outcomes).toEqual([
      { item: 'A', status: 'done' },
      { item: 'B', status: 'refused', error: refusal },
      { item: 'C', status: 'refused', error: offline },
      { item: 'D', status: 'done' },
    ])
    expect(result.done).toBe(2)
    expect(result.refused).toBe(2)
    expect(result.notAttempted).toBe(0)
    expect(result.stopped).toBe(false)
    expect(progress).toEqual([
      [1, 4],
      [2, 4],
      [3, 4],
      [4, 4],
    ])
  })

  it('runBatch never starts the next write before the previous one settles', async () => {
    let inFlight = 0
    let most = 0
    await runBatch([1, 2, 3], async () => {
      inFlight++
      most = Math.max(most, inFlight)
      await new Promise((r) => setTimeout(r, 1))
      inFlight--
    })
    expect(most).toBe(1)
  })

  it('runBatch stops on an expired session', async () => {
    const written: string[] = []
    const expired = new ApiError('auth', 'Your session has expired.', 401)

    const result = await runBatch(['A', 'B', 'C', 'D'], async (item) => {
      written.push(item)
      if (item === 'B') throw expired
    })

    expect(written).toEqual(['A', 'B'])
    expect(result.outcomes).toEqual([
      { item: 'A', status: 'done' },
      { item: 'B', status: 'refused', error: expired },
      { item: 'C', status: 'not-attempted' },
      { item: 'D', status: 'not-attempted' },
    ])
    expect(result.done).toBe(1)
    expect(result.refused).toBe(1)
    expect(result.notAttempted).toBe(2)
    expect(result.stopped).toBe(true)
  })
})

describe('refusalText', () => {
  const words = { fallback: 'The write failed.', denied: 'You lack the permission for this.' }

  it('refusalText names a bare 403 with the caller words, not "Unexpected API error"', () => {
    const bare = new ApiError('unknown', 'Unexpected API error (HTTP 403)', 403)
    expect(refusalText(bare, words)).toBe('You lack the permission for this.')
  })

  it('refusalText keeps a server refusal message, and falls back for a non-API error', () => {
    const coded = new ApiError('business', 'PHARM_TECH is outside your scope.', 403, [
      { errorCode: 'SCOPE', errorMessage: 'PHARM_TECH is outside your scope.' } as never,
    ])
    expect(refusalText(coded, words)).toBe('PHARM_TECH is outside your scope.')
    expect(refusalText(new Error('boom'), words)).toBe('The write failed.')
  })

  it('refusalText keeps the sentence of a 403 envelope that carries a message but no code', () => {
    const uncoded = new ApiError('business', 'Ahmed Saleh is outside your delegated scope.', 403)
    expect(refusalText(uncoded, words)).toBe('Ahmed Saleh is outside your delegated scope.')
  })
})

describe('refusalsOf', () => {
  it('refusalsOf maps each refused item to its error, in order, and is empty with no result', async () => {
    const no = new ApiError('business', 'No.', 400)
    const result = await runBatch(['A', 'B', 'C'], async (item) => {
      if (item !== 'B') throw no
    })
    expect([...refusalsOf(result)]).toEqual([['A', no], ['C', no]])
    expect(refusalsOf(null).size).toBe(0)
  })
})
