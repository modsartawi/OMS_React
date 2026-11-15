import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import { apiErrorMessage } from '@/core/api'
import Ltr from '@/core/ui/Ltr'
import { fsi, formatPair } from '@/core/util/bidi'
import { AUDIT_KEY, FLEET_KEY, STORE_PAGES_KEY, syncConsoleApi } from './api'
import {
  SELECTION_CAP,
  controlResultSummary,
  resumeAllRequest,
  resumeAllTicks,
  resumeAllView,
  tickAllResume,
  toggleResumeTick,
} from './control-helpers'
import { notifyOutcome, resultSentence, type ControlOutcome } from './ControlDialog'
import { figure } from './helpers'
import ReasonDialog from './ReasonDialog'
import { Time } from './StoreHealth'

const TH = 'px-2 py-1.5 font-medium whitespace-nowrap text-start'
const TD = 'px-2 py-1 align-top'

/** The preview's query key — read fresh on every opening. */
export const PAUSED_STORES_KEY = ['sync-console', 'paused-stores'] as const

/**
 * "Resume all paused…" (BackOffice spec 3913, ticket 903): one action that resumes the working fleet.
 *
 * It previews every paused, non-disabled worker store (`GET ActionSync/Stores/Paused`) with who paused
 * it, when and why — a DataSync campaign's tag shows as written — every row ticked. The operator unticks
 * the stores to leave paused, gives a reason and confirms: the ticked codes go as ONE Resume through the
 * bulk door (`syncConsoleApi.controlBulk`, whatever the count), so a closed browser does not stop it.
 * A disabled store is never listed, and the door refuses it `DISABLED` if one slips in.
 *
 * No paused store is the dialog's empty state, never an error. The answer is a toast naming the batch,
 * the refusals go back to the page (`onResult`), and the fleet, every store page and the audit refetch.
 */
export default function ResumeAllDialog({
  open,
  onClose,
  onResult,
}: {
  open: boolean
  onClose: () => void
  onResult: (outcome: ControlOutcome) => void
}) {
  if (!open) return null
  return <ResumeAll onClose={onClose} onResult={onResult} />
}

