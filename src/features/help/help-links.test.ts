/**
 * oms 951 (BackOffice spec 4182 §A "Links inside an article"): `[label](screen:/analytics/boards)`,
 * `[label](help:boards#share)` and `![alt](images/boards-editor.en.png)` — what each target means, and the image file
 * the app's language picks.
 */
import { describe, expect, it } from 'vitest'
import { helpImageFile, helpLinkOf } from './help-links'

describe('helpLinkOf', () => {
  it('a screen: link is a route in this app', () => {
    expect(helpLinkOf('screen:/analytics/boards', 'analytics')).toEqual({ kind: 'screen', to: '/analytics/boards' })
  })

  it('a help: link is another article of the same area, with its anchor when it has one', () => {
    expect(helpLinkOf('help:boards#share', 'analytics')).toEqual({ kind: 'help', to: '/analytics/help/boards#share' })
    expect(helpLinkOf('help:start', 'analytics')).toEqual({ kind: 'help', to: '/analytics/help/start' })
    expect(helpLinkOf('help:#tours', 'analytics')).toEqual({ kind: 'anchor', to: '#tours' })
  })

  it('a plain #anchor stays in the article; anything else is outside the help', () => {
    expect(helpLinkOf('#share', 'analytics')).toEqual({ kind: 'anchor', to: '#share' })
    expect(helpLinkOf('https://example.com/x', 'analytics')).toEqual({ kind: 'external', to: 'https://example.com/x' })
  })

  it('a screen: link that is not an app route (no leading slash, or another origin) is not a screen', () => {
    expect(helpLinkOf('screen:analytics', 'analytics').kind).toBe('external')
    expect(helpLinkOf('screen://evil.example/x', 'analytics').kind).toBe('external')
  })
})

describe('helpImageFile', () => {
  it('picks the file for the app language', () => {
    expect(helpImageFile('images/boards-editor.en.png', 'ar')).toBe('boards-editor.ar.png')
    expect(helpImageFile('images/boards-editor.ar.png', 'en')).toBe('boards-editor.en.png')
    expect(helpImageFile('images/boards-editor.en.png', 'en')).toBe('boards-editor.en.png')
  })

  it('an image with no language in its name is shared by both', () => {
    expect(helpImageFile('images/logo.png', 'ar')).toBe('logo.png')
    expect(helpImageFile('./images/en-route.png', 'ar')).toBe('en-route.png')
  })

  it('only the help image folder is read — never another host or a path out of it', () => {
    expect(helpImageFile('https://example.com/a.en.png', 'en')).toBeNull()
    expect(helpImageFile('images/../secret.png', 'en')).toBeNull()
    expect(helpImageFile('images/sub/a.png', 'en')).toBeNull()
    expect(helpImageFile('', 'en')).toBeNull()
  })
})
