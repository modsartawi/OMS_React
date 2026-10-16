// A link into the Pick support console (ticket 499).
import { describe, expect, it } from 'vitest'
import { pickSupportConsoleHref } from './console-link'

describe('pickSupportConsoleHref', () => {
  it('opens the console on Search with the delivery as ?key=', () => {
    expect(pickSupportConsoleHref('8006777365')).toBe('/oms/pick-support?key=8006777365')
  })

  it('encodes the number and trims it', () => {
    expect(pickSupportConsoleHref(' 80 06&x ')).toBe('/oms/pick-support?key=80+06%26x')
  })
})
