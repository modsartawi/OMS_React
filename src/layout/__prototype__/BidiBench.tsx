/* PROTOTYPE 378 — throwaway bench at /prototype/bidi (dev chrome, literal copy).
 *
 * 1. Every value shape the Ops Console shows × every isolation technique, under dir="rtl",
 *    alone (a grid cell) and inside an Arabic sentence. The READOUT is measured, not judged:
 *    each character's box is read back and sorted by x, so "visual" is what the eye sees
 *    left→right. ✓ = an LTR value reads in its own order.
 * 2. Plex Sans Arabic at 12px in a 26px row and a 28px control, at size-adjust 100/108/115%,
 *    with the ink's top/bottom gap measured against the row box.
 */
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import ar400 from '@/assets/fonts/ibm-plex-sans-arabic-arabic-400-normal.woff2?url'
import ar600 from '@/assets/fonts/ibm-plex-sans-arabic-arabic-600-normal.woff2?url'

type Shape = { id: string; label: string; v: string; from: string }
const SHAPES: Shape[] = [
  { id: 'win-dash', label: 'time window, en dash, no space', v: '15:00–18:00', from: '373 slot chip (header-chips.ts)' },
  { id: 'win-server', label: 'time window, server form', v: '10:00 - 12:00', from: 'grid Slot column, stub' },
  { id: 'day-win', label: 'day + window', v: '02 Oct 2026 · 10:00 - 12:00', from: '368 inspector slot' },
  { id: 'datetime', label: 'date-time', v: '2026-09-12 08:07', from: 'grid date columns (formatDateTime)' },
  { id: 'date', label: 'date', v: '2026-09-12', from: 'filters, Details' },
  { id: 'time', label: 'time', v: '08:07', from: '369 step times' },
  { id: 'phone-sp', label: 'phone, spaced', v: '+966 55 810 2177', from: 'Ltr.tsx origin case' },
  { id: 'phone-intl', label: 'phone, +, no space', v: '+966558102177', from: 'customerPhone' },
  { id: 'phone', label: 'phone, local', v: '0551234567', from: 'customerPhone' },
  { id: 'no', label: 'delivery no', v: '80001240', from: 'grid, crumb' },
  { id: 'code', label: 'code-dash-digits', v: 'ERX-77120934', from: 'Ltr.tsx safe list' },
  { id: 'money', label: 'money', v: '1,240.70', from: 'money columns (sans)' },
  { id: 'neg', label: 'negative money', v: '-5.00', from: '372 ZB01 −5.00' },
  { id: 'neg-u', label: 'negative, U+2212', v: '−5.00', from: 'typographic minus' },
  { id: 'pct', label: 'percent', v: '5%', from: 'condition rates' },
  { id: 'plus', label: 'count, capped', v: '7+', from: '366 lens counts' },
  { id: 'of', label: 'n of m', v: '40 / 200', from: '368 "N of M shown" if digits only' },
  { id: 'store', label: 'store code', v: '1001', from: 'store chip' },
  { id: 'store-city', label: 'code · Latin', v: '1001 · Riyadh', from: 'store pickers' },
  { id: 'courier-l', label: 'courier · Latin name', v: 'JAH · Khalid N.', from: '368 inspector courier' },
  { id: 'courier-a', label: 'courier · Arabic name', v: 'JAH · خالد ن.', from: '368 inspector courier (Arabic driver)' },
  { id: 'keys', label: 'key chord', v: 'Ctrl+K', from: '365 legends' },
  { id: 'keys-sp', label: 'key chord, spaced', v: 'Ctrl K', from: 'two <kbd> as text' },
]

type Tech = { k: string; label: string; wrap: (v: ReactNode, raw: string) => ReactNode; cellStyle?: React.CSSProperties }
const span = (v: ReactNode) => <span data-v>{v}</span>
const TECHS: Tech[] = [
  { k: 'none', label: 'none', wrap: (v) => span(v) },
  { k: 'ltr', label: '<bdi dir=ltr> (Ltr)', wrap: (v) => <bdi dir="ltr">{span(v)}</bdi> },
  { k: 'bdi', label: '<bdi> (auto)', wrap: (v) => <bdi>{span(v)}</bdi> },
  { k: 'lri', label: 'LRI…PDI in string', wrap: (_v, raw) => span('⁦' + raw + '⁩') },
  { k: 'fsi', label: 'FSI…PDI in string', wrap: (_v, raw) => span('⁨' + raw + '⁩') },
  { k: 'css', label: 'css isolate+ltr', wrap: (v) => <span style={{ unicodeBidi: 'isolate', direction: 'ltr' }}>{span(v)}</span> },
  {
    // The tempting mistake: isolate each END of a range (or each side of a pair) separately.
    k: 'ends',
    label: 'each end <Ltr> (split)',
    wrap: (_v, raw) => {
      const m = raw.match(/^(.*?)(\s?[–\-/·]\s?)([^–\-/·]*)$/)
      if (!m) return <bdi dir="ltr">{span(raw)}</bdi>
      return (
        <span data-v>
          <bdi dir="ltr">{m[1]}</bdi>
          {m[2]}
          <bdi dir="ltr">{m[3]}</bdi>
        </span>
      )
    },
  },
  { k: 'cellplain', label: 'cell: plaintext', wrap: (v) => span(v), cellStyle: { unicodeBidi: 'plaintext' } },
]

