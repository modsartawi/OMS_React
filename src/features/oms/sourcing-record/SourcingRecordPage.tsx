import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import { apiErrorMessage } from '@/core/api'
import { canRunSourcingAdvisor } from '@/core/sourcing-advisor/access'
import Chip from '@/core/ui/Chip'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Ltr from '@/core/ui/Ltr'
import ScreenGate from '@/core/ui/ScreenGate'
import { formatPair, formatRange, fsi } from '@/core/util/bidi'
import { storeRecordQuery } from './api'
import ModeBoard from './ModeBoard'
import { carrierPairs, isBuilt, recordBoard, RECORD_MODES, type RecordMode } from './store-record-model'
import { useRecordWords } from './use-record-words'

/**
 * OMS ▸ Store record (ticket 969, BackOffice spec 4354 §6, §14 and §19: "the read-only store record list"). How
 * deliveries go at each store: every pair's record over the last 90 whole local days, with the counts behind each
 * rate, the like-store rates, the cost or credit per measure and a mark where a measure ran on the neutral default.
 * The owner chose the prototype's variant C: a tab per mode, the shared figures said once, a row per store.
 *
 * Read only. Opens under the run grant (spec 4354 §19: "a run grant opens the simulator, the store record list and kept
 * runs"). ⚠ Built on a stub: the read door is BackOffice 4373, still open.
 */
export default function SourcingRecordPage() {
  const { t } = useTranslation('sourcing-record')
  return (
    <ScreenGate can={canRunSourcingAdvisor} ns="sourcing-record" title={t('title')} subtitle={t('lede')}>
      <StoreRecord />
    </ScreenGate>
  )
}

const TABS = [...RECORD_MODES, 'CARRIERS'] as const
type Tab = (typeof TABS)[number]
const TAB_PARAM = 'mode'

function StoreRecord() {
  const w = useRecordWords()
  const record = useQuery(storeRecordQuery())
  const [params, setParams] = useSearchParams()
  const tab: Tab = (TABS as readonly string[]).includes(params.get(TAB_PARAM) ?? '') ? (params.get(TAB_PARAM) as Tab) : 'SLOT'
  const reply = record.data
  const board = useMemo(() => (isBuilt(reply) && tab !== 'CARRIERS' ? recordBoard(reply, tab as RecordMode) : null), [reply, tab])
  const carriers = useMemo(() => (isBuilt(reply) ? carrierPairs(reply) : []), [reply])

  return (
    <section className="flex w-full max-w-[96rem] flex-col gap-4" data-sourcing-record="">
      {isBuilt(reply) && (
        <p className="flex flex-wrap gap-x-4 text-xs text-muted-foreground" data-record-built={reply.builtAt ?? ''}>
          <span>{w.t('builtAt', { at: fsi(reply.builtAt ?? '') })}</span>
          {reply.windowFrom && reply.windowTo && (
            <span className="flex gap-1">
              {w.t('window')}
              <Ltr>{formatRange(reply.windowFrom, reply.windowTo)}</Ltr>
            </span>
          )}
        </p>
      )}

      {record.isPending ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status" data-record-loading="">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          {w.t('loading')}
        </p>
      ) : record.isError ? (
        <ErrorBanner className="px-3 py-2" message={apiErrorMessage(record.error, w.t('failed'))} />
      ) : !isBuilt(reply) ? (
        <div className="rounded-lg border border-dashed border-border bg-card p-6 text-sm" data-record-not-built="">
          <p className="font-semibold">{w.t('notBuilt.title')}</p>
          <p className="text-muted-foreground">{w.t('notBuilt.hint')}</p>
        </div>
      ) : (
        <>
          <div role="tablist" aria-label={w.t('tabs.label')} className="flex flex-wrap gap-1">
            {TABS.map((x) => (
              <Chip
                key={x}
                variant="tab"
                on={tab === x}
                onClick={() =>
                  setParams(
                    (prev) => {
                      const next = new URLSearchParams(prev)
                      next.set(TAB_PARAM, x)
                      return next
                    },
                    { replace: true },
                  )
                }
                data-mode-tab={x}
              >
                {x === 'CARRIERS' ? w.t('tabs.CARRIERS') : w.mode(x)}
              </Chip>
            ))}
          </div>
          <div role="tabpanel" data-tab-panel={tab}>
            {board ? (
              <ModeBoard board={board} />
            ) : (
              <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4" data-mode-board="CARRIERS">
                <p className="text-sm">{w.t('noRecordMode')}</p>
                <ul className="flex flex-wrap gap-2 text-xs">
                  {carriers.map((p) => (
                    <li key={`${p.store}-${p.mode}`} className="flex items-center gap-1.5 rounded-md border border-border/70 px-2 py-1" data-carrier-pair={`${p.store} ${p.mode}`}>
                      <Ltr>{formatPair(p.store, p.storeName)}</Ltr>
                      <span className="text-muted-foreground">{w.mode(p.mode)}</span>
                      <span className="rounded-full border border-border px-1.5 py-px text-[11px] text-muted-foreground" data-neutral="NO_RECORD">
                        {w.t('neutral.mark')}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </>
      )}
    </section>
  )
}
