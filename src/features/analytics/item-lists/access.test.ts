import { describe, expect, it } from 'vitest'
import { permissionsOf, type ScreenKey } from '@/core/permissions'
import { itemListActions } from './access'

const holding = (...screens: ScreenKey[]) => permissionsOf({ screens })
const reader = holding('Analytics:03')
const author = holding('Analytics:03', 'Analytics:02')
const mine = { owner: 'msartawi' }

describe('itemListActions: the author grant uploads and re-uploads; the audience reads and exports', () => {
  it('an author may upload a new list, and re-upload their own', () => {
    expect(itemListActions(author, 'msartawi', mine)).toEqual({ read: true, export: true, upload: true, reupload: true })
  })
  it('without the author grant there is no upload or re-upload, but the list page and Export still work', () => {
    expect(itemListActions(reader, 'msartawi', mine)).toEqual({ read: true, export: true, upload: false, reupload: false })
  })
  it('an author re-uploads only a list they own (its owner, any case); another author’s list is read and exported', () => {
    expect(itemListActions(author, 'MSARTAWI', mine).reupload).toBe(true)
    expect(itemListActions(author, 'nalharbi', mine)).toEqual({ read: true, export: true, upload: true, reupload: false })
  })
  it('without the view grant nothing is offered, whatever else is held', () => {
    expect(itemListActions(holding('Analytics:02'), 'msartawi', mine)).toEqual({ read: false, export: false, upload: false, reupload: false })
  })
  it('with no list yet (the upload page), re-upload is not offered', () => {
    expect(itemListActions(author, 'msartawi', null).reupload).toBe(false)
  })
})
