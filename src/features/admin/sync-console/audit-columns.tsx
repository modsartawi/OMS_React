import type { ColDef, ICellRendererParams, ValueFormatterParams } from 'ag-grid-community'
import type { TFunction } from 'i18next'
import { Trans } from 'react-i18next'
import { ArrowRight } from 'lucide-react'

import Ltr from '@/core/ui/Ltr'
import { MONO, formatTime } from './console-columns'
import { auditActionKey, type AuditEvent } from './control-helpers'
import { figure } from './helpers'

/**
 * The audit feed's columns (ticket 447) — the fleet-wide page and a store's tab draw
 * the same entry: who, when, the action, the stores or batch, before → after, and
 * the reason. As on every console grid, the door orders and pages the list.
 *
 * A bulk run's chunks arrive folded into one event (`groupAuditByBatch`, ticket 902): its
 * stores are every chunk's, and the batch carries the chunk count.
 */
export function buildAuditColumns(t: TFunction): ColDef<AuditEvent>[] {
  return [
    { headerName: t('audit.columns.at'), field: 'at', width: 160, valueFormatter: formatTime },
    { headerName: t('audit.columns.who'), field: 'who', width: 140 },
    {
      headerName: t('audit.columns.action'),
      field: 'action',
      width: 160,
      // An action this bundle does not know shows its raw code, never a raw key.
      valueFormatter: (p: ValueFormatterParams<AuditEvent, string>) => {
        if (!p.value) return ''
        const key = auditActionKey(p.value)
        return key ? t(key) : p.value
      },
    },
    {
      // The stores as one list of codes, isolated once; the batch beside it when there is one.
      headerName: t('audit.columns.codes'),
      colId: 'codes',
      width: 240,
      cellClass: MONO,
      cellRenderer: (p: ICellRendererParams<AuditEvent>) =>
        p.data ? (
          <span className="flex min-w-0 items-center gap-2" data-audit-codes={p.data.codes.join(' ')}>
            <span className="truncate">
              <Ltr>{p.data.codes.join(t('list.separator'))}</Ltr>
            </span>
            {p.data.batchId && (
              <span className="shrink-0 text-muted-foreground" data-audit-batch={p.data.batchId}>
                {t('audit.batch')} <Ltr>{p.data.batchId}</Ltr>
                {p.data.chunks > 1 && (
                  <span className="ms-1" data-audit-chunks={p.data.chunks}>
                    <Trans
                      t={t}
                      i18nKey="audit.chunks"
                      count={p.data.chunks}
                      values={{ n: figure(p.data.chunks) }}
                      components={{ n: <Ltr /> }}
                    />
                  </span>
                )}
              </span>
            )}
          </span>
        ) : null,
    },
    {
      // Two values of free text, each isolated on its own: the arrow between them (turned
      // under RTL) carries the order, as words would.
      headerName: t('audit.columns.change'),
      colId: 'change',
      width: 260,
      cellRenderer: (p: ICellRendererParams<AuditEvent>) =>
        p.data && (p.data.before != null || p.data.after != null) ? (
          <span className="flex min-w-0 items-center gap-1.5" data-audit-change="">
            <bdi className="truncate text-muted-foreground">{p.data.before ?? ''}</bdi>
            <ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground rtl:rotate-180" aria-hidden />
            <bdi className="truncate">{p.data.after ?? ''}</bdi>
          </span>
        ) : null,
    },
    {
      headerName: t('audit.columns.reason'),
      field: 'reason',
      flex: 1,
      minWidth: 260,
      wrapText: true,
      autoHeight: true,
      cellClass: 'leading-snug py-1.5',
    },
  ]
}
