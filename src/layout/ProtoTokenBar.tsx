/* PROTOTYPE CHROME 362 — dev-only, throwaway. Copy is dev chrome, exempt from t().
 *
 * Floating bar: palette · row height · grid text size · light/dark · stub data.
 * No arrow-key shortcuts on purpose: the grid owns the arrow keys.
 */
import { proto, setProto, type Palette } from '@/core/theme/proto-362'
import { useTheme } from './theme'
import { p363, setP363, SHELLS, type Shell } from './__prototype__/proto-363'

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
        <span className="text-[10px] uppercase tracking-wide opacity-60">363</span>
        <Seg
          options={SHELLS.map((x) => ({ key: x.key, label: x.name }))}
          value={p363.shell}
          onPick={(k) => setP363({ shell: k as Shell })}
        />
        <button type="button" onClick={() => setP363({ rtl: !p363.rtl })} className={'rounded-md border px-2 py-1 ' + (p363.rtl ? 'border-white bg-white text-black' : 'border-white/30 hover:bg-white/15')}>
          RTL
        </button>
        <button type="button" onClick={() => setP363({ cmd: !p363.cmd })} className={'rounded-md border px-2 py-1 ' + (p363.cmd ? 'border-white bg-white text-black' : 'border-white/30 hover:bg-white/15')}>
          Ctrl+K slot
        </button>
        <span className="h-4 w-px bg-white/30" />
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
