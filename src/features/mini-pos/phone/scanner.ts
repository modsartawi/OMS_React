import type * as ZXingModule from '@zxing/library'

/**
 * The phone's scanner adapter (spec 4063, ticket 916), lifted from the 3709 prototype: the built-in `BarcodeDetector`
 * when Chrome offers one for the wanted formats, ZXing (`@zxing/library`, loaded only then) otherwise, and a
 * keyboard-wedge input beside both. Every read reports its reader, its format, its value and the time it took from
 * arming to the read; the add-item verb sends them on (the scan event, BackOffice 4073).
 *
 * Format names are the built-in detector's (`ean_13`, `data_matrix`, `qr_code`): ZXing's `EAN_13` is lowered to match,
 * so a read means the same whichever reader made it.
 */

export type ScanReader = 'native' | 'zxing' | 'wedge'

export interface ScanRead {
  reader: ScanReader
  format: string
  value: string
  msToRead: number
}

/** The adapter contract, from the 3709 prototype, plus which camera reader it chose (shown, and sent on add). */
export interface BarcodeScanner {
  readonly reader: 'native' | 'zxing'
  start(video: HTMLVideoElement): Promise<void>
  stop(): void
  onRead(cb: (r: ScanRead) => void): void
  /** Present when the camera track offers a torch; resolves false when the phone refused to switch it. */
  torch?(on: boolean): Promise<boolean>
}

/** A format both readers can be asked for. */
export type ScanFormat = 'ean_13' | 'ean_8' | 'upc_a' | 'code_128' | 'data_matrix' | 'qr_code'

/** The shop floor's item codes: pack barcodes and the serialised pack's DataMatrix. */
export const ITEM_FORMATS: readonly ScanFormat[] = ['ean_13', 'ean_8', 'upc_a', 'code_128', 'data_matrix']

/** The pharmacy's unlock code (the till screen's changing QR, or the printed one). */
export const PHARMACY_CODE_FORMATS: readonly ScanFormat[] = ['qr_code']

/** One frame's read, before it is timed. */
export interface FrameHit {
  format: string
  value: string
}

type FrameDecoder = (video: HTMLVideoElement) => Promise<FrameHit | null>

interface DetectedBarcode {
  format: string
  rawValue: string
}

interface BarcodeDetectorInstance {
  detect(source: HTMLVideoElement): Promise<DetectedBarcode[]>
}

export interface BarcodeDetectorClass {
  new (options: { formats: string[] }): BarcodeDetectorInstance
  getSupportedFormats(): Promise<string[]>
}

/** Everything the adapter reaches outside itself, so a test can stand in for the phone. */
export interface ScannerEnv {
  /** The built-in detector's class, when the browser has one. */
  BarcodeDetector?: BarcodeDetectorClass
  loadZxing(): Promise<typeof ZXingModule>
  getUserMedia(constraints: MediaStreamConstraints): Promise<MediaStream>
  /** A 2D canvas for ZXing's frame grab. */
  createCanvas(): HTMLCanvasElement
  now(): number
  requestFrame(cb: () => void): void
}

export function browserEnv(): ScannerEnv {
  const detector = (globalThis as { BarcodeDetector?: BarcodeDetectorClass }).BarcodeDetector
  return {
    BarcodeDetector: detector,
    loadZxing: () => import('@zxing/library'),
    getUserMedia: (c) => navigator.mediaDevices.getUserMedia(c),
    createCanvas: () => document.createElement('canvas'),
    now: () => performance.now(),
    requestFrame: (cb) => {
      requestAnimationFrame(() => cb())
    },
  }
}

/** The built-in detector for `formats`, or null when there is none or it reads none of them. */
async function nativeDecoder(env: ScannerEnv, formats: readonly ScanFormat[]): Promise<FrameDecoder | null> {
  const Detector = env.BarcodeDetector
  if (!Detector) return null
  try {
    const supported = await Detector.getSupportedFormats()
    const wanted = formats.filter((f) => supported.includes(f))
    if (!wanted.length) return null
    const detector = new Detector({ formats: wanted })
    return async (video) => {
      const codes = await detector.detect(video)
      return codes.length ? { format: codes[0].format, value: codes[0].rawValue } : null
    }
  } catch {
    return null
  }
}

const ZXING_FORMAT: Record<ScanFormat, keyof typeof ZXingModule.BarcodeFormat> = {
  ean_13: 'EAN_13',
  ean_8: 'EAN_8',
  upc_a: 'UPC_A',
  code_128: 'CODE_128',
  data_matrix: 'DATA_MATRIX',
  qr_code: 'QR_CODE',
}

