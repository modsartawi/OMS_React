import { describe, expect, it } from 'vitest'
import { permissionsOf } from '@/core/permissions'
import { actsOffered } from './acts'

describe('the list offers its acts only to a session that may open AND change a delivery (ticket 521)', () => {
  it.each<[string, string[] | null, boolean]>([
    ['open + change', ['DocumentList:03', 'DocumentDetails:03', 'DocumentDetails:02'], true],
    ['a viewer (open, no change)', ['DocumentList:03', 'DocumentDetails:03'], false],
    ['return only', ['DocumentList:03', 'DocumentDetails:03', 'OmsCreateReturn:01'], false],
    ['half grant: change without opening Details', ['DocumentList:03', 'DocumentDetails:02'], false],
    ['no answer', null, false],
  ])('%s -> %s', (_, screens, offered) => {
    expect(actsOffered(permissionsOf(screens ? { screens } : null))).toBe(offered)
  })
})
