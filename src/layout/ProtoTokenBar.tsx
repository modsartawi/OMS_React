/* PROTOTYPE CHROME 362 — dev-only, throwaway. Copy is dev chrome, exempt from t().
 *
 * Floating bar: palette · row height · grid text size · light/dark · stub data.
 * No arrow-key shortcuts on purpose: the grid owns the arrow keys.
 */
import { proto, setProto, type Palette, type WfPlacement, type WfScale } from '@/core/theme/proto-362'
import { PROTO_BASKETS } from '@/features/pricing/simulation/proto-372-baskets'
import { useTheme } from './theme'

const PALETTES: { key: Palette; name: string }[] = [
  { key: 'steel', name: 'Today (steel)' },
  { key: 'far', name: 'A · Far as drawn' },
  { key: 'navy', name: 'B · Navy-led' },
]

export default function ProtoTokenBar() {
  const theme = useTheme()
  if (!import.meta.env.DEV) return null

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-2 z-[100] flex justify-center" data-proto-bar>
      <div
        className="pointer-events-auto flex flex-wrap items-center gap-3 rounded-xl border-2 border-black/70 bg-black/90 px-3 py-2 text-xs text-white shadow-2xl"
        style={{ fontFamily: 'system-ui, sans-serif' }}
      >
        <span className="text-[10px] uppercase tracking-wide opacity-60">362</span>
        <Seg
          options={PALETTES.map((p) => ({ key: p.key, label: p.name }))}
          value={proto.palette}
          onPick={(k) => setProto({ palette: k as Palette })}
        />
        <Seg
          label="rows"
          options={[24, 26, 28].map((n) => ({ key: String(n), label: `${n}px` }))}
          value={String(proto.rows)}
          onPick={(k) => setProto({ rows: Number(k) })}
          disabled={proto.palette === 'steel'}
        />
        <Seg
          label="grid text"
          options={[12, 12.5, 13].map((n) => ({ key: String(n), label: `${n}` }))}
          value={String(proto.size)}
          onPick={(k) => setProto({ size: Number(k) })}
          disabled={proto.palette === 'steel'}
        />
        <button type="button" onClick={theme.toggle} className="rounded-md border border-white/40 px-2 py-1 hover:bg-white/15">
          {theme.dark ? 'dark ◐' : 'light ◑'}
        </button>
        {location.pathname.includes('simulation') ? (
          <>
            <span className="text-[10px] uppercase tracking-wide opacity-60">372</span>
            <Seg
              label="waterfall"
              options={[
                { key: 'ledger', label: 'A · ledger' },
                { key: 'beside', label: 'B · beside cards' },
                { key: 'pane', label: 'C · Far pane' },
                { key: 'off', label: 'today' },
              ]}
              value={proto.wf}
              onPick={(k) => setProto({ wf: k as WfPlacement })}
            />
            <Seg
              label="scale"
              options={[
                { key: 'line', label: 'line' },
                { key: 'basket', label: 'basket' },
              ]}
              value={proto.scale}
              onPick={(k) => setProto({ scale: k as WfScale })}
            />
            <select
              value={proto.cap}
              onChange={(e) => setProto({ cap: e.target.value })}
              className="rounded-md border border-white/30 bg-black px-1 py-1"
            >
              {Object.entries(PROTO_BASKETS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </select>
          </>
        ) : null}
        <label className="flex items-center gap-1 opacity-80">
          <input type="checkbox" checked={proto.stub} onChange={(e) => setProto({ stub: e.target.checked })} />
          stub data
        </label>
      </div>
    </div>
  )
}

function Seg({
  label,
  options,
  value,
  onPick,
  disabled,
}: {
  label?: string
  options: { key: string; label: string }[]
  value: string
  onPick: (k: string) => void
  disabled?: boolean
}) {
  return (
    <div className={'flex items-center gap-1 ' + (disabled ? 'opacity-40' : '')}>
      {label && <span className="opacity-60">{label}</span>}
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          disabled={disabled}
          onClick={() => onPick(o.key)}
          className={'rounded-md border px-2 py-1 ' + (o.key === value ? 'border-white bg-white text-black' : 'border-white/30 hover:bg-white/15')}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
