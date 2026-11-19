import { describe, expect, it, vi } from 'vitest'
import type * as ZXingModule from '@zxing/library'
import { createScanner, createWedge, ITEM_FORMATS, keyedEntry, REARM_MS, type BarcodeDetectorClass, type ScanRead, type ScannerEnv } from './scanner'

// Ticket 916 proof: the adapter falls back to ZXing when the phone has no built-in detector, and a camera read
// reports its reader, format, value and time-to-read. The phone itself is stood in for: no camera, no DOM.

function fakeZxing() {
  const loaded = vi.fn()
  class MultiFormatReader {
    setHints() {}
    decode(): never {
      throw new Error('nothing this frame')
    }
    reset() {}
  }
  const module = {
    DecodeHintType: { POSSIBLE_FORMATS: 2, TRY_HARDER: 3 },
    BarcodeFormat: { EAN_13: 7, EAN_8: 6, UPC_A: 14, CODE_128: 4, DATA_MATRIX: 5, QR_CODE: 11 },
    MultiFormatReader,
  } as unknown as typeof ZXingModule
  return {
    loaded,
    load: async () => {
      loaded()
      return module
    },
  }
}

function fakeDetector(supported: string[], reads: { format: string; rawValue: string }[][] = []) {
  const constructed = vi.fn()
  class Detector {
    static getSupportedFormats = async () => supported
    constructor(options: { formats: string[] }) {
      constructed(options.formats)
    }
    async detect() {
      return reads.shift() ?? []
    }
  }
  return { Detector: Detector as unknown as BarcodeDetectorClass, constructed }
}

function env(over: Partial<ScannerEnv>): ScannerEnv & { clock: { t: number }; frames: (() => void)[] } {
  const clock = { t: 1000 }
  const frames: (() => void)[] = []
  return {
    clock,
    frames,
    loadZxing: fakeZxing().load,
    getUserMedia: async () => fakeStream(),
    createCanvas: () => ({ getContext: () => null }) as unknown as HTMLCanvasElement,
    now: () => clock.t,
    requestFrame: (cb) => {
      frames.push(cb)
    },
    ...over,
  }
}

function fakeStream(): MediaStream {
  const track = { stop: vi.fn(), applyConstraints: async () => {}, getCapabilities: () => ({}) }
  return { getTracks: () => [track], getVideoTracks: () => [track] } as unknown as MediaStream
}

const video = () =>
  ({ readyState: 4, videoWidth: 1280, videoHeight: 720, srcObject: null, muted: false, setAttribute() {}, play: async () => {} }) as unknown as HTMLVideoElement

const flush = () => new Promise((r) => setTimeout(r, 0))

describe('the adapter picks its reader', () => {
  it('no built-in detector: ZXing is loaded and reads', async () => {
    const zxing = fakeZxing()
    const scanner = await createScanner(ITEM_FORMATS, env({ BarcodeDetector: undefined, loadZxing: zxing.load }))
    expect(scanner.reader).toBe('zxing')
    expect(zxing.loaded).toHaveBeenCalledOnce()
  })

  it('a built-in detector that reads none of the wanted formats: ZXing', async () => {
    const zxing = fakeZxing()
    const native = fakeDetector(['aztec'])
    const scanner = await createScanner(ITEM_FORMATS, env({ BarcodeDetector: native.Detector, loadZxing: zxing.load }))
    expect(scanner.reader).toBe('zxing')
    expect(native.constructed).not.toHaveBeenCalled()
  })

  it('a built-in detector that throws on asking its formats: ZXing', async () => {
    const Broken = { getSupportedFormats: async () => Promise.reject(new Error('no')) } as unknown as BarcodeDetectorClass
    const scanner = await createScanner(ITEM_FORMATS, env({ BarcodeDetector: Broken }))
    expect(scanner.reader).toBe('zxing')
  })

  it('a built-in detector for the formats: it is used, for the formats it has, and ZXing is never loaded', async () => {
    const zxing = fakeZxing()
    const native = fakeDetector(['ean_13', 'qr_code', 'data_matrix'])
    const scanner = await createScanner(ITEM_FORMATS, env({ BarcodeDetector: native.Detector, loadZxing: zxing.load }))
    expect(scanner.reader).toBe('native')
    expect(native.constructed).toHaveBeenCalledWith(['ean_13', 'data_matrix'])
    expect(zxing.loaded).not.toHaveBeenCalled()
  })
})

describe('a camera read', () => {
  it('reports reader, format, value and the time from arming, once per value', async () => {
    const native = fakeDetector(['ean_13'], [[], [{ format: 'ean_13', rawValue: '6281234567893' }], [{ format: 'ean_13', rawValue: '6281234567893' }]])
    const e = env({ BarcodeDetector: native.Detector })
    const scanner = await createScanner(['ean_13'], e)
    const reads: ScanRead[] = []
    scanner.onRead((r) => reads.push(r))

    await scanner.start(video()) // armed at t=1000, frame 1 decodes nothing
    await flush()
    e.clock.t = 1350
    e.frames.shift()!() // frame 2: the pack
    await flush()
    expect(reads).toEqual([{ reader: 'native', format: 'ean_13', value: '6281234567893', msToRead: 350 }])

    e.clock.t = 1350 + REARM_MS + 10
    e.frames.shift()!() // the same pack still in front of the camera: not a second read
    await flush()
    expect(reads).toHaveLength(1)
    scanner.stop()
  })
})

describe('the keyboard wedge', () => {
  it('answers on Enter, timed from the first character', () => {
    let t = 0
    const wedge = createWedge(() => t)
    t = 100
    expect(wedge.key('6', '6')).toBeNull()
    t = 180
    expect(wedge.key('Enter', '6281234567893')).toEqual({ reader: 'wedge', format: 'keyboard', value: '6281234567893', msToRead: 80 })
  })

  it('an empty Enter is no read', () => {
    expect(createWedge(() => 0).key('Enter', '  ')).toBeNull()
  })
})

describe('one field takes typed codes and a wedge scanner', () => {
  const keyed = (value: string, msToRead: number): ScanRead => ({ reader: 'wedge', format: 'keyboard', value, msToRead })

  it('keyed at scanner speed: the wedge, timed', () => {
    expect(keyedEntry(keyed('6281234567893', 90))).toEqual({ entryMode: 'wedge', reader: 'wedge', msToRead: 90 })
  })

  it('keyed by hand: typed, with no reader and no time', () => {
    expect(keyedEntry(keyed('6281234567893', 2400))).toEqual({ entryMode: 'typed', reader: null, msToRead: null })
    expect(keyedEntry(keyed('10045', 10))).toEqual({ entryMode: 'typed', reader: null, msToRead: null })
  })
})
