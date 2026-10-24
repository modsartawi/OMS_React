import { useState } from 'react'
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import Button from '@/core/ui/Button'
import Ltr from '@/core/ui/Ltr'
import { notify } from '@/core/services/notify'
import { fsi } from '@/core/util/bidi'
import type { Campaign, DataSyncAccess, Job } from '@/core/models/data-sync'
import { DATA_SYNC_ACCESS_KEY, campaignKey, campaignSummaryKey, canOperateDataSync, dataSyncAccessQuery, dataSyncApi } from './api'
import {
  campaignControls,
  controlBody,
  controlTakesNote,
  isOperateDenied,
  jobControls,
  type ControlAction,
} from './control-helpers'
import ControlDialog from './ControlDialog'
import { storeLabel } from './job-helpers'
import { codeValue } from './code-words'

/**
 * The campaign page's Pause / Resume / Cancel (spec 558, ticket 563): a campaign's in the header,
 * a job's in its row and in its drawer. Each set offers only the moves its status allows
 * (`campaignControls` / `jobControls`) and nothing without `DataSync.Operate`; each opens the
 * shared `ControlDialog`.
 *
 * After a control the door's answer is written straight into the page's cache (the new state shows
 * at once), and the campaign's reads are invalidated so the rollup follows; the page's poll (560)
 * then carries on. A refusal stays in the dialog. A bare 403 means the grant is gone: the cached
 * access answer loses `canOperate`, so every Operate control on the page hides.
 */

/** `DataSync.Operate`, from the one access answer the page and the nav share (no extra call). */
export function useCanOperateDataSync(): boolean {
  return canOperateDataSync(useQuery(dataSyncAccessQuery()).data)
}

const VARIANT = { Pause: 'secondary', Resume: 'secondary', Cancel: 'danger-outlined' } as const
const CONFIRM_VARIANT = { Pause: 'primary', Resume: 'primary', Cancel: 'danger' } as const

/** A bare 403: hide every Operate control on the page, and say why once. */
function dropOperate(qc: QueryClient, words: string) {
  qc.setQueryData<DataSyncAccess>(DATA_SYNC_ACCESS_KEY, (a) => (a ? { ...a, canOperate: false } : a))
  notify.warn(words)
}

/** The header's controls for one campaign. Renders nothing for a viewer or a finished campaign. */
export function CampaignControls({ campaign }: { campaign: Campaign }) {
  const { t } = useTranslation('data-sync')
  const qc = useQueryClient()
  const canOperate = useCanOperateDataSync()
  const [action, setAction] = useState<ControlAction | null>(null)
  const id = campaign.campaignId

  const send = useMutation({
    mutationFn: ({ action, note }: { action: ControlAction; note: string }) =>
      dataSyncApi.controlCampaign(id, action, controlBody(action, note)),
    onSuccess: (next) => {
      qc.setQueryData(campaignSummaryKey(id), next)
      void qc.invalidateQueries({ queryKey: campaignKey(id) })
      notify.success(t('controls.done.campaign', { status: codeValue(t, 'campaignStatus', next.status) }))
      close()
    },
    onError: (err) => {
      if (isOperateDenied(err)) {
        close()
        dropOperate(qc, t('controls.denied'))
        return
      }
      void qc.invalidateQueries({ queryKey: campaignKey(id) })
    },
  })
  const close = () => {
    send.reset()
    setAction(null)
  }

  const moves = campaignControls(campaign.status, canOperate)
  if (moves.length === 0 && !action) return null
  return (
    <>
      {moves.map((a) => (
        <Button key={a} variant={VARIANT[a]} onClick={() => setAction(a)} data-control={a} data-control-scope="campaign">
          {t(`controls.action.${a}`)}
        </Button>
      ))}
      {action && (
        <ControlDialog
          title={t(`controls.title.campaign.${action}`)}
          actsOn={
            <>
              <span>
                <span className="text-muted-foreground">{t('controls.actsOnCampaign')} </span>
                {campaign.name ? <bdi>{campaign.name}</bdi> : t('campaign.unnamed')}
              </span>
              <span className="font-mono text-[11px] text-muted-foreground">
                <Ltr>{id}</Ltr>
              </span>
            </>
          }
          note={t(`controls.note.campaign.${action}`)}
          takesNote={controlTakesNote(action)}
          confirmLabel={t(`controls.action.${action}`)}
          confirmVariant={CONFIRM_VARIANT[action]}
          busy={send.isPending}
          error={send.error}
          onConfirm={(note) => send.mutate({ action, note })}
          onClose={close}
        />
      )}
    </>
  )
}

