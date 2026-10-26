/* PROTOTYPE — throwaway (map 580, tickets 587 + 586). Never merge to main.
 * 587 is settled (DMSCO lockup + look B), so the bar now switches 586's dark candidates:
 * ← / → the theme. Dev chrome, so no t().
 */
import { useEffect, useState } from 'react'
import PrototypeSwitcher from '@/core/ui/PrototypeSwitcher'
import { useTheme } from '../theme'
import '@/app/prototype-dmsco-shell.css'

const THEMES = [
  { key: 'light', name: 'Light (585, for reference)' },
  { key: 'graphite', name: 'Dark A — graphite: hueless greys, like light (R1)' },
  { key: 'navy', name: 'Dark B — navy night: today’s navy-tinted ladder' },
]
const SCENARIOS = [{ key: 'live', label: 'Live staging data', proves: 'real rows, real density' }]

function read(): string {
  try {
    return localStorage.getItem('proto.dark') ?? 'graphite'
  } catch {
    return 'graphite'
  }
}

export default function ShellSwitcherPrototype() {
  const [theme, setTheme] = useState(read)
  const dark = useTheme((s) => s.dark)
  const toggle = useTheme((s) => s.toggle)

  useEffect(() => {
    const root = document.documentElement
    root.dataset.shell = 'pill'
    delete root.dataset.skin
    root.dataset.dark = theme
    if ((theme !== 'light') !== dark) toggle()
    try {
      localStorage.setItem('proto.dark', theme)
      localStorage.setItem('proto.shell.mark', 'dmsco')
    } catch {
      /* private window */
    }
  }, [theme, dark, toggle])

  return (
    <PrototypeSwitcher
      variants={THEMES}
      variant={theme}
      onVariant={setTheme}
      scenarios={SCENARIOS}
      scenario="live"
      onScenario={() => {}}
    />
  )
}
