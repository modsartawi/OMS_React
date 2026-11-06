// The batch runner (spec 805, ticket 806): one single-item write per picked item, sequential,
// never stopping on a refusal — only on an expired session.
import { describe, expect, it } from 'vitest'
import { ApiError } from '@/core/api'
import { runBatch } from './batch-runner'

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
