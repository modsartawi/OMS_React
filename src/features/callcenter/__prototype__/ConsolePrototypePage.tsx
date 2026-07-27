/* PROTOTYPE — throwaway. Wayfinder ticket 135 (map 126).
 *
 * Three variants of the call-center agent console, switchable via `?variant=`,
 * on the throwaway route /prototype/callcenter-console. Sub-shape B (a new
 * page) because the console is chrome-less and full-viewport by ruling — map
 * note 13 — so there is no host page to embed it in.
 *
 * `?state=` drives which contract state is drawn; every one of them is a state
 * the ticket says the layout must survive. Designed at 1440×900, degrades to
 * 1280 (assumption — nobody has told me what the agents actually sit at).
 */
import { useSearchParams } from 'react-router'
import PrototypeSwitcher from '@/core/ui/PrototypeSwitcher'
import { SCENARIOS } from './mock-state'
import { DeniedScreen, RefusedExistingScreen } from './parts'
import VariantA, { NAME as NAME_A } from './VariantA'
import VariantB, { NAME as NAME_B } from './VariantB'
import VariantC, { NAME as NAME_C } from './VariantC'

const VARIANTS = [
  { key: 'A', name: NAME_A, Component: VariantA },
  { key: 'B', name: NAME_B, Component: VariantB },
  { key: 'C', name: NAME_C, Component: VariantC },
]

export default function ConsolePrototypePage() {
  const [params, setParams] = useSearchParams()
  const variantKey = params.get('variant') ?? 'A'
  const scenarioKey = params.get('state') ?? 'priced'

  const variant = VARIANTS.find((v) => v.key === variantKey) ?? VARIANTS[0]
  const scenario = SCENARIOS.find((s) => s.key === scenarioKey) ?? SCENARIOS[3]
  const s = scenario.state
  const Variant = variant.Component

  const set = (k: string, v: string) => {
    const next = new URLSearchParams(params)
    next.set(k, v)
    setParams(next, { replace: true })
  }

  return (
    // The console gets the viewport minus a band for the dev switcher — the bar
    // would otherwise sit on top of exactly what each variant puts at the
    // bottom (A's offer strip, B's money bar, C's total).
    <div className="h-[calc(100vh-3.5rem)] w-screen overflow-hidden">
      {s.phase === 'denied' ? (
        <DeniedScreen />
      ) : s.phase === 'refusedExisting' && s.existing ? (
        <RefusedExistingScreen e={s.existing} />
      ) : (
        <Variant s={s} scenarioKey={scenario.key} />
      )}

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
