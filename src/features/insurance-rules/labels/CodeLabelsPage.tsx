import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { apiErrorMessage, isBareDenial } from '@/core/api'
import { ByAt, DeniedCard, Loading, TD, TH } from '@/core/insurance-rules/parts'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Ltr from '@/core/ui/Ltr'
import { loadsQuery } from './api'
import LabelCuration from './LabelCuration'
import type { WorkbookLoad } from './labels'
import WorkbookUpload, { WorkbookName } from './WorkbookUpload'

/**
 * Insurance rules ▸ Code labels — `/insurance-rules/code-labels` (BackOffice spec 3271 L3–L5, oms ticket 706).
 * A grant holder uploads a Nphies workbook, reads the labels it changed and its new change-log rows, and sees
 * every past load: who, when, the file hash and the version. There is no second approver for an upload. A curated
 * label does have one: the worklist ranks what lacks Arabic and its rows open the override editor (L12, L13; ticket 707).
 *
 * 🚩 UNGATED: no access probe; a bare 403 on the read is "You do not have access".
 */
export default function CodeLabelsPage() {
  const { t } = useTranslation('insurance-labels')
  const loads = useQuery(loadsQuery())
  const denied = loads.isError && isBareDenial(loads.error)
  return (
    <section className="flex h-full w-full flex-col gap-4" data-code-labels-page="">
      <header className="max-w-3xl">
        <h1 className="text-lg font-semibold tracking-tight">{t('page.title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('page.lede')}</p>
      </header>
      {denied ? (
        <DeniedCard ns="insurance-labels" hook="code-labels-denied" />
      ) : (
        <>
          <WorkbookUpload />
          <LabelCuration />
          <section className="flex flex-col gap-2" data-load-log="">
            <h2 className="text-sm font-semibold">{t('log.title')}</h2>
            {loads.isError ? (
              <ErrorBanner className="p-3" message={apiErrorMessage(loads.error, t('log.failed'))} />
            ) : !loads.data ? (
              <Loading text={t('log.loading')} />
            ) : (
              <LoadLog rows={loads.data} />
            )}
          </section>
        </>
      )}
    </section>
  )
}

function LoadLog({ rows }: { rows: WorkbookLoad[] }) {
  const { t } = useTranslation('insurance-labels')
  if (rows.length === 0) {
    return (
      <p className="rounded-md border border-border/60 py-6 text-center text-sm text-muted-foreground" data-load-log-empty="">
        {t('log.empty')}
      </p>
    )
  }
  return (
    <div className="overflow-x-auto rounded-md border border-border/60">
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr>
            <th className={TH}>{t('log.workbook')}</th>
            <th className={TH}>{t('log.version')}</th>
            <th className={TH}>{t('log.file')}</th>
            <th className={TH}>{t('log.uploaded')}</th>
            <th className={TH}>{t('log.hash')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((load) => (
            <tr key={load.id} className="border-t border-border/60" data-load={load.id}>
              <td className={TD} data-col="workbook">
                <WorkbookName kind={load.workbook} />
              </td>
              <td className={TD} data-col="version">
                <Ltr>{load.version}</Ltr>
              </td>
              <td className={TD} data-col="file">
                <bdi>{load.fileName ?? ''}</bdi>
              </td>
              <td className={`${TD} text-xs`} data-col="uploaded">
                <ByAt by={load.uploadedBy} at={load.uploadedAt} />
              </td>
              <td className={`${TD} break-all font-mono text-xs`} data-col="hash">
                <Ltr>{load.fileHash}</Ltr>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
