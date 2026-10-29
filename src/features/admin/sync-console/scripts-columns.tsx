import type { ColDef, ICellRendererParams, ValueFormatterParams } from 'ag-grid-community'
import type { TFunction } from 'i18next'

import Button from '@/core/ui/Button'
import type { ScriptStoreRow, SentScript } from '@/core/models/sync-console'
import { MONO, formatTime } from './console-columns'
import { scriptCounts, scriptIsLegacy, scriptStateBadge, scriptTargetKey, SCRIPT_STATES } from './scripts-helpers'
import { formatFigure } from './store-columns'
import CodeBadgeView from './CodeBadgeView'

/**
 * The Scripts page's grids (ticket 663). As on every console grid the door orders and pages; no
 * column sorts on the client. A title is free text, kept on the base cell, which isolates it.
 */
export function buildSentScriptColumns(t: TFunction, onOpen: (s: SentScript) => void): ColDef<SentScript>[] {
  return [
    {
      // 🔑 The way into a script's detail — a real button, so the keyboard reaches it too.
      headerName: t('scriptsPage.columns.title'),
      colId: 'title',
      flex: 1,
      minWidth: 240,
      cellRenderer: (p: ICellRendererParams<SentScript>) =>
        p.data ? (
          <Button variant="link" onClick={() => p.data && onOpen(p.data)} data-script-open={p.data.scriptId}>
            {scriptIsLegacy(p.data) ? (
              <span className="italic" data-script-legacy="">
                {t('scriptsPage.legacyTitle')}
              </span>
            ) : (
              <bdi>{p.data.title}</bdi>
            )}
          </Button>
        ) : null,
    },
    { headerName: t('scriptsPage.columns.sentBy'), field: 'sentBy', width: 130, cellClass: MONO },
    { headerName: t('scriptsPage.columns.sentAt'), field: 'sentAt', width: 160, valueFormatter: formatTime },
    {
      headerName: t('scriptsPage.columns.target'),
      field: 'targetMode',
      width: 150,
      valueFormatter: (p: ValueFormatterParams<SentScript, string | null>) => {
        const key = scriptTargetKey(p.value ?? null)
        return key ? t(key) : (p.value ?? '')
      },
    },
    { headerName: t('scriptsPage.columns.storeCount'), field: 'storeCount', width: 90, type: 'rightAligned', valueFormatter: formatFigure },
    // One column per derived state, in the ticket's order; a zero is drawn, it is a count.
    ...SCRIPT_STATES.map(
      (state): ColDef<SentScript> => ({
        headerName: t(`scriptStates.${state}`),
        colId: state,
        width: 105,
        type: 'rightAligned',
        valueGetter: (p) => (p.data ? scriptCounts(p.data).find((c) => c.state === state)?.n : null),
        valueFormatter: formatFigure,
        cellClassRules:
          state === 'exhausted' ? { 'font-semibold text-danger': (p) => typeof p.value === 'number' && p.value > 0 } : undefined,
      }),
    ),
  ]
}

/**
 * A script's per-store rows. With `retry` (ticket 664: a `canRunScripts` holder, on a live
 * script) a last column offers Retry on each row `offered` says is exhausted; without it the grid
 * is read only and has no such column.
 */
export function buildScriptStoreColumns(
  t: TFunction,
  retry?: { onRetry: (code: string) => void; offered: (row: ScriptStoreRow) => boolean },
): ColDef<ScriptStoreRow>[] {
  const retryColumn: ColDef<ScriptStoreRow>[] = retry
    ? [
        {
          headerName: t('scriptDetail.columns.retry'),
          colId: 'retry',
          width: 100,
          cellRenderer: (p: ICellRendererParams<ScriptStoreRow>) =>
            p.data && retry.offered(p.data) ? (
              <Button variant="link" onClick={() => p.data && retry.onRetry(p.data.code)} data-script-retry-store={p.data.code}>
                {t('scriptDetail.retryStore')}
              </Button>
            ) : null,
        },
      ]
    : []
  return [
    { headerName: t('scriptDetail.columns.code'), field: 'code', width: 90, cellClass: MONO },
    { headerName: t('scriptDetail.columns.description'), field: 'description', width: 200 },
    {
      headerName: t('scriptDetail.columns.state'),
      field: 'state',
      width: 130,
      cellRenderer: (p: ICellRendererParams<ScriptStoreRow>) =>
        p.data ? (
          <span data-script-store-state={p.data.state}>
            <CodeBadgeView badge={scriptStateBadge(p.data.state)} code={p.data.state} />
          </span>
        ) : null,
    },
    { headerName: t('scriptDetail.columns.attempts'), field: 'attempts', width: 95, type: 'rightAligned', valueFormatter: formatFigure },
    { headerName: t('scriptDetail.columns.lastAttempt'), field: 'lastAttempt', width: 160, valueFormatter: formatTime },
    { headerName: t('scriptDetail.columns.errorMessage'), field: 'errorMessage', flex: 1, minWidth: 260 },
    ...retryColumn,
  ]
}
