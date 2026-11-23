import { describe, expect, it } from 'vitest'
import { localBase, parseShots, planRun, screensSnapshot } from './shots-config.mjs'

describe('the capture run’s base URL', () => {
  it.each(['http://localhost:5173', 'http://127.0.0.1:5173/', 'http://[::1]:5199'])('accepts the local app at %s', (url) => {
    expect(localBase(url)).toBe(url.replace(/\/$/, ''))
  })

  it.each([
    'https://oms-backoffice.al-dawaa.com',
    'http://172.23.10.110:4321',
    'http://localhost.al-dawaa.com:5173',
    'http://localhost@evil.example',
    'file:///C:/x',
    'not a url',
    '',
  ])('refuses %j', (url) => {
    expect(() => localBase(url)).toThrow(/localhost/)
  })
})

describe('the shot list', () => {
  it('fills the default viewport and keeps the setup steps in order', () => {
    const shots = parseShots(
      JSON.stringify({
        shots: [
          { name: 'help-center', route: '/analytics/help/start', crop: '[data-help-page]', steps: [{ waitFor: '[data-help-article]' }] },
          { name: 'home', route: '/analytics', fullPage: true, viewport: { width: 1280, height: 800 }, steps: [{ click: 'a' }, { type: { selector: 'input', text: 'sales' } }] },
        ],
      }),
    )
    expect(shots).toEqual([
      { name: 'help-center', route: '/analytics/help/start', crop: '[data-help-page]', fullPage: false, viewport: { width: 1440, height: 900 }, steps: [{ waitFor: '[data-help-article]' }], hide: [], maxHeight: null, pad: 12 },
      { name: 'home', route: '/analytics', crop: null, fullPage: true, viewport: { width: 1280, height: 800 }, steps: [{ click: 'a' }, { type: { selector: 'input', text: 'sales' } }], hide: [], maxHeight: null, pad: 12 },
    ])
  })

  it('names every problem at once', () => {
    const bad = {
      shots: [
        { name: 'Help Center', route: '/analytics/help', crop: 'main' },
        { name: 'twice', route: 'https://oms-backoffice.al-dawaa.com/analytics', crop: 'main' },
        { name: 'twice', route: '/analytics', crop: 'main', fullPage: true },
        { name: 'neither', route: '/analytics' },
        { name: 'steps', route: '/analytics', crop: 'main', steps: [{ hover: 'a' }, { type: { selector: 'input' } }] },
        { name: 'size', route: '/analytics', crop: 'main', viewport: { width: 0, height: 900 } },
      ],
    }
    let message = ''
    try {
      parseShots(JSON.stringify(bad))
    } catch (err) {
      message = err.message
    }
    expect(message).toContain('shots[0] name "Help Center"')
    expect(message).toContain('shots[1] route')
    expect(message).toContain('shots[2] name "twice" is used twice')
    expect(message).toContain('shots[2] takes a crop or fullPage, not both')
    expect(message).toContain('shots[3] takes a crop or fullPage')
    expect(message).toContain('shots[4] steps[0]')
    expect(message).toContain('shots[4] steps[1]')
    expect(message).toContain('shots[5] viewport')
  })

  it.each(['', '{', '[]', '{"shots":[]}', '{"shots":{}}'])('refuses %j as a list', (text) => {
    expect(() => parseShots(text)).toThrow(/shots/)
  })
})

describe('the run plan, made before any browser starts', () => {
  const good = JSON.stringify({ shots: [{ name: 'home', route: '/analytics', crop: 'main' }] })
  const env = { HELP_SHOTS_BASE: 'http://localhost:5173', SIS_USER: 'seed', SIS_PASS: 'secret' }

  it('needs the BackOffice images folder, local base, sign-in and a valid list', () => {
    expect(planRun({ argv: ['C:/Work/BO/Services/SIS.Api/Help/analytics/images'], env, shotsText: good })).toEqual({
      base: 'http://localhost:5173',
      imagesDir: 'C:/Work/BO/Services/SIS.Api/Help/analytics/images',
      shots: [{ name: 'home', route: '/analytics', crop: 'main', fullPage: false, viewport: { width: 1440, height: 900 }, steps: [], hide: [], maxHeight: null, pad: 12 }],
      langs: ['en', 'ar'],
      arabicFromEnglish: false,
    })
  })

  it('defaults the base to the Vite dev server', () => {
    expect(planRun({ argv: ['out'], env: { SIS_USER: 'seed' }, shotsText: good }).base).toBe('http://localhost:5173')
  })

  it('refuses a hosted base', () => {
    expect(() => planRun({ argv: ['out'], env: { ...env, HELP_SHOTS_BASE: 'http://172.23.10.110:4321' }, shotsText: good })).toThrow(/localhost/)
  })

  it('refuses a bad list', () => {
    expect(() => planRun({ argv: ['out'], env, shotsText: '{"shots":[{"name":"x"}]}' })).toThrow(/shots\[0\]/)
  })

  it('refuses a run with no images folder', () => {
    expect(() => planRun({ argv: [], env, shotsText: good })).toThrow(/images folder/)
  })

  it('refuses a run with no sign-in, and never echoes the password', () => {
    expect(() => planRun({ argv: ['out'], env: { HELP_SHOTS_BASE: 'http://localhost:5173' }, shotsText: good })).toThrow(/SIS_USER/)
    let message = ''
    try {
      planRun({ argv: ['out'], env: { ...env, HELP_SHOTS_BASE: 'https://example.com' }, shotsText: good })
    } catch (err) {
      message = err.message
    }
    expect(message).not.toContain('secret')
  })
})

