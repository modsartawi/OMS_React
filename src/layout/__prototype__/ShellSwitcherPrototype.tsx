/* PROTOTYPE — throwaway (map 580, ticket 587). Never merge to main.
 * ← / → the rail's look, ↑ / ↓ the mark it carries. Dev chrome, so no t().
 */
import { useEffect } from 'react'
import PrototypeSwitcher from '@/core/ui/PrototypeSwitcher'
import { useShellProto, type ShellLook, type ShellMark } from './shell-proto'
import '@/app/prototype-dmsco-shell.css'

const LOOKS = [
  { key: 'flat', name: 'A — today’s rail, DMSCO palette (gold bar marker)' },
  { key: 'pill', name: 'B — the design’s top-bar treatment (deep navy, filled pill, gold icon)' },
]
const MARKS = [
  { key: 'dmsco', label: 'DMSCO lockup', proves: 'the company mark, white twin; the dotted D when collapsed' },
  { key: 'aldawaa', label: 'al-dawaa mark', proves: 'today’s gold glyph + BackOffice' },
  { key: 'both', label: 'Both', proves: 'DMSCO at the head, al-dawaa · BackOffice under it' },
]

export default function ShellSwitcherPrototype() {
  const { look, mark, setLook, setMark } = useShellProto()

  useEffect(() => {
    const root = document.documentElement
    root.dataset.shell = look
    // 584's compact skin set only the radius beyond what 585 moved into global.css.
    delete root.dataset.skin
  }, [look])

  return (
    <PrototypeSwitcher
      variants={LOOKS}
      variant={look}
      onVariant={(k) => setLook(k as ShellLook)}
      scenarios={MARKS}
      scenario={mark}
      onScenario={(k) => setMark(k as ShellMark)}
    />
  )
}
