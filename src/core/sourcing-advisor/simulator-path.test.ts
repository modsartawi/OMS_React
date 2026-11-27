/** Ticket 962: the simulator's route and the link to a stored run in it, which 971's drawer will use. */
import { describe, expect, it } from 'vitest'
import { replayOrderOf, SIMULATOR_PATH, simulatorReplayPath, simulatorRunPath } from './simulator-path'

describe('the simulator’s path', () => {
  it('lives under OMS', () => {
    expect(SIMULATOR_PATH).toBe('/oms/sourcing-simulator')
  })

  it('a stored run opens by its number in the query, never in the path', () => {
    expect(simulatorRunPath('01JDM3K8Q2V7X4T9B6N0R5W1YZ')).toBe('/oms/sourcing-simulator?run=01JDM3K8Q2V7X4T9B6N0R5W1YZ')
  })

  it('an order to replay opens by its number in the query (ticket 974), and the simulator reads it back', () => {
    expect(simulatorReplayPath('4500718264')).toBe('/oms/sourcing-simulator?replay=4500718264')
    expect(replayOrderOf(new URLSearchParams('replay=%204500718264%20'))).toBe('4500718264')
    expect(replayOrderOf(new URLSearchParams('run=01JDM3K8'))).toBe('')
  })
})