/** One job's controls — in its grid row and in its drawer. Nothing for a viewer or a finished job. */
export function JobControls({ job, compact = false }: { job: Job; compact?: boolean }) {
  const { t } = useTranslation('data-sync')
  const qc = useQueryClient()
  const canOperate = useCanOperateDataSync()
  const [action, setAction] = useState<ControlAction | null>(null)
  const cid = job.campaignId
  const store = storeLabel(job.store)

  const send = useMutation({
    mutationFn: ({ action, note }: { action: ControlAction; note: string }) =>
      dataSyncApi.controlJob(job.jobId, action, controlBody(action, note)),
    onSuccess: (next) => {
      // The answer's own state at once: the drawer's job and its row on every jobs page held.
      qc.setQueryData([...campaignKey(cid), 'job', next.jobId], next)
      qc.setQueriesData<Job[]>({ queryKey: [...campaignKey(cid), 'jobs'] }, (rows) =>
        rows?.map((r) => (r.jobId === next.jobId ? next : r)),
      )
      void qc.invalidateQueries({ queryKey: campaignKey(cid) })
      notify.success(
        t('controls.done.job', { store: fsi(store), status: codeValue(t, 'jobStatus', next.status) }),
      )
      close()
    },
    onError: (err) => {
      if (isOperateDenied(err)) {
        close()
        dropOperate(qc, t('controls.denied'))
        return
      }
      void qc.invalidateQueries({ queryKey: campaignKey(cid) })
    },
  })
  const close = () => {
    send.reset()
    setAction(null)
  }

  const moves = jobControls(job.status, canOperate)
  if (moves.length === 0 && !action) return null
  return (
    <span className="inline-flex h-full items-center gap-1.5" data-job-controls={job.jobId}>
      {moves.map((a) => (
        <Button key={a} variant={VARIANT[a]} className={compact ? 'h-6 px-2' : ''} onClick={() => setAction(a)} data-control={a} data-control-scope="job">
          {t(`controls.action.${a}`)}
        </Button>
      ))}
      {action && (
        <ControlDialog
          title={t(`controls.title.job.${action}`, { store: fsi(store) })}
          actsOn={
            <>
              <span>
                <span className="text-muted-foreground">{t('jobs.columns.store')} </span>
                <span className="font-mono">
                  <Ltr>{store}</Ltr>
                </span>
              </span>
              <span>
                <span className="text-muted-foreground">{t('controls.actsOnJob')} </span>
                <span className="font-mono text-[11px] text-muted-foreground">
                  <Ltr>{job.jobId}</Ltr>
                </span>
              </span>
            </>
          }
          note={t(`controls.note.job.${action}`)}
          takesNote={controlTakesNote(action)}
          confirmLabel={t(`controls.action.${action}`)}
          confirmVariant={CONFIRM_VARIANT[action]}
          busy={send.isPending}
          error={send.error}
          onConfirm={(note) => send.mutate({ action, note })}
          onClose={close}
        />
      )}
    </span>
  )
}

/**
 * The jobs grid's `rowActions` seam, as a STABLE module-level function: the grid's columns are
 * memoised on it, and a new function each render would remount every cell (and its open dialog).
 */
export const jobRowControls = (job: Job) => <JobControls job={job} compact />

/** The drawer footer's seam: the open job's controls at full size. */
export const jobDrawerControls = (job: Job) => <JobControls job={job} />
