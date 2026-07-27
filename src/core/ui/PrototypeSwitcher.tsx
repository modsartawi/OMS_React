/* PROTOTYPE CHROME — dev-only, throwaway (see .claude/skills/prototype).
 *
 * Floating bar: ← / → cycle the variant, ↑ / ↓ cycle the scenario. Copy here is
 * dev chrome, so it is exempt from the t() rule. Hidden outside `vite dev`.
 */
import { useEffect } from 'react'

type Props = {
  variants: { key: string; name: string }[]
  variant: string
  onVariant: (k: string) => void
  scenarios: { key: string; label: string; proves: string }[]
  scenario: string
  onScenario: (k: string) => void
}

export default function PrototypeSwitcher({ variants, variant, onVariant, scenarios, scenario, onScenario }: Props) {
  const vi = Math.max(0, variants.findIndex((v) => v.key === variant))
  const si = Math.max(0, scenarios.findIndex((s) => s.key === scenario))
  const cur = scenarios[si]

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
      if (e.key === 'ArrowRight') onVariant(variants[(vi + 1) % variants.length].key)
      if (e.key === 'ArrowLeft') onVariant(variants[(vi - 1 + variants.length) % variants.length].key)
      if (e.key === 'ArrowDown') onScenario(scenarios[(si + 1) % scenarios.length].key)
      if (e.key === 'ArrowUp') onScenario(scenarios[(si - 1 + scenarios.length) % scenarios.length].key)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [vi, si, variants, scenarios, onVariant, onScenario])

  if (!import.meta.env.DEV) return null

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-1 z-50 flex justify-center">
      <div className="pointer-events-auto flex max-w-[92vw] items-stretch gap-3 rounded-xl border-2 border-foreground/70 bg-foreground/95 px-3 py-2 text-background shadow-2xl">
        <div className="flex items-center gap-2">
          <Arrow onClick={() => onVariant(variants[(vi - 1 + variants.length) % variants.length].key)}>←</Arrow>
          <div className="min-w-44 text-center">
            <div className="text-[10px] uppercase tracking-wide opacity-60">variant {variant}</div>
            <div className="text-xs font-semibold">{variants[vi]?.name}</div>
          </div>
          <Arrow onClick={() => onVariant(variants[(vi + 1) % variants.length].key)}>→</Arrow>
        </div>

        <div className="w-px bg-background/30" />

        <div className="flex items-center gap-2">
          <Arrow onClick={() => onScenario(scenarios[(si - 1 + scenarios.length) % scenarios.length].key)}>↑</Arrow>
          <div className="min-w-72 max-w-md">
            <div className="text-xs font-semibold">{cur?.label}</div>
            <div className="text-[10px] leading-snug opacity-70">{cur?.proves}</div>
          </div>
          <Arrow onClick={() => onScenario(scenarios[(si + 1) % scenarios.length].key)}>↓</Arrow>
        </div>

        <div className="w-px bg-background/30" />

        <select
          value={scenario}
          onChange={(e) => onScenario(e.target.value)}
          className="self-center rounded border border-background/40 bg-transparent px-1 py-1 text-xs"
        >
          {scenarios.map((s) => (
            <option key={s.key} value={s.key} className="text-foreground">
              {s.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}

function Arrow({ children, onClick }: { children: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex size-7 items-center justify-center rounded-md border border-background/40 text-sm hover:bg-background/15"
    >
      {children}
    </button>
  )
}
