/** Review 4182 #1, #8: an access level the server sends that the app does not know; who may read the help at all. */
import { describe, expect, it } from 'vitest'
import { permissionsOf } from '@/core/permissions'
import type { HelpAccess } from '@/core/models/help'
import { canReadHelp, helpAccessHeld, isHelpAccess } from './help-access'

const everything = permissionsOf({ screens: ['Analytics:03', 'Analytics:02', 'Analytics:06', 'Analytics:07'] })

describe('helpAccessHeld', () => {
  it('a known level reads its Analytics predicate', () => {
    expect(helpAccessHeld('sql', everything)).toBe(true)
    expect(helpAccessHeld('author', permissionsOf({ screens: ['Analytics:03'] }))).toBe(false)
  })

  it('an unknown level is held by nobody, and does not throw', () => {
    expect(helpAccessHeld('owner' as HelpAccess, everything)).toBe(false)
    expect(helpAccessHeld('toString' as HelpAccess, everything)).toBe(false)
    expect(helpAccessHeld(undefined as unknown as HelpAccess, everything)).toBe(false)
  })

  it('isHelpAccess tells the four levels from anything else', () => {
    expect(['viewer', 'author', 'curator', 'sql'].every(isHelpAccess)).toBe(true)
    expect(isHelpAccess('owner')).toBe(false)
    expect(isHelpAccess('constructor')).toBe(false)
    expect(isHelpAccess(undefined)).toBe(false)
  })
})

describe('canReadHelp — the Help menu leaf and the copilot "How do I…?" row', () => {
  it('an Analytics viewer or a PriceWatch viewer reads the help; anyone else does not', () => {
    expect(canReadHelp(permissionsOf({ screens: ['Analytics:03'] }))).toBe(true)
    expect(canReadHelp(permissionsOf({ screens: ['PriceWatch:03'] }))).toBe(true)
    expect(canReadHelp(permissionsOf({ screens: ['Deliveries:03'] }))).toBe(false)
    expect(canReadHelp(permissionsOf(null))).toBe(false)
  })
})