type Res = { shape: string; tech: string; ctx: string; visual: string; ok: boolean | null; align: 'start' | 'end' | '?' }

const hasArabic = (s: string) => /[؀-ۿ]/.test(s)

/** What the eye reads left→right: every character's box, sorted by x. */
function visualOf(root: Element): string {
  const out: { x: number; c: string }[] = []
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  const range = document.createRange()
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const text = n.textContent ?? ''
    for (let i = 0; i < text.length; i++) {
      const c = text[i]
      if (/[⁦-⁩]/.test(c)) continue
      range.setStart(n, i)
      range.setEnd(n, i + 1)
      const r = range.getBoundingClientRect()
      if (r.width === 0) continue
      out.push({ x: r.left + r.width / 2, c })
    }
  }
  return out
    .sort((a, b) => a.x - b.x)
    .map((o) => o.c)
    .join('')
}

function Specimen({ shape, tech, ctx }: { shape: Shape; tech: Tech; ctx: 'cell' | 'sentence' }) {
  const body = tech.wrap(shape.v, shape.v)
  return (
    <div
      dir="rtl"
      data-spec
      data-shape={shape.id}
      data-tech={tech.k}
      data-ctx={ctx}
      className="w-[190px] truncate rounded border border-border bg-card px-1.5 py-0.5 text-start text-[12px]"
      style={tech.cellStyle}
    >
      {ctx === 'cell' ? body : (
        <>
          <span>الموعد </span>
          {body}
          <span> اليوم</span>
        </>
      )}
    </div>
  )
}

function useMeasure(dep: unknown) {
  const [res, setRes] = useState<Res[]>([])
  useLayoutEffect(() => {
    const t = setTimeout(() => {
      const all: Res[] = []
      document.querySelectorAll<HTMLElement>('[data-spec]').forEach((el) => {
        const shape = SHAPES.find((s) => s.id === el.dataset.shape)!
        const v = el.querySelector('[data-v]')!
        const visual = visualOf(v)
        const want = shape.v.replace(/\s/g, '')
        const ok = hasArabic(shape.v) ? null : visual.replace(/\s/g, '') === want
        const box = el.getBoundingClientRect()
        const vr = (v as HTMLElement).getBoundingClientRect()
        const leftGap = vr.left - box.left
        const rightGap = box.right - vr.right
        const align = Math.abs(leftGap - rightGap) < 4 ? '?' : rightGap < leftGap ? 'start' : 'end' // RTL: start = right
        all.push({ shape: shape.id, tech: el.dataset.tech!, ctx: el.dataset.ctx!, visual, ok, align })
      })
      setRes(all)
      ;(window as unknown as { __bidi: Res[] }).__bidi = all
    }, 600)
    return () => clearTimeout(t)
  }, [dep])
  return res
}

const FONT_CSS = [100, 108, 115]
  .map(
    (n) =>
      `@font-face{font-family:'PSA${n}';src:url(${ar400}) format('woff2');font-weight:400;size-adjust:${n}%;}` +
      `@font-face{font-family:'PSA${n}';src:url(${ar600}) format('woff2');font-weight:600;size-adjust:${n}%;}`,
  )
  .join('')

type Ink = { label: string; top: number; bottom: number; inkH: number }

/** Ink box of the row's text against the row: baseline from a probe, ascent/descent from canvas. */
function inkGaps(row: HTMLElement, family: string, text: string): Ink {
  const probe = document.createElement('span')
  probe.style.cssText = 'display:inline-block;width:0;height:0;vertical-align:baseline'
  const host = row.querySelector('[data-text]') as HTMLElement
  host.appendChild(probe)
  const base = probe.getBoundingClientRect().top
  probe.remove()
  const cs = getComputedStyle(host)
  const ctx = document.createElement('canvas').getContext('2d')!
  ctx.font = `${cs.fontWeight} ${cs.fontSize} ${family}`
  const m = ctx.measureText(text)
  const r = row.getBoundingClientRect()
  const top = base - m.actualBoundingBoxAscent - r.top
  const bottom = r.bottom - (base + m.actualBoundingBoxDescent)
  return { label: row.dataset.row!, top: +top.toFixed(1), bottom: +bottom.toFixed(1), inkH: +(m.actualBoundingBoxAscent + m.actualBoundingBoxDescent).toFixed(1) }
}

const ROWS = [
  { k: 'latin', text: 'Noura Al-Harbi' },
  { k: 'arabic', text: 'نورة الحربي' },
  { k: 'arabic-deep', text: 'إيجابي يُجري' },
]

