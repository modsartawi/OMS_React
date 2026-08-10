/**
 * The graduated download helper (ticket 262).
 *
 * 🚩 The move brought no tests with it — neither feature copy had any, because
 * the DOM half was deliberately parked outside the pure CSV writers that the two
 * suites do cover. So these are written *at* the new path rather than moved to
 * it, and they pin the two things the move could quietly lose: the anchor is
 * parked in the document before it is clicked (a detached anchor does nothing in
 * Firefox), and the object URL is revoked **a tick later**, not synchronously.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { downloadCsv, saveBlob } from './download-file'

const createObjectURL = vi.fn((_blob: Blob) => 'blob:stub-url')
const revokeObjectURL = vi.fn()

interface StubAnchor {
  href: string
  download: string
  style: { display: string }
  click: ReturnType<typeof vi.fn>
  remove: ReturnType<typeof vi.fn>
}

let anchor: StubAnchor
let appended: unknown[]

beforeEach(() => {
  vi.useFakeTimers()
  createObjectURL.mockClear()
  revokeObjectURL.mockClear()
  appended = []
  anchor = {
    href: '',
    download: '',
    style: { display: '' },
    click: vi.fn(),
    remove: vi.fn(),
  }
  vi.stubGlobal('URL', { createObjectURL, revokeObjectURL })
  vi.stubGlobal('document', {
    createElement: vi.fn(() => anchor),
    body: { appendChild: vi.fn((node: unknown) => appended.push(node)) },
  })
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('saveBlob', () => {
  it('parks the anchor in the document, names the file, and clicks it', () => {
    const blob = new Blob(['%PDF-1.4'], { type: 'application/pdf' })
    saveBlob('Invoice-P001-01-00114600051234.pdf', blob)

    expect(createObjectURL).toHaveBeenCalledWith(blob)
    expect(anchor.href).toBe('blob:stub-url')
    expect(anchor.download).toBe('Invoice-P001-01-00114600051234.pdf')
    expect(anchor.style.display).toBe('none')
    expect(appended).toEqual([anchor])
    expect(anchor.click).toHaveBeenCalledOnce()
    expect(anchor.remove).toHaveBeenCalledOnce()
  })

  it('defers the revoke — a synchronous one can abort the download', () => {
    saveBlob('Invoice.pdf', new Blob(['%PDF-1.4']))
    expect(revokeObjectURL).not.toHaveBeenCalled()
    vi.runAllTimers()
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:stub-url')
  })
})

describe('downloadCsv', () => {
  it('saves the contents as a text/csv blob under the given name', async () => {
    downloadCsv('ua-users-2026-08-11.csv', 'a,b\n1,2\n')

    const blob = createObjectURL.mock.calls[0][0]
    expect(blob.type).toBe('text/csv;charset=utf-8')
    expect(await blob.text()).toBe('a,b\n1,2\n')
    expect(anchor.download).toBe('ua-users-2026-08-11.csv')
    expect(anchor.click).toHaveBeenCalledOnce()
  })
})
