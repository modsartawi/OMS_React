import { describe, expect, it } from 'vitest'
import { BarcodeFormat, BinaryBitmap, Code128Reader, HybridBinarizer, RGBLuminanceSource } from '@zxing/library'
import { code128Modules, code128Symbols } from './code128'

// The order barcode must scan back to the plain document number (spec 4032 story 22, "Find in Orders" reads it).
// Proved by reading what the encoder draws with an independent decoder: ZXing's Code 128 reader.

function decode(text: string): { text: string; format: string } {
  const modules = code128Modules(text)
  const scale = 3
  const quiet = 10
  const width = (modules.length + 2 * quiet) * scale
  const height = 24
  const lum = new Uint8ClampedArray(width * height).fill(255)
  for (let y = 0; y < height; y++)
    modules.forEach((bar, i) => {
      if (!bar) return
      for (let s = 0; s < scale; s++) lum[y * width + (quiet + i) * scale + s] = 0
    })
  const result = new Code128Reader().decode(new BinaryBitmap(new HybridBinarizer(new RGBLuminanceSource(lum, width, height))))
  return { text: result.getText(), format: BarcodeFormat[result.getBarcodeFormat()] }
}

describe('the order barcode scans back to the order number', () => {
  it.each(['1000001181', '100000118', '20261119000042', 'MP-42', '7'])('%s', (orderNo) => {
    expect(decode(orderNo)).toEqual({ text: orderNo, format: 'CODE_128' })
  })

  it('an even run of digits is packed two to a symbol (set C)', () => {
    // start C, 5 pairs, check, stop
    expect(code128Symbols('1000001181')).toEqual([105, 10, 0, 0, 11, 81, expect.any(Number), 106])
  })

  it('a character set B cannot carry is refused, not drawn wrong', () => {
    expect(() => code128Symbols('طلب')).toThrow()
    expect(() => code128Symbols('')).toThrow()
  })
})
