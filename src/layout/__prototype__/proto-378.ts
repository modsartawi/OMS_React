/* PROTOTYPE 378 — throwaway (branch prototype/378-rtl, stacked on 363's rail).
 *
 * Question: what does the Ops Console FOUNDATION (362 tokens + density, 359 Plex incl.
 * Plex Sans Arabic, 363 rail shell D) need to hold up under dir="rtl" with Arabic text?
 *
 *   ?ar=1        Arabic: dir="rtl" lang="ar", an Arabic stub merged over the shell's
 *                strings, Arabic names/cities/drivers in the stub rows
 *   ?fix=0|1     0 = the foundation as 363 left it; 1 = the proposed fixes:
 *                  - provideGlobalGridOptions({ enableRtl }) once at boot (every grid)
 *                  - Ltr cell renderer on the digit-and-space columns (slot, dates, phones)
 *                  - pinned:'left' → the side that is START in the page's direction
 *                  - key legends + crumb record number LTR-isolated
 *   ?arsize=100|108|115   size-adjust on Plex Sans Arabic only (Latin untouched)
 *   ?sep=slash|chevron    breadcrumb separator
 *
 * Bench: /prototype/bidi — every value shape × every isolation technique, measured.
 */
import i18n from 'i18next'
import { provideGlobalGridOptions } from 'ag-grid-community'
import { AR } from './proto-378-ar'
import ar400 from '@/assets/fonts/ibm-plex-sans-arabic-arabic-400-normal.woff2?url'
import ar500 from '@/assets/fonts/ibm-plex-sans-arabic-arabic-500-normal.woff2?url'
import ar600 from '@/assets/fonts/ibm-plex-sans-arabic-arabic-600-normal.woff2?url'
import ar700 from '@/assets/fonts/ibm-plex-sans-arabic-arabic-700-normal.woff2?url'

export type Proto378 = { ar: boolean; fix: boolean; iso: boolean; arsize: number; sep: 'slash' | 'chevron' }
const KEY = 'proto378'
const DEFAULTS: Proto378 = { ar: false, fix: false, iso: true, arsize: 100, sep: 'slash' }

function read(): Proto378 {
  let s: Proto378 = { ...DEFAULTS }
  try {
    const stored = localStorage.getItem(KEY)
    if (stored) s = { ...s, ...(JSON.parse(stored) as Partial<Proto378>) }
  } catch {
    /* prototype */
  }
  const q = new URLSearchParams(location.search)
  if (q.get('ar')) s.ar = q.get('ar') === '1'
  if (q.get('fix')) s.fix = q.get('fix') === '1'
  if (q.get('iso')) s.iso = q.get('iso') === '1'
  if (q.get('arsize')) s.arsize = Number(q.get('arsize')) || 100
  if (q.get('sep') === 'slash' || q.get('sep') === 'chevron') s.sep = q.get('sep') as Proto378['sep']
  try {
    localStorage.setItem(KEY, JSON.stringify(s))
  } catch {
    /* prototype */
  }
  return s
}

export const p378: Proto378 = import.meta.env.DEV ? read() : DEFAULTS

export function setP378(next: Partial<Proto378>) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...p378, ...next }))
  } catch {
    /* prototype */
  }
  const url = new URL(location.href)
  for (const k of ['ar', 'fix', 'iso', 'arsize', 'sep']) url.searchParams.delete(k)
  location.replace(url.toString())
}

if (p378.ar) {
  document.documentElement.dir = 'rtl'
  document.documentElement.lang = 'ar'
  for (const [ns, bundle] of Object.entries(AR)) i18n.addResourceBundle('en', ns, bundle, true, true)
}
// One call: a second provideGlobalGridOptions REPLACES the first (measured).
// suppressColumnVirtualisation is a measurement aid only (every column in the DOM).
provideGlobalGridOptions({
  ...(p378.ar ? { suppressColumnVirtualisation: true } : {}),
  // THE proposed rule: direction is an app-boot fact, given to every grid at once.
  ...(p378.fix ? { enableRtl: document.documentElement.dir === 'rtl' } : {}),
})
if (p378.fix) document.documentElement.dataset.p378fix = '1'
if (p378.arsize !== 100) {
  const css = [ar400, ar500, ar600, ar700]
    .map(
      (src, i) => `@font-face{font-family:'IBM Plex Sans Arabic';src:url(${src}) format('woff2');font-weight:${400 + i * 100};font-display:swap;size-adjust:${p378.arsize}%;unicode-range:U+0600-06FF,U+0750-077F,U+0870-088E,U+08A0-08FF,U+FB50-FDFF,U+FE70-FEFF;}`,
    )
    .join('')
  const el = document.createElement('style')
  el.textContent = css
  document.head.appendChild(el)
}
