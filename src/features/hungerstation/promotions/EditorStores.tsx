import { useMemo, useState } from 'react'
import type { UseQueryResult } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import { apiErrorMessage } from '@/core/api'
import type { HungerStationPromotionStoreChoice } from '@/core/models/hungerstation'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Input from '@/core/ui/Input'
import Ltr from '@/core/ui/Ltr'
import StatusBadge from '@/core/ui/StatusBadge'
import { formatCount } from '@/core/util/bidi'
import { formatFigure as figure } from '@/core/util/number-format'
import { toggleStore } from './promotion-form'

/**
 * The promotion editor's **stores** (ticket 666): every HungerStation store of the chain ticked by
 * default ("all" — frozen when sent: `storeCodes: null`), searchable, a paused store offered and
 * said so. 670: a sent promotion's stores are its identity — shown, never ticked here (`locked`,
 * with the Replace pointer the editor hands in).
 */
export default function EditorStores({
  chainKey,
  stores,
  value,
  onChange,
  locked,
  lockedNote,
  checkWords,
  showProblem,
  hideError,
}: {
  chainKey: string
  /** The chain's `Promotions/Stores` read. */
  stores: UseQueryResult<HungerStationPromotionStoreChoice[]>
  value: 'all' | string[]
  onChange: (next: 'all' | string[]) => void
  locked: boolean
  /** Said under a locked list (670): changing the stores replaces the promotion. */
  lockedNote?: React.ReactNode
  /** The Check's refusals at `stores`, in words. */
  checkWords?: string
  /** None ticked: the form refuses to save. */
  showProblem: boolean
  /** The chain read failed with a refusal the editor already shows at the chain. */
  hideError: boolean
}) {
  const { t } = useTranslation('hungerstation-promotions')
  const [q, setQ] = useState('')
  const choices = useMemo(() => stores.data ?? [], [stores.data])
  const codes = useMemo(() => choices.map((s) => s.storeCode), [choices])
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return needle ? choices.filter((s) => s.storeCode.toLowerCase().includes(needle) || s.storeName.toLowerCase().includes(needle) || s.vendorId.toLowerCase().includes(needle)) : choices
  }, [choices, q])
  const ticked = (code: string) => value === 'all' || value.includes(code)
  const tickedCount = value === 'all' ? choices.length : value.length

  return (
    <section className="flex flex-col gap-2" data-editor-stores="">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-xs font-semibold tracking-tight">{t('editor.storesTitle')}</h3>
        {choices.length > 0 && (
          <span className="text-xs text-muted-foreground" data-editor-stores-count="">
            <Trans t={t} i18nKey="editor.storesTicked" values={{ count: formatCount(figure(tickedCount), figure(choices.length)) }} components={{ count: <Ltr /> }} />
          </span>
        )}
      </div>
      {checkWords && (
        <p role="alert" className="text-xs text-danger-800" data-check-field="stores">
          {checkWords}
        </p>
      )}
      <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground" data-editor-stores-note="">
        {t('editor.storesFrozen')}
      </p>
      {lockedNote && (
        <p className="text-xs text-muted-foreground" data-editor-stores-locked="">
          {lockedNote}
        </p>
      )}
      {!chainKey ? (
        <p className="text-sm text-muted-foreground">{t('editor.storesPickChain')}</p>
      ) : stores.isPending ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          {t('editor.storesLoading')}
        </p>
      ) : stores.isError ? (
        hideError ? null : <ErrorBanner className="p-2.5" title={t('editor.storesFailed')} message={apiErrorMessage(stores.error, t('results.failed'))} />
      ) : choices.length === 0 ? (
        <p className="text-sm text-muted-foreground" data-editor-stores-empty="">
          {t('editor.storesNone')}
        </p>
      ) : (
        <fieldset disabled={locked} className="flex min-w-0 flex-col gap-2" data-editor-stores-fieldset="">
          <div className="flex flex-wrap items-center gap-2">
            <Input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('editor.storesSearch')} wrapperClassName="w-72" data-editor-stores-search="" />
            <Button variant="text" onClick={() => onChange('all')} disabled={value === 'all'} data-editor-stores-all="">
              {t('editor.storesAll')}
            </Button>
          </div>
          {showProblem && (
            <p role="alert" className="text-xs text-danger-800" data-editor-stores-problem="">
              {t('editor.storesAtLeastOne')}
            </p>
          )}
          <ul className="grid max-h-56 grid-cols-1 gap-x-4 overflow-auto rounded-md border border-border/60 p-2 md:grid-cols-3" data-editor-store-list="">
            {shown.map((s) => (
              <StoreTick key={s.storeCode} store={s} on={ticked(s.storeCode)} onToggle={() => onChange(toggleStore(value, s.storeCode, codes))} />
            ))}
          </ul>
        </fieldset>
      )}
    </section>
  )
}

/** One store of the picker: ticked, its code, its name, and Paused when its sync is. */
function StoreTick({ store, on, onToggle }: { store: HungerStationPromotionStoreChoice; on: boolean; onToggle: () => void }) {
  const { t } = useTranslation('hungerstation-promotions')
  return (
    <li data-editor-store={store.storeCode} data-editor-store-on={String(on)}>
      <label className="flex items-center gap-2 py-1 text-xs">
        <input type="checkbox" checked={on} onChange={onToggle} data-editor-store-tick="" />
        <span className="font-mono">
          <Ltr>{store.storeCode}</Ltr>
        </span>
        <span className="min-w-0 truncate">{store.storeName ? <bdi>{store.storeName}</bdi> : null}</span>
        {!store.syncActive && (
          <StatusBadge sev="warn">
            <span data-editor-store-paused="">{t('editor.storePaused')}</span>
          </StatusBadge>
        )}
      </label>
    </li>
  )
}
