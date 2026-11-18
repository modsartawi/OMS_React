import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { ColDef, ICellRendererParams, ValueFormatterParams } from 'ag-grid-community'
import type { TFunction } from 'i18next'
import { Trans, useTranslation } from 'react-i18next'
import { apiErrorMessage } from '@/core/api'
import type { StoreDbBlitzFinding, StoreDbJobKind } from '@/core/models/store-database'
import { usePermissions } from '@/core/permissions'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Ltr from '@/core/ui/Ltr'
import { MONO } from '../console-columns'
import { figure } from '../helpers'
import TabGrid from '../TabGrid'
import { storeDbBlitzQuery } from './api'
import { blitzControls, blitzFindings, blitzLink, blitzNotInstalled } from './blitz-helpers'
import JobButtons from './JobButtons'
import JobDialog from './JobDialog'
import type { StoreDbPanelProps } from './panel-views'

/**
 * sp_Blitz on the Health check panel (oms 919; BO 4039, spec 4016 D18): whether it is installed and its version (from
 * the store door), Run (a View read, up to 30 s) with its findings, and Install / Remove (Act jobs on the write rail).
 * A store without it is told so plainly — the door refuses, it never answers empty.
 */
export default function BlitzSection({ store }: StoreDbPanelProps) {
  const { t } = useTranslation('sync-console')
  const permissions = usePermissions()
  const state = store.blitz ?? null
  const controls = blitzControls(permissions, state)
  const [asked, setAsked] = useState(false)
  const [kind, setKind] = useState<StoreDbJobKind | null>(null)
  const blitz = useQuery(storeDbBlitzQuery(store.code, asked))
  const rows = useMemo(() => (blitz.data ? blitzFindings(blitz.data) : undefined), [blitz.data])
  const columns = useMemo(() => buildBlitzColumns(t), [t])
  const notInstalled = blitzNotInstalled(blitz.error)
  const jobs: StoreDbJobKind[] = [...(controls.install ? (['InstallBlitz'] as const) : []), ...(controls.remove ? (['RemoveBlitz'] as const) : [])]

  const run = () => {
    if (asked) void blitz.refetch()
    else setAsked(true)
  }

  return (
    <section className="flex flex-col gap-3 border-t border-border/60 pt-4" data-blitz="" data-blitz-installed={state ? String(state.installed) : 'unknown'}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{t('storeDb.blitz.title')}</h3>
        <span className="text-sm" data-blitz-state="">
          {!state ? (
            t('storeDb.blitz.unknown')
          ) : !state.installed ? (
            t('storeDb.blitz.notInstalled')
          ) : state.version ? (
            <Trans t={t} i18nKey="storeDb.blitz.installed" values={{ version: state.version }} components={{ v: <Ltr /> }} />
          ) : (
            t('storeDb.blitz.installedNoVersion')
          )}
        </span>
        {controls.run && (
          <Button variant="secondary" onClick={run} disabled={blitz.isFetching} data-blitz-run="">
            {t(asked ? 'storeDb.blitz.runAgain' : 'storeDb.blitz.run')}
          </Button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">{t('storeDb.blitz.intro')}</p>

      {jobs.length > 0 && <JobButtons kinds={jobs} onPick={setKind} hint={t('storeDb.blitz.hint')} />}

      {asked &&
        (notInstalled ? (
          <p className="rounded-md border border-border/60 p-3 text-sm" data-blitz-not-installed="">
            <NotInstalledRefusal message={apiErrorMessage(blitz.error, '')} />
          </p>
        ) : blitz.isError ? (
          <ErrorBanner className="p-3" message={apiErrorMessage(blitz.error, t('storeDb.blitz.failed'))} />
        ) : (
          <TabGrid
            rows={rows}
            columns={columns}
            pending={blitz.isPending}
            error={null}
            failed={t('storeDb.blitz.failed')}
            empty={t('storeDb.blitz.empty')}
            loading={t('storeDb.blitz.running')}
            data="store-db-blitz"
            maxRows={15}
          />
        ))}

      <JobDialog code={store.code} kind={kind} onClose={() => setKind(null)} />
    </section>
  )
}

/** The door's refusal for a store without sp_Blitz: our sentence, then the server's own words isolated in their slot. */
function NotInstalledRefusal({ message }: { message: string }) {
  const { t } = useTranslation('sync-console')
  if (!message) return <>{t('storeDb.blitz.notInstalledRefusal')}</>
  return (
    <Trans
      t={t}
      i18nKey="storeDb.blitz.notInstalledRefusalSaid"
      values={{ message }}
      components={{ message: <bdi className="text-muted-foreground" /> }}
    />
  )
}

/** sp_Blitz's own columns: priority, group, finding, database, details, and its "read more" link. */
function buildBlitzColumns(t: TFunction): ColDef<StoreDbBlitzFinding>[] {
  return [
    {
      headerName: t('storeDb.blitz.columns.priority'),
      field: 'priority',
      width: 90,
      type: 'rightAligned',
      valueFormatter: (p: ValueFormatterParams<StoreDbBlitzFinding, number>) => (p.value == null ? '' : figure(p.value)),
    },
    { headerName: t('storeDb.blitz.columns.group'), field: 'findingsGroup', width: 150 },
    { headerName: t('storeDb.blitz.columns.finding'), field: 'finding', flex: 1, minWidth: 220, tooltipField: 'finding' },
    { headerName: t('storeDb.blitz.columns.database'), field: 'databaseName', width: 120, cellClass: MONO },
    { headerName: t('storeDb.blitz.columns.details'), field: 'details', flex: 2, minWidth: 260, tooltipField: 'details' },
    {
      headerName: '',
      colId: 'url',
      width: 110,
      // Only an http(s) address becomes a link: the server's value is never trusted as an href (`blitzLink`).
      cellRenderer: (p: ICellRendererParams<StoreDbBlitzFinding>) => {
        const href = blitzLink(p.data?.url)
        return href ? (
          <a href={href} target="_blank" rel="noreferrer" className="text-primary underline-offset-2 hover:underline" data-blitz-url="">
            {t('storeDb.blitz.more')}
          </a>
        ) : null
      },
    },
  ]
}
