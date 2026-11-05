import { Trans, useTranslation } from 'react-i18next'
import { legendOf, SHEET_KEYS } from '@/core/commands/keys'
import { useSingleKeys } from '@/core/commands/single-key-switch'
import { INSPECTOR_KEYS, NEXT_ROW_KEYS, PREVIOUS_ROW_KEYS, QUERY_FOCUS_KEYS } from '@/core/list/list-keys'
import Kbd from '@/core/ui/Kbd'
import Ltr from '@/core/ui/Ltr'
import { lensCount, type LoadedResult } from './lenses'
import { lensCountText } from './ViewsRail'

/** Native copy (382): the grid's own Ctrl+C on dragged cell text, never a command's. */
const COPY_KEYS = 'Ctrl+KeyC'

/** One or more keys as caps, isolated ONCE as a unit (378 §5). */
function Caps({ keys }: { keys: readonly string[] }) {
  const { t } = useTranslation()
  const caps = keys.flatMap((k) => legendOf(k)).map((part) => ('cap' in part ? part.cap : t(part.named)))
  return (
    <Ltr>
      {caps.map((cap, i) => (
        <span key={i}>
          {i > 0 && ' '}
          <Kbd>{cap}</Kbd>
        </span>
      ))}
    </Ltr>
  )
}

function Hint({ keys, does, name }: { keys: readonly string[]; does: string; name: string }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1" data-hint={name}>
      <Caps keys={keys} />
      {does}
    </span>
  )
}

/**
 * The list's status bar (the Deliveries bar's shape): "N orders · 1 selected", the key hints and
 * the native-copy hint. The count is the whole loaded result, read like the lenses': none before a
 * search, exact, or "N+" once the page came back full ("at least"). A letter hint follows the
 * single-key switch.
 */
export default function StatusBar({ loaded, selected }: { loaded: LoadedResult | null; selected: boolean }) {
  const { t } = useTranslation('orders')
  const singleKeys = useSingleKeys((s) => s.on)
  const count = lensCount(loaded, 'all')
  return (
    <div
      className="flex h-7 shrink-0 items-center gap-3 overflow-hidden rounded-md border border-border bg-card-2 px-3 text-[11.5px] whitespace-nowrap text-muted-foreground"
      data-status-bar=""
    >
      {count.key !== 'none' && (
        <span className="shrink-0" data-status-count={count.key}>
          <Trans
            t={t}
            i18nKey={`statusBar.${count.key === 'atLeast' ? 'rowsAtLeast' : 'rows'}${selected ? 'Selected' : ''}`}
            count={count.key === 'exact' ? count.count : undefined}
            values={{ n: lensCountText(t, count), selected: '1' }}
            components={{ n: <Ltr />, selected: <Ltr /> }}
          />
        </span>
      )}
      <span className="flex-1" />
      <span className="inline-flex min-w-0 items-center gap-3" data-status-hints="">
        {singleKeys && <Hint name="move" keys={[NEXT_ROW_KEYS, PREVIOUS_ROW_KEYS]} does={t('statusBar.move')} />}
        <Hint name="open" keys={['Enter']} does={t('statusBar.open')} />
        {singleKeys && <Hint name="search" keys={[QUERY_FOCUS_KEYS]} does={t('statusBar.search')} />}
        {singleKeys && <Hint name="help" keys={[SHEET_KEYS]} does={t('statusBar.help')} />}
        {singleKeys && <Hint name="inspector" keys={[INSPECTOR_KEYS]} does={t('statusBar.inspector')} />}
      </span>
      <span className="shrink-0" data-status-copy="">
        <Trans t={t} i18nKey="statusBar.copy" components={{ keys: <Caps keys={[COPY_KEYS]} /> }} />
      </span>
    </div>
  )
}