function ArabicSizes() {
  const [ink, setInk] = useState<Ink[]>([])
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    document.fonts.ready.then(() =>
      setTimeout(() => {
        const out: Ink[] = []
        ref.current?.querySelectorAll<HTMLElement>('[data-row]').forEach((row) => {
          out.push(inkGaps(row, getComputedStyle(row).fontFamily, row.dataset.sample!))
        })
        setInk(out)
        ;(window as unknown as { __ink: Ink[] }).__ink = out
      }, 400),
    )
  }, [])
  return (
    <section ref={ref} className="space-y-3">
      <style>{FONT_CSS}</style>
      <h2 className="text-sm font-semibold">2 · Plex Sans Arabic at 12px — 26px grid row, 28px control (size-adjust on the Arabic face only)</h2>
      <div className="grid grid-cols-3 gap-4" dir="rtl">
        {FONT_CSS && [100, 108, 115].map((n) => (
          <div key={n} className="space-y-1" style={{ fontFamily: `'IBM Plex Sans', 'PSA${n}', system-ui` }}>
            <div className="font-mono text-[11px] text-muted-foreground" dir="ltr">size-adjust {n}%</div>
            {ROWS.map((r) => (
              <div
                key={r.k}
                data-row={`${n}:${r.k}`}
                data-sample={r.text}
                className="flex h-[26px] items-center border-b border-divider bg-card px-2 text-[12px]"
                style={{ fontFamily: `'IBM Plex Sans', 'PSA${n}', system-ui` }}
              >
                <span data-text>{r.text}</span>
                <span className="ms-auto font-mono text-muted-foreground">80001240</span>
              </div>
            ))}
            <div className="flex h-[26px] items-center gap-2 bg-card px-2 text-[12px] font-semibold" data-row={`${n}:head`} data-sample="اسم العميل">
              <span data-text>اسم العميل</span>
              <span className="text-muted-foreground">Customer Name</span>
            </div>
            <div className="flex gap-2 pt-1">
              <button type="button" className="h-7 rounded-md bg-primary px-3 text-[12px] font-medium text-primary-foreground">تحميل</button>
              <button type="button" className="h-7 rounded-md border border-input px-3 text-[12px]">Load</button>
              <span className="flex h-7 items-center rounded-md border border-input px-2 text-[12px]">الكل ▾</span>
            </div>
            <p className="text-[12px] leading-[18px]">اضبط عوامل التصفية أعلاه ثم اختر «تحميل» للبحث في مستندات التوصيل رقم <bdi dir="ltr" className="font-mono">80001240</bdi>.</p>
          </div>
        ))}
      </div>
      <table className="text-[11px]" dir="ltr">
        <thead>
          <tr className="text-muted-foreground">
            <th className="pe-4 text-start">row</th><th className="pe-4">ink above</th><th className="pe-4">ink below</th><th>ink height</th>
          </tr>
        </thead>
        <tbody>
          {ink.map((i) => (
            <tr key={i.label} data-ink={i.label}>
              <td className="pe-4 font-mono">{i.label}</td>
              <td className="pe-4 text-center">{i.top}</td>
              <td className="pe-4 text-center">{i.bottom}</td>
              <td className="text-center">{i.inkH}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}

export default function BidiBench() {
  const res = useMeasure(1)
  const get = (s: string, t: string, c: string) => res.find((r) => r.shape === s && r.tech === t && r.ctx === c)
  return (
    <div className="min-h-screen space-y-6 bg-background p-4 text-foreground" dir="ltr">
      <h1 className="text-base font-semibold">PROTOTYPE 378 — bidi bench (dir="rtl" specimens; readouts are measured)</h1>
      <section className="space-y-2">
        <h2 className="text-sm font-semibold">1 · Value shapes × isolation — top: alone in an RTL cell · bottom: inside an Arabic sentence</h2>
        <div className="overflow-x-auto">
          <table className="border-separate border-spacing-1 text-[11px]">
            <thead>
              <tr>
                <th className="text-start">shape</th>
                {TECHS.map((t) => (
                  <th key={t.k} className="text-start font-mono font-normal text-muted-foreground">{t.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {SHAPES.map((s) => (
                <tr key={s.id} className="align-top">
                  <td className="w-[170px]">
                    <div className="font-mono">{s.v}</div>
                    <div className="text-muted-foreground">{s.label}</div>
                    <div className="text-[10px] text-ink-3">{s.from}</div>
                  </td>
                  {TECHS.map((t) => (
                    <td key={t.k} className="space-y-0.5">
                      {(['cell', 'sentence'] as const).map((c) => {
                        const r = get(s.id, t.k, c)
                        return (
                          <div key={c}>
                            <Specimen shape={s} tech={t} ctx={c} />
                            <div dir="ltr" className={'font-mono text-[10px] ' + (r?.ok === false ? 'text-danger-800' : r?.ok ? 'text-success-800' : 'text-muted-foreground')}>
                              {r ? `${r.ok === null ? '👁' : r.ok ? '✓' : '✗'} ${r.visual}${c === 'cell' ? ` · ${r.align}` : ''}` : '…'}
                            </div>
                          </div>
                        )
                      })}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <ArabicSizes />
    </div>
  )
}
