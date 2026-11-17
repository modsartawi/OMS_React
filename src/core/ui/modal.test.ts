import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import Modal from './Modal'

// 884 shots: the copilot's "Larger map" dialog had no close button in its title bar. A dialog given a close label draws
// one there (named by that label); a dialog given none is drawn exactly as before, so no other dialog changes look.
// Static markup: no DOM, no effects — the open dialog's own elements.

const draw = (closeLabel?: string) =>
  renderToStaticMarkup(createElement(Modal, { open: true, onClose: () => {}, title: 'The map, larger', closeLabel, children: 'body' }))

describe('a dialog with a close label draws a close button in its title bar', () => {
  it('the button is named by the label', () => {
    const html = draw('Close')
    expect(html).toMatch(/<button[^>]*aria-label="Close"[^>]*data-modal-close/)
  })

  it('a dialog with no close label draws no button', () => {
    expect(draw()).not.toContain('<button')
  })
})
