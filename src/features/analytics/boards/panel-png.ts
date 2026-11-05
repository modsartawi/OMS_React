import type { AnalyticsChartType } from '@/core/models/analytics'

/**
 * A panel's chart as a PNG (spec 766 §F, ticket 773): serialised from the chart's own SVG, never a
 * screenshot. The chart paints through tokens (`fill="var(--chart-N)"`), which a detached SVG image cannot
 * resolve, so each element's COMPUTED paint and type are written onto the copy first — the picture is the
 * colours on screen, in the active theme. The SVG panes (a combo has two) stack top to bottom, and the
 * legend (HTML in Recharts) is drawn under them as swatch + label.
 *
 * The forms drawn in HTML — the KPI tile, the table, the heatmap grid — have no SVG to serialise:
 * {@link drawsAsPicture} says so and the action is disabled with its reason (the CSV and xlsx stand).
 */

const PICTURE_FORMS: readonly AnalyticsChartType[] = ['bar', 'line', 'area', 'donut', 'combo']
export const drawsAsPicture = (type: AnalyticsChartType): boolean => PICTURE_FORMS.includes(type)

const PAINT = [
  'fill',
  'fill-opacity',
  'stroke',
  'stroke-opacity',
  'stroke-width',
  'stroke-dasharray',
  'opacity',
  'font-family',
  'font-size',
  'font-weight',
  'text-anchor',
  'dominant-baseline',
  'visibility',
] as const

const SCALE = 2
const PAD = 16

/** The chart panes inside `root`: Recharts surfaces, not the legend's own little icon surfaces. */
function panes(root: HTMLElement): SVGSVGElement[] {
  return [...root.querySelectorAll<SVGSVGElement>('svg.recharts-surface')].filter((s) => !s.closest('.recharts-legend-wrapper'))
}

function inlined(svg: SVGSVGElement): { markup: string; width: number; height: number } {
  const { width, height } = svg.getBoundingClientRect()
  const copy = svg.cloneNode(true) as SVGSVGElement
  const from = [svg, ...svg.querySelectorAll('*')]
  const to = [copy, ...copy.querySelectorAll('*')]
  from.forEach((el, i) => {
    const style = getComputedStyle(el)
    const target = to[i] as SVGElement
    for (const p of PAINT) {
      const v = style.getPropertyValue(p)
      if (v) target.style.setProperty(p, v)
    }
  })
  copy.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  copy.setAttribute('width', String(width))
  copy.setAttribute('height', String(height))
  return { markup: new XMLSerializer().serializeToString(copy), width, height }
}

function image(markup: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('svg image failed'))
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`
  })
}

type LegendItem = { colour: string; text: string; font: string; ink: string }

function legend(root: HTMLElement): LegendItem[] {
  return [...root.querySelectorAll<HTMLElement>('.recharts-legend-item')].map((li) => {
    const label = li.querySelector<HTMLElement>('.recharts-legend-item-text') ?? li
    const mark = li.querySelector('path, rect, circle, line')
    const markStyle = mark ? getComputedStyle(mark) : null
    const colour = markStyle && markStyle.fill !== 'none' ? markStyle.fill : (markStyle?.stroke ?? 'gray')
    const s = getComputedStyle(label)
    return { colour, text: label.textContent ?? '', font: `${s.fontWeight} ${s.fontSize} ${s.fontFamily}`, ink: s.color }
  })
}

/** The PNG of the chart in `root`, on `background`; `null` when there is no SVG chart there. */
export async function chartPng(root: HTMLElement, background: string): Promise<Blob | null> {
  const svgs = panes(root).map(inlined)
  if (svgs.length === 0) return null
  const images = await Promise.all(svgs.map((s) => image(s.markup)))
  const items = legend(root)

  const width = Math.ceil(Math.max(...svgs.map((s) => s.width))) + PAD * 2
  const legendRow = items.length ? 28 : 0
  const height = Math.ceil(svgs.reduce((h, s) => h + s.height, 0)) + PAD * 2 + legendRow

  const canvas = document.createElement('canvas')
  canvas.width = width * SCALE
  canvas.height = height * SCALE
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.scale(SCALE, SCALE)
  ctx.fillStyle = background
  ctx.fillRect(0, 0, width, height)
  let y = PAD
  images.forEach((img, i) => {
    ctx.drawImage(img, PAD, y, svgs[i].width, svgs[i].height)
    y += svgs[i].height
  })

  // The legend, left to right like the chart box (which is always `dir="ltr"`, 766 §F).
  ctx.direction = 'ltr'
  ctx.textBaseline = 'middle'
  let x = PAD
  const mid = y + legendRow / 2
  for (const item of items) {
    ctx.fillStyle = item.colour
    ctx.fillRect(x, mid - 5, 10, 10)
    x += 16
    ctx.font = item.font
    ctx.fillStyle = item.ink
    ctx.fillText(item.text, x, mid)
    x += ctx.measureText(item.text).width + 16
  }

  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/png'))
}
