import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router'
import { ArrowLeft, ExternalLink, Loader2, Trash2 } from 'lucide-react'
import { apiErrorMessage } from '@/core/api'
import type { KeptRun } from '@/core/models/sourcing-run'
import { notify } from '@/core/services/notify'
import { canRunSourcingAdvisor } from '@/core/sourcing-advisor/access'
import { SIMULATOR_PATH, simulatorRunPath } from '@/core/sourcing-advisor/simulator-path'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Ltr from '@/core/ui/Ltr'
import Modal from '@/core/ui/Modal'
import ScreenGate from '@/core/ui/ScreenGate'
import { TD, TH } from '@/core/ui/sheet-table'
import { fsi } from '@/core/util/bidi'
import { keptRunsQuery, simulatorApi, storedRunQuery } from './api'
import CopyRunLink from './CopyRunLink'
import { canDelete, keptRunsList } from './kept-runs-model'

/**
 * OMS ▸ Sourcing simulator ▸ Kept runs (ticket 969, BackOffice spec 4354 §12 and §19; BackOffice 4380). The caller's own
 * kept runs, newest first: a run's link opens the simulator on it straight away (owner, on the 969 prototype), any
 * holder of the run grant may open it, and only its keeper may delete it. §12 says nothing of listing another keeper's
 * runs, so they are reached by their link only.
 *
 * Opens under the run grant. ⚠ Built on stubs: the doors are BackOffice 4380, still open.
 */
export default function KeptRunsPage() {
  const { t } = useTranslation('sourcing-simulator')
  return (
    <ScreenGate can={canRunSourcingAdvisor} ns="sourcing-simulator" title={t('kept.list.title')} subtitle={t('kept.list.lede')}>
      <KeptRuns />
    </ScreenGate>
  )
}

function KeptRuns() {
  const { t } = useTranslation('sourcing-simulator')
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const list = useQuery(keptRunsQuery())
  const runs = useMemo(() => keptRunsList(list.data ?? []), [list.data])
  const [deleting, setDeleting] = useState<KeptRun | null>(null)
  const remove = useMutation({
    mutationFn: (runId: string) => simulatorApi.deleteKeptRun(runId),
    onSuccess: (_, runId) => {
      setDeleting(null)
      notify.success(t('kept.list.deleted'))
      void queryClient.invalidateQueries({ queryKey: keptRunsQuery().queryKey })
      // Review 2 #1: a stored run is read once and kept (`staleTime: Infinity`); a deleted one must not open from it.
      queryClient.removeQueries({ queryKey: storedRunQuery(runId).queryKey })
    },
  })
  // Review 2 #6: the set's name and version are data in a sentence, each isolated whole.
  const weightSet = (r: KeptRun) => {
    const values = { name: fsi(r.weightSet.name), version: fsi(r.weightSet.version) }
    return r.weightSet.draft ? t('kept.list.draft', values) : t('runInfo.weightSetName', values)
  }

  return (
    <section className="flex w-full max-w-7xl flex-col gap-4" data-kept-runs="">
      <div>
        <Link to={SIMULATOR_PATH} className="inline-flex items-center gap-1 text-xs text-primary underline underline-offset-2" data-back-to-simulator="">
          <ArrowLeft className="size-3.5 rtl:-scale-x-100" aria-hidden />
          {t('kept.list.back')}
        </Link>
      </div>
      {list.isPending ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status" data-kept-loading="">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          {t('kept.list.loading')}
        </p>
      ) : list.isError ? (
        <ErrorBanner className="px-3 py-2" message={apiErrorMessage(list.error, t('kept.list.failed'))} />
      ) : runs.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card p-6 text-sm" data-kept-empty="">
          <p className="font-semibold">{t('kept.list.empty.title')}</p>
          <p className="text-muted-foreground">{t('kept.list.empty.hint')}</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full text-xs" data-kept-table="">
            <thead className="border-b border-border text-muted-foreground">
              <tr>
                <th className={TH}>{t('kept.list.col.name')}</th>
                <th className={TH}>{t('kept.list.col.kind')}</th>
                <th className={TH}>{t('kept.list.col.channel')}</th>
                <th className={TH}>{t('kept.list.col.order')}</th>
                <th className={TH}>{t('kept.list.col.weightSet')}</th>
                <th className={TH}>{t('kept.list.col.ranAt')}</th>
                <th className={TH}>{t('kept.list.col.keptAt')}</th>
                <th className={TH}>{t('kept.list.col.engine')}</th>
                <th className={TH} />
              </tr>
            </thead>
            <tbody>
              {runs.map((r) => (
                <tr key={r.runId} className="border-b border-border/60 last:border-b-0" data-kept-run={r.runId}>
                  <td className={`${TD} whitespace-normal`}>
                    <b>
                      <bdi>{r.name}</bdi>
                    </b>
                    <span className="block font-mono text-[11px] text-muted-foreground">
                      <Ltr>{r.runId}</Ltr>
                    </span>
                  </td>
                  <td className={TD}>{t(`kept.kind.${r.kind}`, { defaultValue: r.kind })}</td>
                  <td className={TD}>{t(`cart.channels.${r.channel}`, { defaultValue: r.channel })}</td>
                  <td className={TD}>{r.orderNumber ? <Ltr>{r.orderNumber}</Ltr> : <span className="text-muted-foreground">{t('dash')}</span>}</td>
                  <td className={`${TD} whitespace-normal`}>
                    <bdi>{weightSet(r)}</bdi>
                  </td>
                  <td className={TD}>
                    <Ltr>{r.ranAt}</Ltr>
                  </td>
                  <td className={TD}>
                    <Ltr>{r.keptAt}</Ltr>
                  </td>
                  <td className={TD}>
                    <Ltr>{r.engine}</Ltr>
                  </td>
                  <td className={TD}>
                    <span className="flex items-center justify-end gap-1">
                      <Button variant="outlined" onClick={() => navigate(simulatorRunPath(r.runId))} data-kept-open={r.runId}>
                        <ExternalLink className="size-3.5" aria-hidden />
                        {t('kept.list.open')}
                      </Button>
                      <CopyRunLink runId={r.runId} variant="ghost" />
                      {canDelete(r) && (
                        <Button
                          variant="danger-outlined"
                          onClick={() => {
                            remove.reset()
                            setDeleting(r)
                          }}
                          data-kept-delete={r.runId}
                        >
                          <Trash2 className="size-3.5" aria-hidden />
                          {t('kept.list.delete')}
                        </Button>
                      )}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Modal
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title={t('kept.list.deleteDialog.title')}
        width="28rem"
        dismissable={!remove.isPending}
        footer={
          <>
            <Button variant="outlined" onClick={() => setDeleting(null)} disabled={remove.isPending}>
              {t('kept.list.deleteDialog.cancel')}
            </Button>
            <Button variant="danger" onClick={() => deleting && remove.mutate(deleting.runId)} disabled={remove.isPending} data-kept-delete-confirm="">
              {remove.isPending && <Loader2 className="size-3.5 animate-spin" aria-hidden />}
              {t('kept.list.deleteDialog.confirm')}
            </Button>
          </>
        }
      >
        {deleting && (
          <div className="flex flex-col gap-2 text-sm">
            <p className="font-semibold">
              <bdi>{deleting.name}</bdi>
            </p>
            <p className="text-muted-foreground">{t('kept.list.deleteDialog.body')}</p>
            {remove.isError && <ErrorBanner className="px-3 py-2" message={apiErrorMessage(remove.error, t('kept.list.deleteFailed'))} />}
          </div>
        )}
      </Modal>
    </section>
  )
}
