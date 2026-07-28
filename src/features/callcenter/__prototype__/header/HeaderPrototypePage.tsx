/* PROTOTYPE — throwaway. Wayfinder ticket 175 (map 126), reaching 176 and 155.
 *
 * Three variants of the whole header-capture cluster on 135's settled furniture,
 * at /prototype/callcenter-header. Sub-shape B (its own page) for the same reason
 * 135 was: the console is chrome-less and full-viewport by ruling (map note 13).
 *
 *   ?variant=1|2|3   how the header is ARRANGED
 *   ?state=…         the ten states the arrangement must survive
 *   ?store=…         how the store is CHOSEN under collection — a third axis,
 *                    because "out of the whole estate, unfiltered" (154) is an
 *                    open question that outlives whichever arrangement wins
 */
import { useSearchParams } from 'react-router'
import PrototypeSwitcher from '@/core/ui/PrototypeSwitcher'
import { SCENARIOS } from './header-mock'
import HeaderHost from './HeaderHost'
import Variant1Ladder, { NAME as NAME_1 } from './Variant1Ladder'
import Variant2Panel, { NAME as NAME_2 } from './Variant2Panel'
import Variant3Chips, { NAME as NAME_3 } from './Variant3Chips'
import Variant4Hybrid, { NAME as NAME_4 } from './Variant4Hybrid'

const VARIANTS = [
  { key: '1', name: NAME_1, Component: Variant1Ladder },
  { key: '2', name: NAME_2, Component: Variant2Panel },
  { key: '3', name: NAME_3, Component: Variant3Chips },
  { key: '4', name: NAME_4, Component: Variant4Hybrid },
]

const STORE_SHAPES = [
  { key: 'grouped', name: 'City-grouped list', hint: "CC2's GetStoreAreas() parity · recents pinned" },
  { key: 'palette', name: 'Command palette', hint: 'One input, ranked, keyboard-first' },
  { key: 'drill', name: 'City then store', hint: 'Two steps, fewest choices at once' },
] as const

/** Which scenario shows a given surface open — so `/slot` in the command line
 *  lands on the slot picker, the way the real verb would. */
const SURFACE_STATE: Record<string, string> = {
  fulfilment: 'fulfilment',
  where: 'pickupStore',
  when: 'when',
  reference: 'reference',
  payment: 'payment',
}

export default function HeaderPrototypePage() {
  const [params, setParams] = useSearchParams()
  const variantKey = params.get('variant') ?? '4'
  const scenarioKey = params.get('state') ?? 'opening'
  const storeKey = (params.get('store') ?? 'grouped') as (typeof STORE_SHAPES)[number]['key']

  const variant = VARIANTS.find((v) => v.key === variantKey) ?? VARIANTS[0]
  const scenario = SCENARIOS.find((s) => s.key === scenarioKey) ?? SCENARIOS[0]
  const Variant = variant.Component

  const set = (k: string, v: string) => {
    const next = new URLSearchParams(params)
    next.set(k, v)
    setParams(next, { replace: true })
  }

  return (
    <div className="h-[calc(100vh-3.5rem)] w-screen overflow-hidden">
      <HeaderHost
        s={scenario.state}
        capture={<Variant s={scenario.state} storeShape={storeKey} />}
        // The command line's `/store`, `/slot`, `/pay` open the same sections the
        // chips do — one grammar, two ways in.
        onVerb={(surface) => set('state', SURFACE_STATE[surface] ?? scenarioKey)}
      />

      {/* The third axis. Only bites on the collection states, so it says so. */}
      <div className="pointer-events-auto fixed end-3 top-3 z-50 rounded-lg border border-border-strong bg-card p-2 shadow-lg">
        <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Store picker shape
        </div>
        <div className="flex flex-col gap-1">
          {STORE_SHAPES.map((sh) => (
            <button
              key={sh.key}
              type="button"
              onClick={() => set('store', sh.key)}
              className={`rounded-md px-2 py-1 text-start text-xs ${
                sh.key === storeKey ? 'bg-primary-050 text-primary-800 ring-1 ring-primary-border' : 'hover:bg-accent'
              }`}
            >
              <span className="block font-medium">{sh.name}</span>
              <span className="block text-[10px] text-muted-foreground">{sh.hint}</span>
            </button>
          ))}
        </div>
      </div>

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
