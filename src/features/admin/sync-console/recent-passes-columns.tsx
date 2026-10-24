import type { ColDef, ICellRendererParams, ValueFormatterParams } from 'ag-grid-community'
import type { TFunction } from 'i18next'
import { Link } from 'react-router'

import Ltr from '@/core/ui/Ltr'
import type { FleetPass } from '@/core/models/sync-console'
import { formatDateTime } from '@/core/util/date-format'
import { MONO } from './console-columns'
import { passKindBadge } from './recent-passes-helpers'
import { formatFigure } from './store-columns'
import CodeBadgeView from './CodeBadgeView'

/**
 * The Recent passes grid: the Passes tab's columns with the store in front and the
 * door's kind for the outcome. As on every console grid, the door orders and pages;
 * no column sorts on the client.
 */
export function buildRecentPassColumns(t: TFunction, onOpen: (pass: FleetPass) => void): ColDef<FleetPass>[] {
  return [
    {
      // 🔑 The way into a pass's detail — a real button, so the keyboard reaches it too.
      headerName: t('recentPasses.columns.startOn'),
      field: 'startOn',
      width: 170,
      cellRenderer: (p: ICellRendererParams<FleetPass>) =>
        p.data ? (
          <button
            type="button"
            onClick={() => p.data && onOpen(p.data)}
            className="font-medium text-primary underline-offset-2 hover:underline"
            title={t('passes.open')}
            data-pass={p.data.processId}
          >
            <Ltr>{formatDateTime(p.data.startOn) || p.data.processId}</Ltr>
          </button>
        ) : null,
    },
    {
      headerName: t('recentPasses.columns.code'),
      field: 'code',
      width: 90,
      cellClass: MONO,
      cellRenderer: (p: ICellRendererParams<FleetPass>) =>
        p.data ? (
          <Link
            to={`/admin/sync/store/${encodeURIComponent(p.data.code)}`}
            className="font-medium text-primary underline-offset-2 hover:underline"
            data-store-link={p.data.code}
          >
            <Ltr>{p.data.code}</Ltr>
          </Link>
        ) : null,
    },
    { headerName: t('recentPasses.columns.description'), field: 'description', width: 180 },
    {
      headerName: t('recentPasses.columns.loop'),
      field: 'loop',
      width: 80,
      valueFormatter: (p: ValueFormatterParams<FleetPass, string>) =>
        p.value ? t(`loops.${p.value}`, { defaultValue: p.value }) : '',
    },
    {
      headerName: t('recentPasses.columns.kind'),
      field: 'kind',
      width: 160,
      cellRenderer: (p: ICellRendererParams<FleetPass>) =>
        p.data ? <CodeBadgeView badge={passKindBadge(p.data.kind)} code={p.data.kind} /> : null,
    },
    { headerName: t('recentPasses.columns.seconds'), field: 'seconds', width: 90, type: 'rightAligned', valueFormatter: formatFigure },
    { headerName: t('recentPasses.columns.actionsCount'), field: 'actionsCount', width: 100, type: 'rightAligned', valueFormatter: formatFigure },
    { headerName: t('recentPasses.columns.errorMessage'), field: 'errorMessage', flex: 1, minWidth: 280 },
  ]
}
