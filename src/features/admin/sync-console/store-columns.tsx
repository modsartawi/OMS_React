import type { ColDef, ICellRendererParams, ValueFormatterParams } from 'ag-grid-community'
import type { TFunction } from 'i18next'

import Ltr from '@/core/ui/Ltr'
import type { PassDetailLine, StoreCounter, StorePass, StoreScript } from '@/core/models/sync-console'
import { formatDateTime } from '@/core/util/date-format'
import { CONSOLE_DEFAULT_COL_DEF, MONO, formatTime } from './console-columns'
import { figure } from './helpers'
import { passLineBadge, passOutcomeBadge, scriptBadge } from './store-helpers'
import CodeBadgeView from './CodeBadgeView'

/**
 * The store page's grid columns (ticket 446): Counters, Passes, a pass's detail and
 * Scripts. A server message (an error) keeps the base cell, which isolates it as
 * free text. As on the Fleet table, no column sorts or filters on the client — the
 * door orders every list, and Passes is paged by it.
 */
export const STORE_DEFAULT_COL_DEF: ColDef = CONSOLE_DEFAULT_COL_DEF

/** A count, grouped; `null` (not tracked, e.g. a pull counter's log head) is blank, not `0`. */
const formatFigure = (p: ValueFormatterParams) => (p.value == null ? '' : figure(p.value as number))

export function buildCounterColumns(t: TFunction): ColDef<StoreCounter>[] {
  return [
    { headerName: t('counters.columns.lineNumber'), field: 'lineNumber', width: 80, type: 'rightAligned' },
    { headerName: t('counters.columns.objectId'), field: 'objectId', width: 200, cellClass: MONO },
    {
      headerName: t('counters.columns.bound'),
      field: 'bound',
      width: 110,
      valueFormatter: (p: ValueFormatterParams<StoreCounter, string>) =>
        p.value ? t(`counters.bounds.${p.value}`, { defaultValue: p.value }) : '',
    },
    { headerName: t('counters.columns.counter'), field: 'counter', width: 140, type: 'rightAligned', valueFormatter: formatFigure },
    { headerName: t('counters.columns.logHead'), field: 'logHead', width: 150, type: 'rightAligned', valueFormatter: formatFigure },
    { headerName: t('counters.columns.lag'), field: 'lag', width: 110, type: 'rightAligned', valueFormatter: formatFigure },
    { headerName: t('counters.columns.oldestPendingAt'), field: 'oldestPendingAt', width: 170, valueFormatter: formatTime },
  ]
}

export function buildPassColumns(t: TFunction, onOpen: (pass: StorePass) => void): ColDef<StorePass>[] {
  return [
    {
      // 🔑 The way into a pass's detail — a real button, so the keyboard reaches it too.
      headerName: t('passes.columns.startOn'),
      field: 'startOn',
      width: 170,
      cellRenderer: (p: ICellRendererParams<StorePass>) =>
        p.data ? (
          <button
            type="button"
            onClick={() => p.data && onOpen(p.data)}
            className="font-medium text-primary underline-offset-2 hover:underline"
            // The visible start time names the button; the title only says what it does.
            title={t('passes.open')}
            data-pass={p.data.processId}
          >
            {/* A pass with no start time is still opened, by its process id. */}
            <Ltr>{formatDateTime(p.data.startOn) || p.data.processId}</Ltr>
          </button>
        ) : null,
    },
    {
      headerName: t('passes.columns.loop'),
      field: 'loop',
      width: 90,
      valueFormatter: (p: ValueFormatterParams<StorePass, string>) =>
        p.value ? t(`loops.${p.value}`, { defaultValue: p.value }) : '',
    },
    {
      headerName: t('passes.columns.status'),
      field: 'status',
      width: 120,
      cellRenderer: (p: ICellRendererParams<StorePass>) =>
        p.data ? <CodeBadgeView badge={passOutcomeBadge(p.data.status)} code={p.data.status} /> : null,
    },
    { headerName: t('passes.columns.actionsCount'), field: 'actionsCount', width: 100, type: 'rightAligned', valueFormatter: formatFigure },
    { headerName: t('passes.columns.finishOn'), field: 'finishOn', width: 170, valueFormatter: formatTime },
    { headerName: t('passes.columns.errorMessage'), field: 'errorMessage', flex: 1, minWidth: 260 },
  ]
}

export function buildPassDetailColumns(t: TFunction): ColDef<PassDetailLine>[] {
  return [
    { headerName: t('passDetail.columns.lineNumber'), field: 'lineNumber', width: 80, type: 'rightAligned' },
    { headerName: t('passDetail.columns.objectId'), field: 'objectId', width: 150, cellClass: MONO },
    { headerName: t('passDetail.columns.identifiers'), field: 'identifiers', width: 160, cellClass: MONO },
    { headerName: t('passDetail.columns.actionType'), field: 'actionType', width: 110 },
    { headerName: t('passDetail.columns.counter'), field: 'counter', width: 130, type: 'rightAligned', valueFormatter: formatFigure },
    {
      headerName: t('passDetail.columns.lineStatus'),
      field: 'lineStatus',
      width: 100,
      cellRenderer: (p: ICellRendererParams<PassDetailLine>) =>
        p.data ? <CodeBadgeView badge={passLineBadge(p.data.lineStatus)} code={p.data.lineStatus} /> : null,
    },
    { headerName: t('passDetail.columns.startOn'), field: 'startOn', width: 160, valueFormatter: formatTime },
    { headerName: t('passDetail.columns.finishOn'), field: 'finishOn', width: 160, valueFormatter: formatTime },
    { headerName: t('passDetail.columns.errorMessage'), field: 'errorMessage', flex: 1, minWidth: 240 },
  ]
}

export function buildScriptColumns(t: TFunction): ColDef<StoreScript>[] {
  return [
    // The script's id and never its SQL: the door does not send the text, and no column asks for it.
    { headerName: t('scripts.columns.scriptId'), field: 'scriptId', width: 200, cellClass: MONO },
    { headerName: t('scripts.columns.createdAt'), field: 'createdAt', width: 170, valueFormatter: formatTime },
    {
      headerName: t('scripts.columns.isExecuted'),
      field: 'isExecuted',
      width: 140,
      cellRenderer: (p: ICellRendererParams<StoreScript>) =>
        p.data ? <CodeBadgeView badge={scriptBadge(p.data)} code={String(p.data.isExecuted)} /> : null,
    },
    { headerName: t('scripts.columns.lastAttempt'), field: 'lastAttempt', width: 170, valueFormatter: formatTime },
    { headerName: t('scripts.columns.errorMessage'), field: 'errorMessage', flex: 1, minWidth: 260 },
  ]
}
