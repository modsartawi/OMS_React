import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { PencilLine, Plus } from 'lucide-react'

import { apiErrorMessage, isBareDenial } from '@/core/api'
import { ByAt, Loading, NUM, TD, TH } from '@/core/insurance-rules/parts'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Ltr from '@/core/ui/Ltr'
import StatusBadge from '@/core/ui/StatusBadge'
import { proposedQuery, worklistQuery } from './api'
import OverrideEditor, { type EditorTarget } from './OverrideEditor'
import { WORKLIST_REASONS, pendingFor, type LabelOverride, type WorklistRow } from './overrides'
import { Label } from './WorkbookUpload'

/**
 * The curation worklist and what waits for a second person (ticket 707). The worklist is rendered in the door's order
 * with no client sort: the ranking is the door's, by census frequency. A code off the worklist (a corrected English
 * label) is written through "Write a label", and the proposals table is where its approver finds it.
 */
export default function LabelCuration() {
  const { t } = useTranslation('insurance-labels')
  const worklist = useQuery(worklistQuery())
  const proposed = useQuery(proposedQuery())
  const [target, setTarget] = useState<EditorTarget | null>(null)
  const pending = proposed.data ?? []

  return (
    <>
      <section className="flex flex-col gap-2" data-worklist="">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold">{t('worklist.title')}</h2>
            <p className="text-xs text-muted-foreground">{t('worklist.hint')}</p>
          </div>
          <Button variant="secondary" onClick={() => setTarget({ kind: 'new' })} data-override-new="">
            <Plus className="h-3.5 w-3.5" aria-hidden />
            {t('worklist.writeAny')}
          </Button>
        </div>
        {worklist.isError ? (
          <ErrorBanner className="p-3" message={isBareDenial(worklist.error) ? t('access.deniedTitle') : apiErrorMessage(worklist.error, t('worklist.failed'))} />
        ) : !worklist.data ? (
          <Loading text={t('worklist.loading')} />
        ) : (
          <WorklistTable rows={worklist.data} pending={pending} onOpen={(row) => setTarget({ kind: 'code', system: row.system, code: row.code, current: row.current })} />
        )}
      </section>

      <section className="flex flex-col gap-2" data-proposals="">
        <h2 className="text-sm font-semibold">{t('proposals.title')}</h2>
        {proposed.isError ? (
          <ErrorBanner className="p-3" message={isBareDenial(proposed.error) ? t('access.deniedTitle') : apiErrorMessage(proposed.error, t('proposals.failed'))} />
        ) : !proposed.data ? (
          <Loading text={t('proposals.loading')} />
        ) : (
          <ProposalsTable rows={proposed.data} onOpen={(o) => setTarget({ kind: 'code', system: o.system, code: o.code, current: o.current })} />
        )}
      </section>

      {target && <OverrideEditor target={target} proposals={pending} onClose={() => setTarget(null)} />}
    </>
  )
}

function WorklistTable({ rows, pending, onOpen }: { rows: WorklistRow[]; pending: LabelOverride[]; onOpen: (row: WorklistRow) => void }) {
  const { t } = useTranslation('insurance-labels')
  if (rows.length === 0) {
    return (
      <p className="rounded-md border border-border/60 py-6 text-center text-sm text-muted-foreground" data-worklist-empty="">
        {t('worklist.empty')}
      </p>
    )
  }
  return (
    <div className="max-h-[28rem] overflow-auto rounded-md border border-border/60">
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr>
            <th className={TH}>{t('worklist.code')}</th>
            <th className={TH}>{t('worklist.system')}</th>
            <th className={TH}>{t('worklist.current')}</th>
            <th className={TH}>{t('worklist.reason')}</th>
            <th className={`${TH} text-end`}>{t('worklist.frequency')}</th>
            <th className={TH} />
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const waiting = pendingFor(pending, row.system, row.code)
            return (
              <tr key={`${row.system}|${row.code}`} className="border-t border-border/60" data-worklist-row={row.code}>
                <td className={TD} data-col="code">
                  <Ltr>{row.code}</Ltr>
                </td>
                <td className={`${TD} break-all text-xs`} data-col="system">
                  <Ltr>{row.system}</Ltr>
                </td>
                <td className={TD} data-col="current">
                  <Label text={row.current} />
                </td>
                <td className={TD} data-col="reason">
                  <ReasonName reason={row.reason} />
                </td>
                <td className={NUM} data-col="frequency">
                  <Ltr>{row.frequency}</Ltr>
                </td>
                <td className={`${TD} text-end`}>
                  <div className="flex items-center justify-end gap-2">
                    {waiting && <StatusBadge sev="warn">{t('worklist.waiting')}</StatusBadge>}
                    <Button variant="secondary" onClick={() => onOpen(row)} data-worklist-open={row.code}>
                      <PencilLine className="h-3.5 w-3.5" aria-hidden />
                      {waiting ? t('worklist.review') : t('worklist.write')}
                    </Button>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function ReasonName({ reason }: { reason: string }) {
  const { t } = useTranslation('insurance-labels')
  if (!(WORKLIST_REASONS as readonly string[]).includes(reason)) return <Ltr>{reason}</Ltr>
  return <StatusBadge sev={reason === 'unlabelled' ? 'mute' : 'warn'}>{t(`worklist.reasons.${reason}`)}</StatusBadge>
}

function ProposalsTable({ rows, onOpen }: { rows: LabelOverride[]; onOpen: (override: LabelOverride) => void }) {
  const { t } = useTranslation('insurance-labels')
  if (rows.length === 0) {
    return (
      <p className="rounded-md border border-border/60 py-6 text-center text-sm text-muted-foreground" data-proposals-empty="">
        {t('proposals.empty')}
      </p>
    )
  }
  return (
    <div className="overflow-x-auto rounded-md border border-border/60">
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr>
            <th className={TH}>{t('worklist.code')}</th>
            <th className={TH}>{t('worklist.system')}</th>
            <th className={TH}>{t('proposals.proposed')}</th>
            <th className={TH}>{t('proposals.by')}</th>
            <th className={TH} />
          </tr>
        </thead>
        <tbody>
          {rows.map((o) => (
            <tr key={o.id} className="border-t border-border/60" data-proposal={o.id}>
              <td className={TD} data-col="code">
                <Ltr>{o.code}</Ltr>
              </td>
              <td className={`${TD} break-all text-xs`} data-col="system">
                <Ltr>{o.system}</Ltr>
              </td>
              <td className={TD} data-col="proposed">
                <Label text={o} />
              </td>
              <td className={`${TD} text-xs`} data-col="by">
                <ByAt by={o.proposedBy} at={o.proposedAt} />
              </td>
              <td className={`${TD} text-end`}>
                <Button variant="secondary" onClick={() => onOpen(o)} data-proposal-open={o.id}>
                  {t('worklist.review')}
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
