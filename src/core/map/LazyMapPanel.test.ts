import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { loadMapPanel } from './LazyMapPanel'

// Review W10 (BackOffice spec 3630, ticket 879): the map's code is a chunk fetched when a map is first on screen. A
// fetch that fails (a deploy replaced the chunk, the network dropped) must not throw out of the page — the app has no
// error boundary — but end the map as "cannot draw", so the caller shows the table, as for a screen with no graphics.

const props = { points: [{ id: 'R001', lon: 46.675, lat: 24.713 }], ariaLabel: 'Stores' }

describe("the map's code that cannot be fetched", () => {
  it('resolves to a panel that cannot draw, instead of rejecting', async () => {
    const loaded = await loadMapPanel(() => Promise.reject(new Error('Failed to fetch dynamically imported module')))
    const html = renderToStaticMarkup(createElement(loaded.default, props))
    expect(html).toContain('data-map-state="cannot-draw"')
  })

  it('a fetch that succeeds is the panel itself', async () => {
    const panel = () => null
    const loaded = await loadMapPanel(() => Promise.resolve({ default: panel }))
    expect(loaded.default).toBe(panel)
  })
})
