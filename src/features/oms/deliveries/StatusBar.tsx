import { Trans, useTranslation } from 'react-i18next'
import { legendOf, SHEET_KEYS } from '@/core/commands/keys'
import { useSingleKeys } from '@/core/commands/single-key-switch'
import Kbd from '@/core/ui/Kbd'
import Ltr from '@/core/ui/Ltr'
import { DELIVERY_ACTS } from './acts'
import { INSPECTOR_KEYS, NEXT_ROW_KEYS, PREVIOUS_ROW_KEYS } from './inspector-pane'
import { lensCount, type LoadedResult } from './lenses'
import { QUERY_FOCUS_KEYS } from './query-model'
import { lensCountText } from './ViewsRail'

/** Native copy (382): the grid's own Ctrl+C on dragged cell text, never a command's. */
const COPY_KEYS = 'Ctrl+KeyC'

/** One or more keys as caps, isolated ONCE as a unit (378 §5): `J K`, `R C N`, `Ctrl C`. */
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

/** A key hint: its caps, then what they do. */
function Hint({ keys, does, name }: { keys: readonly string[]; does: string; name: string }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1" data-hint={name}>
      <Caps keys={keys} />
      {does}
    </span>
  )
}

/**
 * The list's status bar (ticket 401, spec 380 L11; ruling 368 §1): "N deliveries · 1 selected",
 * the key hints, and the native-copy hint, under the grid.
 *
 * The count is the whole loaded result, read like the lenses' counts: none before a search, "N+"
 * once the page came back full. The letter hints follow the single-key switch (393): a letter
 * that does nothing is not advertised. R C N show only where the list offers its acts.
 */
export default function StatusBar({
  loaded,
  selected,
  actsOffered,
}: {
  loaded: LoadedResult | null
  selected: boolean
  actsOffered: boolean
}) {
  const { t } = useTranslation('deliveries')
  const singleKeys = useSingleKeys((s) => s.on)
  const count = lensCount(loaded, 'all')
  return (
    <div
      className="flex h-7 shrink-0 items-center gap-3 overflow-hidden rounded-md border border-border bg-card-2 px-3 text-[11.5px] whitespace-nowrap text-muted-foreground"
      data-status-bar=""
    >
      {count.key !== 'none' && (
        <span className="shrink-0" data-status-count="">
          {/* One phrase per shape, so the selection never glues on in code (i18n rule). */}
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
        {singleKeys && actsOffered && (
          <Hint name="act" keys={DELIVERY_ACTS.map((a) => a.keys)} does={t('statusBar.act')} />
        )}
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
