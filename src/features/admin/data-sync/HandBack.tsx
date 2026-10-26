import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { Loader2, Undo2 } from 'lucide-react'
import { apiErrorMessage, isBareDenial } from '@/core/api'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Ltr from '@/core/ui/Ltr'
import Modal from '@/core/ui/Modal'
import type { Campaign } from '@/core/models/data-sync'
import { actionSyncAccessQuery, actionSyncApi, campaignKey, canOperateActionSync, dataSyncApi } from './api'
import { campaignControlReason, runStoreControl, type StoreControlRun } from './apply-helpers'
import { RefusalList, StoreList } from './ApplyPanel'
import { useCanOperateDataSync } from './Controls'
import { allCampaignJobs, handBackBatches, handBackSplit } from './handback-helpers'
import { groupDigits } from './helpers'

/**
 * The campaign header's **Hand back to ActionSync** (spec 558, ticket 565). Offered on an Apply
 * campaign once it has started, to holders of BOTH `DataSync.Operate` (spec 558: every action needs
 * it; story 34) and `ActionSync.Operate` (the Resume is ActionSync's) — absent otherwise. Never
 * automatic: it opens a dialog that reads EVERY job of the campaign (all pages, not just the one
 * shown), pre-selects the stores whose job `Succeeded` with `actionSyncResumable`, lists the rest as
 * staying paused with why, and on confirm resumes the picked stores through
 * `ActionSync/Stores/Control` (`Resume`, batches ≤ 50, tagged `DataSync campaign <id>: <reason>`),
 * then shows each store's result. It is open while jobs still run, for the ones already done.
 */
export default function HandBackButton({ campaign }: { campaign: Campaign }) {
  const { t } = useTranslation('data-sync')
  const applying = campaign.mode === 'Apply'
  const access = useQuery({ ...actionSyncAccessQuery(), enabled: applying })
  const canOperate = useCanOperateDataSync()
  const [open, setOpen] = useState(false)
  if (!applying || campaign.status === 'Ready' || !canOperate || !canOperateActionSync(access.data)) return null
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)} data-hand-back="">
        <Undo2 className="h-3.5 w-3.5" aria-hidden />
        {t('handBack.button')}
      </Button>
      {open && <HandBackDialog campaign={campaign} onClose={() => setOpen(false)} />}
    </>
  )
}

