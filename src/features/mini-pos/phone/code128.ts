/**
 * A Code 128 encoder for the order number the submitted screen shows (spec 4063 story 22): the cashier scans it off the
 * phone with "Find in Orders", which reads the plain document number. Code 128 because every till scanner reads it and
 * a document number is all digits, which code set C packs two to a symbol, so the bars stay wide on a phone screen.
 *
 * Only encoding: a plain function from text to modules (true = bar), drawn by `Barcode.tsx`. The pattern table is the
 * standard one (ISO/IEC 15417), symbol values 0-105 then STOP; each entry is its bar/space widths, starting with a bar.
 */

const PATTERNS = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213',
  '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132',
  '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211',
  '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331',
  '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111',
  '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214',
  '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141',
  '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141',
  '114131', '311141', '411131', '211412', '211214', '211232', '2331112',
]

const CODE_B = 100
const START_B = 104
const START_C = 105
const STOP = 106

/** The symbol values for `text`: code set C over the longest even run of leading digits, code set B for the rest. */
export function code128Symbols(text: string): number[] {
  if (!text) throw new Error('Code 128 needs at least one character')
  for (const ch of text) {
    const c = ch.charCodeAt(0)
    if (c < 32 || c > 126) throw new Error(`Code 128 set B cannot carry character ${c}`)
  }

  const digits = /^\d*/.exec(text)![0]
  const pairs = digits.length >= 2 ? digits.length - (digits.length % 2) : 0
  const symbols: number[] = []
  if (pairs) {
    symbols.push(START_C)
    for (let i = 0; i < pairs; i += 2) symbols.push(Number(text.slice(i, i + 2)))
    if (pairs < text.length) symbols.push(CODE_B)
  } else {
    symbols.push(START_B)
  }
  for (const ch of text.slice(pairs)) symbols.push(ch.charCodeAt(0) - 32)

  let check = symbols[0]
  for (let i = 1; i < symbols.length; i++) check += symbols[i] * i
  symbols.push(check % 103, STOP)
  return symbols
}

/** The modules (true = bar) of `text`'s barcode, without its quiet zones. */
export function code128Modules(text: string): boolean[] {
  const modules: boolean[] = []
  for (const symbol of code128Symbols(text)) {
    const widths = PATTERNS[symbol]
    for (let i = 0; i < widths.length; i++) {
      const bar = i % 2 === 0
      for (let w = 0; w < Number(widths[i]); w++) modules.push(bar)
    }
  }
  return modules
}

/** The bars as runs `[start, width]` in modules: what an SVG draws, one rect per bar. */
export function code128Bars(text: string): [number, number][] {
  const modules = code128Modules(text)
  const bars: [number, number][] = []
  for (let i = 0; i < modules.length; i++) {
    if (!modules[i]) continue
    const start = i
    while (i + 1 < modules.length && modules[i + 1]) i++
    bars.push([start, i - start + 1])
  }
  return bars
}