/** ZXing over a down-scaled luminance grab of the frame, as the prototype measured it. */
async function zxingDecoder(env: ScannerEnv, formats: readonly ScanFormat[]): Promise<FrameDecoder> {
  const Z = await env.loadZxing()
  const hints = new Map<ZXingModule.DecodeHintType, unknown>()
  hints.set(Z.DecodeHintType.POSSIBLE_FORMATS, formats.map((f) => Z.BarcodeFormat[ZXING_FORMAT[f]]))
  hints.set(Z.DecodeHintType.TRY_HARDER, true)
  const reader = new Z.MultiFormatReader()
  reader.setHints(hints)
  const canvas = env.createCanvas()
  const ctx = canvas.getContext('2d', { willReadFrequently: true })

  return async (video) => {
    const vw = video.videoWidth
    if (!vw || !ctx) return null
    const scale = Math.min(1, 960 / vw)
    const w = Math.round(vw * scale)
    const h = Math.round(video.videoHeight * scale)
    canvas.width = w
    canvas.height = h
    ctx.drawImage(video, 0, 0, w, h)
    const px = ctx.getImageData(0, 0, w, h).data
    const lum = new Uint8ClampedArray(w * h)
    for (let i = 0, j = 0; j < lum.length; i += 4, j++) lum[j] = (px[i] * 77 + px[i + 1] * 150 + px[i + 2] * 29) >> 8
    try {
      const bitmap = new Z.BinaryBitmap(new Z.HybridBinarizer(new Z.RGBLuminanceSource(lum, w, h)))
      const res = reader.decode(bitmap)
      return { format: String(Z.BarcodeFormat[res.getBarcodeFormat()]).toLowerCase(), value: res.getText() }
    } catch {
      return null // nothing this frame
    } finally {
      reader.reset()
    }
  }
}

/** After a read, the same value is not reported again for this long (the pack is still in front of the camera). */
export const REARM_MS = 1200

/**
 * The camera scanner for `formats`: built-in when the phone has a detector for them, else ZXing. It runs frame by
 * frame from `start` until `stop`, reports each read once, and re-arms after {@link REARM_MS}.
 */
export async function createScanner(
  formats: readonly ScanFormat[],
  env: ScannerEnv = browserEnv(),
): Promise<BarcodeScanner> {
  const native = await nativeDecoder(env, formats)
  const decode = native ?? (await zxingDecoder(env, formats))
  const reader: 'native' | 'zxing' = native ? 'native' : 'zxing'

  const listeners: ((r: ScanRead) => void)[] = []
  let stream: MediaStream | null = null
  let running = false
  let armedAt = 0
  let quietUntil = 0
  let lastValue = ''

  const loop = async (video: HTMLVideoElement) => {
    if (!running) return
    const now = env.now()
    if (now >= quietUntil && video.readyState >= 2) {
      let hit: FrameHit | null = null
      try {
        hit = await decode(video)
      } catch {
        hit = null
      }
      if (running && hit && hit.value) {
        const at = env.now()
        const repeat = hit.value === lastValue && at < quietUntil + REARM_MS
        if (!repeat) {
          const read: ScanRead = { reader, format: hit.format, value: hit.value, msToRead: Math.round(at - armedAt) }
          listeners.forEach((cb) => cb(read))
        }
        lastValue = hit.value
        quietUntil = at + REARM_MS
        armedAt = quietUntil
      }
    }
    env.requestFrame(() => void loop(video))
  }

  const scanner: BarcodeScanner = {
    reader,
    async start(video) {
      scanner.stop()
      stream = await env.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
      })
      video.srcObject = stream
      video.setAttribute('playsinline', '')
      video.muted = true
      await video.play()
      const track = stream.getVideoTracks()[0]
      try {
        await track?.applyConstraints({ advanced: [{ focusMode: 'continuous' } as MediaTrackConstraintSet] })
      } catch {
        /* a phone without continuous focus reads anyway */
      }
      running = true
      armedAt = env.now()
      quietUntil = 0
      lastValue = ''
      void loop(video)
    },
    stop() {
      running = false
      stream?.getTracks().forEach((t) => t.stop())
      stream = null
    },
    onRead(cb) {
      listeners.push(cb)
    },
    async torch(on) {
      const track = stream?.getVideoTracks()[0]
      const caps = (track?.getCapabilities?.() ?? {}) as { torch?: boolean }
      if (!track || !caps.torch) return false
      try {
        await track.applyConstraints({ advanced: [{ torch: on } as MediaTrackConstraintSet] })
        return true
      } catch {
        return false
      }
    },
  }
  return scanner
}

/**
 * A hardware scanner that types into a field and ends with Enter (the keyboard wedge). Feed it every key of the
 * field; it answers the read on Enter, timed from the first character, and `null` otherwise.
 */
export function createWedge(now: () => number = () => performance.now()) {
  let startedAt = 0
  return {
    key(key: string, value: string): ScanRead | null {
      if (key === 'Enter') {
        const at = now()
        const ms = startedAt ? Math.round(at - startedAt) : 0
        startedAt = 0
        const trimmed = value.trim()
        return trimmed ? { reader: 'wedge', format: 'keyboard', value: trimmed, msToRead: ms } : null
      }
      if (!startedAt && key.length === 1) startedAt = now()
      return null
    },
  }
}

/** A hardware scanner types a code in well under this per character; a person never does. */
export const WEDGE_MS_PER_CHAR = 35

/**
 * One field takes both a typed code and a wedge scanner's (the scanner types into whatever has focus). A read keyed
 * in at scanner speed is the wedge's; anything slower is typed by hand, and reports no reader and no time-to-read.
 */
export function keyedEntry(read: ScanRead): { entryMode: 'wedge' | 'typed'; reader: 'wedge' | null; msToRead: number | null } {
  const wedge = read.value.length >= 6 && read.msToRead <= read.value.length * WEDGE_MS_PER_CHAR
  return wedge ? { entryMode: 'wedge', reader: 'wedge', msToRead: read.msToRead } : { entryMode: 'typed', reader: null, msToRead: null }
}
