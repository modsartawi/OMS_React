import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import MapPanel from './MapPanel'

// Ticket 879 (BackOffice spec 3630 M34): "© OpenStreetMap" is on every map, on screen and when the page is printed.
// The panel draws the credit itself, as an ordinary element beside the map, rather than through the engine's own
// control (a collapsible button drawn by script) — so it is in the markup before the engine has started, and no print
// rule can fold it away.

const markup = () => renderToStaticMarkup(createElement(MapPanel, { points: [{ id: 'R001', lon: 46.675, lat: 24.713 }], ariaLabel: 'Stores' }))

describe('the credit line', () => {
  it('is drawn with the panel, linked to the licence page', () => {
    expect(markup()).toMatch(/<a [^>]*href="https:\/\/www\.openstreetmap\.org\/copyright"[^>]*>© OpenStreetMap<\/a>/)
  })

  it('stays in the print layout: nothing on the panel is hidden from print', () => {
    expect(markup()).not.toMatch(/print:hidden|print:invisible|print:sr-only/)
  })

  it('is the only credit: the base map needs no second one (BackOffice 3634)', () => {
    expect(markup().match(/©/g)).toHaveLength(1)
  })
})
