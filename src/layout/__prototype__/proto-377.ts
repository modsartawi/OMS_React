/* PROTOTYPE 377 — throwaway (branch prototype/377-overlays, stacked on 363 + 362).
 *
 * Question: how do the app's OVERLAY surfaces look and sit under palette B and the
 * D rail shell? Five independent axes, switched live from the floating dev bar (or
 * `?fam=&toast=&pos=&bell=&host=` in the URL), so the owner can mix them:
 *
 *   fam   today | card | split   one overlay recipe, or navy-from-the-rail + card-elsewhere
 *   toast today | tinted | bar | ink   sonner look
 *   pos   top-right | top-end | bottom-end | bottom-center   (top-right = physical, as shipped)
 *   bell  today | dense | sheet  the notification panel
 *   host  root | dialog          where the Toaster mounts while a native <dialog> is open
 *
 * The look axes are CSS on `html[data-ov-*]` (global.css, PROTOTYPE 377 block);
 * position/host/bell are read by the components through this store.
 */
import { create } from 'zustand'

export type Fam = 'today' | 'card' | 'split'
export type ToastLook = 'today' | 'tinted' | 'bar' | 'ink'
export type ToastPos = 'top-right' | 'top-end' | 'bottom-end' | 'bottom-center'
export type BellLook = 'today' | 'dense' | 'sheet'
export type ToastHost = 'root' | 'dialog'
export type P377 = { fam: Fam; toast: ToastLook; pos: ToastPos; bell: BellLook; host: ToastHost }

export const AXES: { [K in keyof P377]: { key: P377[K]; label: string }[] } = {
  fam: [
    { key: 'today', label: 'today' },
    { key: 'card', label: 'one card family' },
    { key: 'split', label: 'navy on rail' },
  ],
  toast: [
    { key: 'today', label: 'today' },
    { key: 'tinted', label: 'tinted 082' },
    { key: 'bar', label: 'card + edge' },
    { key: 'ink', label: 'ink chip' },
  ],
  pos: [
    { key: 'top-right', label: 'top-right' },
    { key: 'top-end', label: 'top-end ↓bar' },
    { key: 'bottom-end', label: 'bottom-end' },
    { key: 'bottom-center', label: 'bottom-centre' },
  ],
  bell: [
    { key: 'today', label: 'today' },
    { key: 'dense', label: 'dense drop' },
    { key: 'sheet', label: 'sheet' },
  ],
  host: [
    { key: 'root', label: 'root' },
    { key: 'dialog', label: 'in dialog' },
  ],
}

const KEY = 'proto377'
const DEFAULTS: P377 = { fam: 'today', toast: 'today', pos: 'top-right', bell: 'today', host: 'root' }

function read(): P377 {
  let s: P377 = { ...DEFAULTS }
  try {
    const stored = localStorage.getItem(KEY)
    if (stored) s = { ...s, ...(JSON.parse(stored) as Partial<P377>) }
  } catch {
    /* prototype */
  }
  const q = new URLSearchParams(location.search)
  for (const k of Object.keys(AXES) as (keyof P377)[]) {
    const v = q.get(k)
    if (v && AXES[k].some((o) => o.key === v)) (s as Record<string, string>)[k] = v
  }
  return s
}

function paint(s: P377) {
  const d = document.documentElement.dataset
  d.ovFam = s.fam
  d.ovToast = s.toast
  try {
    localStorage.setItem(KEY, JSON.stringify(s))
  } catch {
    /* prototype */
  }
}

const initial = import.meta.env.DEV ? read() : DEFAULTS
if (import.meta.env.DEV) paint(initial)

export const useP377 = create<P377 & { set: (next: Partial<P377>) => void }>((set, get) => ({
  ...initial,
  set: (next) => {
    set(next)
    const { set: _omit, ...s } = get()
    paint(s)
  },
}))
