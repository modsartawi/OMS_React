/** Ticket 962: the simulator's route and the link to a stored run in it, which 971's drawer will use. */
import { describe, expect, it } from 'vitest'
import { SIMULATOR_PATH, simulatorRunPath } from './simulator-path'

describe('the simulator’s path', () => {
  it('lives under OMS', () => {
    expect(SIMULATOR_PATH).toBe('/oms/sourcing-simulator')
  })

  it('a stored run opens by its number in the query, never in the path', () => {
    expect(simulatorRunPath('01JDM3K8Q2V7X4T9B6N0R5W1YZ')).toBe('/oms/sourcing-simulator?run=01JDM3K8Q2V7X4T9B6N0R5W1YZ')
  })
})