describe('the screens snapshot the run refreshes', () => {
  const contents = {
    draft: true,
    articles: [
      { slug: 'start', screens: ['/analytics', '/analytics/help'] },
      { slug: 'boards', screens: ['/analytics/boards', '/analytics'] },
      { slug: 'whats-new', screens: [] },
    ],
  }

  it('lists every screen of the table of contents once, in reading order, in 951’s format', () => {
    expect(screensSnapshot('analytics', contents)).toEqual({
      note: expect.stringContaining('954'),
      area: 'analytics',
      screens: ['/analytics', '/analytics/help', '/analytics/boards'],
    })
  })

  it('refuses a table of contents with no screens rather than empty the snapshot', () => {
    expect(() => screensSnapshot('analytics', { draft: true, articles: [] })).toThrow(/no screens/)
  })
})

describe('tight crops (owner 2026-11-23: one part of the screen per shot)', () => {
  const one = (shot) => parseShots(JSON.stringify({ shots: [{ name: 'x', route: '/analytics', ...shot }] }))[0]

  it('takes a list of selectors as one crop around them all, a height cap, and things to hide', () => {
    expect(one({ crop: ['[data-a]', '[data-b]'], maxHeight: 600, hide: ['[data-analytics-status]'] })).toMatchObject({
      crop: ['[data-a]', '[data-b]'],
      maxHeight: 600,
      hide: ['[data-analytics-status]'],
    })
  })

  it('margins a crop by 12 pixels unless told otherwise; a dialog or side panel takes pad 0, so the page behind stays out', () => {
    expect(one({ crop: 'main' }).pad).toBe(12)
    expect(one({ crop: 'dialog[open]', pad: 0 }).pad).toBe(0)
  })

  it.each([
    [{ crop: [] }, 'crop'],
    [{ crop: ['[data-a]', ''] }, 'crop'],
    [{ crop: 'main', maxHeight: 0 }, 'maxHeight'],
    [{ crop: 'main', maxHeight: 12.5 }, 'maxHeight'],
    [{ crop: 'main', hide: 'main' }, 'hide'],
    [{ crop: 'main', hide: [''] }, 'hide'],
    [{ crop: 'main', pad: -1 }, 'pad'],
    [{ crop: 'main', pad: 1.5 }, 'pad'],
  ])('refuses %j', (shot, field) => {
    expect(() => one(shot)).toThrow(`shots[0] ${field}`)
  })
})

describe('English shots for the Arabic guide (owner 2026-11-23, until the app’s labels are in Arabic)', () => {
  const env = { SIS_USER: 'seed' }
  const list = (extra) => JSON.stringify({ ...extra, shots: [{ name: 'home', route: '/analytics', crop: 'main' }] })

  it('"arabic": "english" shoots once in English and writes it for both languages', () => {
    expect(planRun({ argv: ['out'], env, shotsText: list({ arabic: 'english' }) })).toMatchObject({ langs: ['en'], arabicFromEnglish: true })
  })

  it('"arabic": "shoot" (the default) shoots each language', () => {
    expect(planRun({ argv: ['out'], env, shotsText: list({ arabic: 'shoot' }) })).toMatchObject({ langs: ['en', 'ar'], arabicFromEnglish: false })
  })

  it('refuses any other value', () => {
    expect(() => planRun({ argv: ['out'], env, shotsText: list({ arabic: 'mirror' }) })).toThrow(/arabic/)
  })
})

describe('signing in from a saved browser session', () => {
  const good = JSON.stringify({ shots: [{ name: 'home', route: '/analytics', crop: 'main' }] })

  it('accepts SIS_STATE (a Playwright storage-state file) in place of a user and password', () => {
    expect(planRun({ argv: ['out'], env: { SIS_STATE: 'C:/tmp/state.json' }, shotsText: good }).base).toBe('http://localhost:5173')
  })
})
