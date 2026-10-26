/* PROTOTYPE — throwaway (map 580, ticket 584). Never merge to main.
 * Switches the DMSCO skins over the real app: ← / → cycle. Dev chrome, so no t().
 */
import { useEffect, useState } from 'react'
import PrototypeSwitcher from '@/core/ui/PrototypeSwitcher'
import '@/app/prototype-dmsco-skin.css'

const VARIANTS = [
  { key: 'current', name: 'Current (palette B)' },
  { key: 'dmsco', name: 'DMSCO — compact (today’s density)' },
  { key: 'dmsco-scale', name: 'DMSCO — design scale (HR site sizes)' },
]
const SCENARIOS = [{ key: 'live', label: 'Live staging data', proves: 'real rows, real density' }]

function readSkin(): string {
  try {
    return localStorage.getItem('proto.skin') ?? 'dmsco'
  } catch {
    return 'dmsco'
  }
}

export default function SkinSwitcherPrototype() {
  const [skin, setSkin] = useState(readSkin)

  useEffect(() => {
    document.documentElement.dataset.skin = skin
    try {
      localStorage.setItem('proto.skin', skin)
    } catch {
      /* private window — the skin just won't persist */
    }
  }, [skin])

  return (
    <PrototypeSwitcher
      variants={VARIANTS}
      variant={skin}
      onVariant={setSkin}
      scenarios={SCENARIOS}
      scenario="live"
      onScenario={() => {}}
    />
  )
}
