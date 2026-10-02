/* PROTOTYPE 363 — throwaway (branch prototype/363-rail-shell).
 *
 * Question: how does today's AppShell fold into the Ops Console's navy rail +
 * top bar? Four structurally different shells on the REAL app, picked by the
 * floating ProtoTokenBar (or `?shell=today|A|B|C|D&rtl=1&cmd=1` in the URL):
 *
 *   today — the shipped AppShell, for comparison
 *   A — Icon rail + flyout     (Far as drawn: 48px, one icon per GROUP, leaves in a flyout)
 *   B — Labelled rail + flyout (72px, icon + group name, same flyout)
 *   C — Rail + docked panel    (48px group rail + a 216px panel of the current group's leaves)
 *   D — Expanding rail         (one navy rail: 56px icons ↔ 240px full tree, pinned or not)
 *
 * `rtl` sets `dir="rtl"` on <html> before anything paints (and AG Grid reads it
 * at module load, hence the reload on change). `cmd` shows the Ctrl+K slot in the
 * top bar — 361 says the rail shows NO Ctrl+K hint until the keyboard step, so
 * the bar is drawn both ways.
 */
export type Shell = 'today' | 'A' | 'B' | 'C' | 'D'
export type Proto363 = { shell: Shell; rtl: boolean; cmd: boolean }

export const SHELLS: { key: Shell; name: string }[] = [
  { key: 'today', name: 'Today' },
  { key: 'A', name: 'A · Icon rail + flyout' },
  { key: 'B', name: 'B · Labelled rail' },
  { key: 'C', name: 'C · Rail + docked panel' },
  { key: 'D', name: 'D · Expanding rail' },
]

const KEY = 'proto363'
const DEFAULTS: Proto363 = { shell: 'A', rtl: false, cmd: false }

function read(): Proto363 {
  let s: Proto363 = { ...DEFAULTS }
  try {
    const stored = localStorage.getItem(KEY)
    if (stored) s = { ...s, ...(JSON.parse(stored) as Partial<Proto363>) }
  } catch {
    /* prototype */
  }
  const q = new URLSearchParams(location.search)
  const shell = q.get('shell')
  if (shell && SHELLS.some((x) => x.key === shell)) s.shell = shell as Shell
  if (q.get('rtl')) s.rtl = q.get('rtl') === '1'
  if (q.get('cmd')) s.cmd = q.get('cmd') === '1'
  try {
    localStorage.setItem(KEY, JSON.stringify(s))
  } catch {
    /* prototype */
  }
  return s
}

export const p363: Proto363 = import.meta.env.DEV ? read() : { ...DEFAULTS, shell: 'today' }

if (p363.rtl) document.documentElement.dir = 'rtl'

export function setP363(next: Partial<Proto363>) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...p363, ...next }))
  } catch {
    /* prototype */
  }
  const url = new URL(location.href)
  for (const k of ['shell', 'rtl', 'cmd']) url.searchParams.delete(k)
  location.replace(url.toString())
}