/** Mounted only while open, so every opening reads afresh and starts with every store ticked. */
function ResumeAll({ onClose, onResult }: { onClose: () => void; onResult: (outcome: ControlOutcome) => void }) {
  const { t } = useTranslation('sync-console')
  const qc = useQueryClient()
  const preview = useQuery({
    queryKey: PAUSED_STORES_KEY,
    queryFn: () => syncConsoleApi.pausedStores(),
    staleTime: 0,
    gcTime: 0,
    retry: false,
    // Read once per opening: the list the operator unticks does not change under them.
    refetchOnWindowFocus: false,
  })
  const stores = preview.data ?? []
  // `null` = untouched: every store ticked (`resumeAllTicks`), however the preview arrives.
  const [touched, setTouched] = useState<string[] | null>(null)
  const ticked = touched ?? resumeAllTicks(stores)
  const view = resumeAllView(stores, ticked)
  // One lookup per render, not a scan of the ticks per row.
  const tickedSet = new Set(ticked)

  const send = useMutation({
    mutationFn: (reason: string) => {
      const request = resumeAllRequest(stores, ticked, reason)
      if (!request) throw new Error('nothing to resume') // Confirm is off; never reached.
      return syncConsoleApi.controlBulk(request)
    },
    onSuccess: (data) => {
      const summary = controlResultSummary(data.results)
      const sentence = resultSentence(t, t('controls.Resume'), summary)
      notifyOutcome(summary, sentence, data.batchId ? t('results.batch', { batchId: fsi(data.batchId) }) : undefined)
      onResult({ action: 'Resume', summary })
      void qc.invalidateQueries({ queryKey: FLEET_KEY })
      void qc.invalidateQueries({ queryKey: STORE_PAGES_KEY })
      void qc.invalidateQueries({ queryKey: AUDIT_KEY })
      onClose()
    },
  })

  return (
    <ReasonDialog
      open
      title={t('resumeAll.title')}
      note={t('resumeAll.note', { cap: fsi(figure(SELECTION_CAP)) })}
      busy={send.isPending}
      error={send.error}
      confirmLabel={
        view.state === 'list' ? t('resumeAll.confirm', { count: view.ticked, n: fsi(figure(view.ticked)) }) : undefined
      }
      // Only the ticked stores and the reason gate Confirm; nothing to resume keeps it off.
      confirmDisabled={view.state !== 'list' || view.ticked === 0 || preview.isPending}
      onConfirm={(reason) => send.mutate(reason)}
      onClose={onClose}
      width="64rem"
    >
      {preview.isPending ? (
        <p className="flex items-center gap-2 text-xs text-muted-foreground" data-resume-all="loading">
          <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
          {t('resumeAll.loading')}
        </p>
      ) : preview.isError ? (
        <p className="rounded-md bg-attention-050 px-3 py-2 text-xs text-attention-800" data-resume-all="failed">
          {t('resumeAll.failed')} <bdi>{apiErrorMessage(preview.error, t('resumeAll.failedHint'))}</bdi>
        </p>
      ) : view.state === 'empty' ? (
        <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground" data-resume-all="empty">
          {t('resumeAll.empty')}
        </p>
      ) : (
        <section className="flex flex-col gap-2" data-resume-all="list">
          <p className="text-sm" aria-live="polite" data-resume-summary={`${view.ticked}/${view.total}`}>
            <Trans
              t={t}
              i18nKey="resumeAll.summary"
              values={{ n: figure(view.ticked), total: figure(view.total) }}
              components={{ n: <Ltr />, total: <Ltr /> }}
            />
          </p>
          <div className="max-h-80 overflow-auto rounded-md border border-border/60">
            <table className="w-full text-xs" aria-label={t('resumeAll.title')} data-resume-table="">
              <thead className="sticky top-0 bg-muted text-muted-foreground">
                <tr>
                  <th className={`${TH} w-8`}>
                    <input
                      type="checkbox"
                      aria-label={t('resumeAll.tickAll')}
                      checked={view.all === 'all'}
                      ref={(el) => {
                        if (el) el.indeterminate = view.all === 'some'
                      }}
                      onChange={() => setTouched(tickAllResume(stores, view.all !== 'all'))}
                      data-resume-tick-all={view.all}
                    />
                  </th>
                  <th className={TH}>{t('resumeAll.columns.store')}</th>
                  <th className={TH}>{t('resumeAll.columns.pausedBy')}</th>
                  <th className={TH}>{t('resumeAll.columns.pausedAt')}</th>
                  <th className={TH}>{t('resumeAll.columns.reason')}</th>
                </tr>
              </thead>
              <tbody>
                {stores.map((s) => {
                  const on = tickedSet.has(s.code)
                  return (
                    <tr
                      key={s.code}
                      className={'border-t border-border/60 ' + (on ? '' : 'text-muted-foreground')}
                      data-resume-row={s.code}
                      data-ticked={String(on)}
                    >
                      <td className={TD}>
                        <input
                          type="checkbox"
                          aria-label={t('resumeAll.tick', { code: fsi(s.code) })}
                          checked={on}
                          onChange={() => setTouched(toggleResumeTick(stores, ticked, s.code))}
                          data-resume-tick={s.code}
                        />
                      </td>
                      <td className={`${TD} font-mono whitespace-nowrap`}>
                        {/* A pair led by a machine value: isolated once, as a whole. */}
                        <Ltr>{formatPair(s.code, s.description)}</Ltr>
                      </td>
                      <td className={TD}>
                        {s.pausedBy ? <bdi>{s.pausedBy}</bdi> : <Unrecorded />}
                      </td>
                      <td className={`${TD} whitespace-nowrap`}>
                        {s.pausedAt ? <Time value={s.pausedAt} /> : <Unrecorded />}
                      </td>
                      <td className={TD} data-resume-reason="">
                        {/* As written: a DataSync campaign's tag is not reworded. */}
                        {s.pauseReason ? <bdi>{s.pauseReason}</bdi> : <Unrecorded />}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </ReasonDialog>
  )
}

/** A pause stamped before 3914 carries no who, when or why. */
function Unrecorded() {
  const { t } = useTranslation('sync-console')
  return <span className="text-muted-foreground">{t('resumeAll.unrecorded')}</span>
}
