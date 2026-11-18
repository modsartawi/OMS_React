import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import MapPanel from './MapPanel'

// Ticket 908 (BackOffice spec 3630 M34 as amended 2026-11-17, ADR 0139): Google's own logo and terms are on the map, drawn
// by Google; the panel adds no credit line of its own and hides none of Google's. (879's "© OpenStreetMap" line went
// with our base map.)

const markup = () =>
  renderToStaticMarkup(createElement(MapPanel, { points: [{ id: 'R001', lon: 46.675, lat: 24.713 }], maps: { key: 'planted-test-key' }, ariaLabel: 'Stores' }))

describe('the credit', () => {
  it('is Google’s alone: the panel draws no credit line of its own', () => {
    expect(markup()).not.toContain('©')
    expect(markup()).not.toContain('openstreetmap')
  })

  it('nothing on the panel is hidden from print, so Google’s logo and terms print', () => {
    expect(markup()).not.toMatch(/print:hidden|print:invisible|print:sr-only/)
  })

  it('the key is never written into the panel’s markup', () => {
    expect(markup()).not.toContain('planted-test-key')
  })

  it('the frame starts as drawing', () => {
    expect(markup()).toContain('data-map-state="drawing"')
  })
})