function HandBackDialog({ campaign, onClose }: { campaign: Campaign; onClose: () => void }) {
  const { t } = useTranslation('data-sync')
  const qc = useQueryClient()
  const id = campaign.campaignId
  const reason = campaign.reason ?? ''
  // Every job, read fresh each time the dialog opens (never from the page's cached page of 50).
  const jobs = useQuery({
    queryKey: [...campaignKey(id), 'hand-back'] as const,
    queryFn: () => allCampaignJobs((page) => dataSyncApi.campaignJobs(id, { status: null, page })),
    staleTime: 0,
    gcTime: 0,
    retry: false,
  })
  const split = useMemo(() => (jobs.data ? handBackSplit(campaign.mode, jobs.data) : null), [jobs.data, campaign.mode])
  // Kept as the stores UN-ticked, so a re-read that finds more resumable stores ticks them too.
  const [unticked, setUnticked] = useState<ReadonlySet<string>>(new Set())
  const picked = split ? split.handBack.filter((s) => !unticked.has(s.code)).map((s) => s.code) : []

  const run = useMutation({
    mutationFn: (codes: string[]) => runStoreControl((req) => actionSyncApi.control(req), handBackBatches(id, reason, codes)),
    onSettled: () => qc.invalidateQueries({ queryKey: ['data-sync', 'action-sync-fleet'] }),
  })
  const busy = run.isPending
  const done: StoreControlRun | undefined = run.data

  const toggle = (code: string, on: boolean) =>
    setUnticked((u) => {
      const next = new Set(u)
      if (on) next.delete(code)
      else next.add(code)
      return next
    })

  const count = (key: string, n: number, attrs: Record<string, string | number> = {}) => (
    <p {...attrs}>
      <Trans t={t} i18nKey={key} count={n} values={{ figure: groupDigits(n) }} components={{ n: <Ltr /> }} />
    </p>
  )

  return createPortal(
    <Modal
      open
      onClose={() => !busy && onClose()}
      title={t('handBack.title')}
      width="38rem"
      footer={
        <>
          <Button variant="text" onClick={onClose} disabled={busy} data-hand-back-close="">
            {t('handBack.close')}
          </Button>
          {!done && (
            <Button
              variant="primary"
              disabled={busy || picked.length === 0}
              onClick={() => !busy && picked.length > 0 && run.mutate(picked)}
              data-hand-back-confirm={picked.length}
            >
              {busy && <Loader2 className="h-3 w-3 animate-spin" aria-hidden />}
              {busy ? (
                t('handBack.sending')
              ) : (
                <Trans t={t} i18nKey="handBack.confirm" count={picked.length} values={{ figure: groupDigits(picked.length) }} components={{ n: <Ltr /> }} />
              )}
            </Button>
          )}
        </>
      }
    >
      <div className="flex flex-col gap-3 text-sm" data-hand-back-dialog={id}>
        <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">{t('handBack.note')}</p>
        <p className="text-xs text-muted-foreground" data-hand-back-tag="">
          <Trans t={t} i18nKey="handBack.tag" values={{ tag: campaignControlReason(id, reason) }} components={{ tag: <bdi className="font-mono" /> }} />
        </p>

        {jobs.isPending && (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground" role="status">
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
            {t('handBack.loading')}
          </span>
        )}
        {jobs.isError && <ErrorBanner className="p-2" message={apiErrorMessage(jobs.error, t('handBack.failed'))} />}

        {done ? (
          <HandBackResult run={done} />
        ) : (
          split && (
            <>
              {split.inFlight > 0 && (
                <div className="rounded-md border border-attention-border bg-attention-050 px-3 py-2 text-xs" data-hand-back-in-flight={split.inFlight}>
                  {count('handBack.inFlight', split.inFlight)}
                </div>
              )}

              <div className="flex flex-col gap-1 text-xs" data-hand-back-ready={split.handBack.length}>
                {split.handBack.length === 0 ? (
                  <p className="text-muted-foreground" data-hand-back-none="">
                    {t('handBack.none')}
                  </p>
                ) : (
                  <>
                    {count('handBack.readyTitle', split.handBack.length, { className: 'font-medium' })}
                    <ul className="flex max-h-48 flex-col gap-0.5 overflow-y-auto">
                      {split.handBack.map((s) => (
                        <li key={s.jobId} data-hand-back-store={s.code}>
                          <label className="inline-flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={!unticked.has(s.code)}
                              disabled={busy}
                              onChange={(e) => toggle(s.code, e.target.checked)}
                              data-hand-back-pick={s.code}
                            />
                            <span className="font-mono">
                              <Ltr>{s.store}</Ltr>
                            </span>
                          </label>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>

              {split.stayPaused.length > 0 && (
                <div className="flex flex-col gap-1 rounded-md border border-border/60 px-3 py-2 text-xs" data-hand-back-stay={split.stayPaused.length}>
                  {count('handBack.stayTitle', split.stayPaused.length, { className: 'font-medium' })}
                  <ul className="flex max-h-48 flex-col gap-0.5 overflow-y-auto">
                    {split.stayPaused.map((s) => (
                      <li key={s.jobId} data-stay-paused={s.code} data-why={s.why}>
                        <span className="font-mono">
                          <Ltr>{s.store}</Ltr>
                        </span>{' '}
                        <span className="text-muted-foreground">{t(`handBack.why.${s.why}`)}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="text-muted-foreground">{t('handBack.stayHint')}</p>
                </div>
              )}
            </>
          )
        )}
      </div>
    </Modal>,
    document.body,
  )
}

/** What the Resume did, store by store: back with ActionSync, refused, or never sent. */
function HandBackResult({ run }: { run: StoreControlRun }) {
  const { t } = useTranslation('data-sync')
  return (
    <div className="flex flex-col gap-3 text-xs" data-hand-back-result="">
      {run.ok.length > 0 && (
        <div className="text-success-800" data-hand-back-ok={run.ok.length}>
          <p>
            <Trans t={t} i18nKey="handBack.done" count={run.ok.length} values={{ figure: groupDigits(run.ok.length) }} components={{ n: <Ltr /> }} />
          </p>
          <StoreList codes={run.ok} attr="data-hand-back-ok-store" />
        </div>
      )}
      {run.refused.length > 0 && (
        <div className="rounded-md border border-attention-border bg-attention-050 px-3 py-2" data-hand-back-refused={run.refused.length}>
          <p className="font-medium">{t('handBack.refusedTitle')}</p>
          <RefusalList refused={run.refused} />
        </div>
      )}
      {run.error != null && (
        <ErrorBanner className="p-2" title={t('handBack.stopped')} message={apiErrorMessage(run.error, t('handBack.stoppedHint'))}>
          {isBareDenial(run.error) && (
            <p className="mt-1" data-hand-back-denied="">
              {t('handBack.denied')}
            </p>
          )}
          <p className="mt-1">{t('handBack.unsentTitle')}</p>
          <StoreList codes={run.unsent} attr="data-hand-back-unsent-store" />
        </ErrorBanner>
      )}
    </div>
  )
}
