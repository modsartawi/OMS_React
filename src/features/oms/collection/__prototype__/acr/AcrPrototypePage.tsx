/* PROTOTYPE — throwaway. Wayfinder ticket 247 (map 240) — breaker gate 2.
 *
 * Three readings of the ACR — نموذج متابعة المبيعات النقدية ومبيعات الشبكة
 * بالصيدليات — switchable via `?variant=`, each paginated onto real A4 sides on
 * the print geometry ticket 241 chose, with the paper original pinned beside
 * them so the sign-off is literally side by side.
 *
 * Route: /prototype/acr-form?variant=A|B|C&state=…&solo=1
 *   ← / →   variant   ·   ↑ / ↓   scenario   ·   `?solo=1` drops the paper pane
 *
 * Where this differs from 246's receipt: the receipt is ONE page per shift, and
 * this form is not. Every scenario here is chosen to put the break somewhere
 * awkward — three full pages, a last page carrying a single row, a short last
 * page on an OPEN ACR, and the idle ACR that still prints one page — because
 * "where do the pages break, and does the last-page block land where the paper
 * puts it" is the half of this gate the receipt never tested.
 *
 * 241's print CSS is 246's, unchanged (the page inherits the vocabulary rather
 * than inventing a second answer):
 *   · `@page { size: A4; margin: 0 }` — no margin box for Chrome or Edge to
 *     stamp a URL/date header into.
 *   · one 210×297mm block per MODEL page, `break-after: page`. The browser never
 *     decides where a page ends: `paginate(rows, 22)` already did, exactly as
 *     `AcrFormBuilder.Paginate` does for the WPF.
 *   · the document is 780px inside that block at `scale(0.956)` — WPF's own
 *     `min(1.0, (pageWidth − 48) / 780)`.
 *   · every fill on a DESCENDANT, never on `body`.
 *   · switcher and paper pane `display: none` in print.
 *
 * The gate is not passed until this has been through Ctrl+P on real Chrome AND
 * real Edge and come out on paper.
 */
import { useSearchParams } from 'react-router'
import PrototypeSwitcher from '@/core/ui/PrototypeSwitcher'
import { SCENARIOS } from './acr-mock'
import VariantA, { NAME as NAME_A } from './VariantA'
import VariantB, { NAME as NAME_B } from './VariantB'
import VariantC, { NAME as NAME_C } from './VariantC'
import paperUrl from './paper-acr-original.png'

const VARIANTS = [
  { key: 'A', name: NAME_A, Component: VariantA },
  { key: 'B', name: NAME_B, Component: VariantB },
  { key: 'C', name: NAME_C, Component: VariantC },
]

const PRINT_CSS = `
@page { size: A4; margin: 0; }

.pv-sheet {
  width: 210mm;
  min-height: 297mm;
  background: #fff;
  box-sizing: border-box;
  /* WPF's own FixedPage margin is 24 units ≈ 6.35mm. 246 kept it deliberately:
     matching WPF is what makes the two sheets identical, and whether the outer
     frame survives a laser's unprintable edge is a question for the paper test. */
  padding: 24px;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  break-after: page;
}
.pv-sheet:last-child { break-after: auto; }
.pv-doc {
  transform: scale(0.956); /* WPF: min(1.0, (A4width - 48) / 780) */
  transform-origin: top center;
}

@media screen {
  .pv-stage { display: flex; gap: 24px; justify-content: center; align-items: flex-start;
              padding: 24px 24px 96px; background: #6b7280; min-height: 100vh; zoom: 0.62; }
  .pv-stage.pv-solo { zoom: 1; }
  .pv-sheet { box-shadow: 0 10px 40px rgba(0,0,0,.45); margin-bottom: 24px; }
  /* The paper is ONE sheet and the facsimile is three, so it rides along as you
     scroll instead of vanishing off the top — the comparison is only useful
     while both are on screen. */
  .pv-paper-col { position: sticky; top: 24px; }
  .pv-paper { background: #fff; box-shadow: 0 10px 40px rgba(0,0,0,.45); padding: 8px; }
  .pv-paper img { display: block; width: 210mm; height: auto; }
  .pv-caption { color: #fff; font: 600 11px/1.6 ui-sans-serif, system-ui; letter-spacing: .04em;
                text-transform: uppercase; margin: 0 0 6px 2px; }
}

@media print {
  .pv-noprint { display: none !important; }
  .pv-stage { display: block; padding: 0; background: #fff; }
  .pv-sheet { box-shadow: none; margin-bottom: 0; }
  html, body, #root { background: #fff !important; }
}
`

export default function AcrPrototypePage() {
  const [params, setParams] = useSearchParams()
  const variantKey = params.get('variant') ?? 'C'
  const scenarioKey = params.get('state') ?? 'three-pages'
  const solo = params.get('solo') === '1'

  const variant = VARIANTS.find((v) => v.key === variantKey) ?? VARIANTS[2]
  const scenario = SCENARIOS.find((s) => s.key === scenarioKey) ?? SCENARIOS[0]
  const Doc = variant.Component

  const set = (k: string, v: string) => {
    const next = new URLSearchParams(params)
    next.set(k, v)
    setParams(next, { replace: true })
  }

  return (
    <>
      <style>{PRINT_CSS}</style>

      <div className={solo ? 'pv-stage pv-solo' : 'pv-stage'}>
        {/* The paper original — the authority half of this gate judges against.
            The other half is the WPF, which prints a RESHAPE of this sheet. */}
        {!solo && (
          <div className="pv-noprint pv-paper-col">
            <p className="pv-caption">Paper original — Scanned Document 4</p>
            <div className="pv-paper">
              <img src={paperUrl} alt="" />
            </div>
          </div>
        )}

        <div>
          {!solo && <p className="pv-caption pv-noprint">Web facsimile — variant {variant.key}</p>}
          <Doc m={scenario.model} />
        </div>
      </div>

      <div className="pv-noprint">
        <PrototypeSwitcher
          variants={VARIANTS.map(({ key, name }) => ({ key, name }))}
          variant={variant.key}
          onVariant={(k) => set('variant', k)}
          scenarios={SCENARIOS.map(({ key, label, proves }) => ({ key, label, proves }))}
          scenario={scenario.key}
          onScenario={(k) => set('state', k)}
        />
      </div>
    </>
  )
}
