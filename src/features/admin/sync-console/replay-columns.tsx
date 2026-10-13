import type { ColDef } from 'ag-grid-community'
import type { TFunction } from 'i18next'

import type { ReplayRow } from '@/core/models/sync-console'
import { MONO, formatTime } from './console-columns'

/**
 * The Replay page's recent replays (spec 470, ticket 475): when and who, the source store
 * and receipt, then the target store, register and new receipt number. Every value is a
 * machine value or a user id, isolated by the console's base cell; as on every console
 * grid, the door orders and pages the list.
 */
export function buildReplayColumns(t: TFunction): ColDef<ReplayRow>[] {
  return [
    { headerName: t('replay.recent.columns.at'), field: 'at', width: 160, valueFormatter: formatTime },
    { headerName: t('replay.recent.columns.who'), field: 'who', width: 140 },
    { headerName: t('replay.recent.columns.sourceStore'), field: 'sourceStoreCode', width: 130, cellClass: MONO },
    { headerName: t('replay.recent.columns.sourceReceipt'), field: 'sourceReceiptNumber', width: 190, cellClass: MONO },
    { headerName: t('replay.recent.columns.store'), field: 'storeCode', width: 110, cellClass: MONO },
    { headerName: t('replay.recent.columns.register'), field: 'registerId', width: 110, cellClass: MONO },
    { headerName: t('replay.recent.columns.receipt'), field: 'receiptNumber', flex: 1, minWidth: 190, cellClass: MONO },
  ]
}
