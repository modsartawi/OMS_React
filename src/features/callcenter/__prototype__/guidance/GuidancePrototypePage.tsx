/* PROTOTYPE — throwaway. Wayfinder ticket 138 (map 126).
 *
 * Three treatments of the near-miss guidance surface, switchable via
 * `?variant=`, mounted INSIDE 135's chosen console (variant A: three fixed
 * columns) so each is judged against the basket it competes with for vertical
 * space — 135 amendment 2's density budget, which this ticket inherits.
 *
 * Route: /prototype/near-miss-guidance?variant=1|2|3&state=…
 *
 * `?state=` drives the guidance data. Every scenario is a question 138 asks:
 * three classes in one list · a grouping is a set · what the card may promise ·
 * one-click add and what happens next · get-side absence.
 */
import { useSearchParams } from 'react-router'
import PrototypeSwitcher from '@/core/ui/PrototypeSwitcher'
import { SCENARIOS } from './guidance-mock'
import HostConsole from './HostConsole'
import Variant1Strip, { NAME as NAME_1 } from './Variant1Strip'
import Variant2Focus, { NAME as NAME_2 } from './Variant2Focus'
import Variant3Ledger, { NAME as NAME_3 } from './Variant3Ledger'

const VARIANTS = [
  { key: '1', name: NAME_1, Component: Variant1Strip },
  { key: '2', name: NAME_2, Component: Variant2Focus },
  { key: '3', name: NAME_3, Component: Variant3Ledger },
]

export default function GuidancePrototypePage() {
  const [params, setParams] = useSearchParams()
  const variantKey = params.get('variant') ?? '1'
  const scenarioKey = params.get('state') ?? 'three'

  const variant = VARIANTS.find((v) => v.key === variantKey) ?? VARIANTS[0]
  const scenario = SCENARIOS.find((s) => s.key === scenarioKey) ?? SCENARIOS[0]
  const s = scenario.state
  const Guidance = variant.Component

  const set = (k: string, v: string) => {
    const next = new URLSearchParams(params)
    next.set(k, v)
    setParams(next, { replace: true })
  }

  const actionableCount = s.nearMisses.filter((n) => n.klass === 'actionable').length

  return (
    // Viewport minus a band for the dev switcher — the bar would otherwise sit
    // on top of exactly the region being judged.
    <div className="h-[calc(100vh-3.5rem)] w-screen overflow-hidden">
      <HostConsole
        s={s}
        actionableCount={actionableCount}
        guidance={<Guidance key={`${variant.key}-${scenario.key}`} s={s} />}
      />

      <PrototypeSwitcher
        variants={VARIANTS.map(({ key, name }) => ({ key, name }))}
        variant={variant.key}
        onVariant={(k) => set('variant', k)}
        scenarios={SCENARIOS.map(({ key, label, proves }) => ({ key, label, proves }))}
        scenario={scenario.key}
        onScenario={(k) => set('state', k)}
      />
    </div>
  )
}
