/* PROTOTYPE — throwaway. Wayfinder ticket 246 (map 240) — breaker gate 1.
 *
 * Three readings of the سند قبض / RECEIPT VOUCHER, switchable via `?variant=`,
 * each on the print geometry ticket 241 chose, with the paper scan pinned
 * beside them so the sign-off is literally side by side.
 *
 * Route: /prototype/collection-voucher?variant=A|B|C&state=…&solo=1
 *   ← / →   variant   ·   ↑ / ↓   scenario   ·   `?solo=1` drops the paper pane
 *
 * 241's ruling, implemented here rather than described:
 *   · `@page { size: A4; margin: 0 }` — no margin box, so Chrome and Edge have
 *     nowhere to stamp the URL/date header a facsimile cannot tolerate.
 *   · one 210×297mm block per model page, `break-after: page`. This receipt is
 *     one page per shift; the ACR (ticket 247) is where that repeats.
 *   · the document is 780px inside that block at `scale(0.956)` — WPF's own
 *     `min(1.0, (pageWidth − 48) / 780)` shrink-to-fit on A4 portrait, so the
 *     web sheet and the WPF sheet come off the printer the same size.
 *   · every fill lives on a DESCENDANT, never on `body` — browsers never print
 *     a body background even with print-color-adjust: exact.
 *   · the switcher and the paper pane are `display: none` in print, so what
 *     prints is only ever the document.
 *
 * The gate is not passed until this has been through Ctrl+P on real Chrome AND
 * real Edge and come out on paper (241's two gotchas are hardware questions).
 */
import { useSearchParams } from 'react-router'
import PrototypeSwitcher from '@/core/ui/PrototypeSwitcher'
import { SCENARIOS } from './voucher-mock'
import VariantA, { NAME as NAME_A } from './VariantA'
import VariantB, { NAME as NAME_B } from './VariantB'
import VariantC, { NAME as NAME_C } from './VariantC'
import paperUrl from './paper-collection-receipt.jpg'

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
  /* WPF's own FixedPage margin is 24 units ≈ 6.35mm, and matching it is what
     makes the two sheets identical. It is BELOW the ~10mm many lasers leave
     unprintable — so "does the outer frame survive?" is a question for the
     paper test, not one to pre-empt by drifting off the WPF geometry. */
  padding: 24px;
  display: flex;
  justify-content: center;
  break-after: page;
}
.pv-doc {
  transform: scale(0.956); /* WPF: min(1.0, (A4width - 48) / 780) */
  transform-origin: top center;
}

@media screen {
  /* Two 210mm sheets side by side is ~1620px, wider than most laptops. Zoom
     shrinks BOTH panes equally, so the comparison stays honest — it is only the
     absolute size that is off, and absolute size is the printer's question, not
     the screen's (241: fidelity at this gate is marks present and positioned).
     ?solo=1 drops the paper pane and shows the facsimile at 1:1. */
  .pv-stage { display: flex; gap: 24px; justify-content: center; align-items: flex-start;
              padding: 24px 24px 96px; background: #6b7280; min-height: 100vh; zoom: 0.62; }
  .pv-stage.pv-solo { zoom: 1; }
  /* Full 297mm on screen too, so it is visible at a glance that the receipt
     occupies only the top third of the sheet it prints on. */
  .pv-sheet { box-shadow: 0 10px 40px rgba(0,0,0,.45); align-items: flex-start; }
  .pv-paper { background: #fff; box-shadow: 0 10px 40px rgba(0,0,0,.45); padding: 8px; }
  .pv-paper img { display: block; width: 210mm; height: auto; }
  .pv-caption { color: #fff; font: 600 11px/1.6 ui-sans-serif, system-ui; letter-spacing: .04em;
                text-transform: uppercase; margin: 0 0 6px 2px; }
}

@media print {
  .pv-noprint { display: none !important; }
  .pv-stage { display: block; padding: 0; background: #fff; }
  html, body, #root { background: #fff !important; }
}
`

export default function VoucherPrototypePage() {
  const [params, setParams] = useSearchParams()
  const variantKey = params.get('variant') ?? 'C'
  const scenarioKey = params.get('state') ?? 'posted'
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
        {/* The paper original — the authority this gate judges against. */}
        {!solo && (
          <div className="pv-noprint">
            <p className="pv-caption">Paper original — Collection Receipt.jpg</p>
            <div className="pv-paper">
              <img src={paperUrl} alt="" />
            </div>
          </div>
        )}

        <div>
          {!solo && <p className="pv-caption pv-noprint">Web facsimile — variant {variant.key}</p>}
          <div className="pv-sheet">
            <div className="pv-doc">
              <Doc m={scenario.model} />
            </div>
          </div>
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
