import type { TFunction } from 'i18next'
import type { ColDef } from 'ag-grid-community'
import { pinStart } from '@/core/theme/direction'
import StatusBadge from '@/core/ui/StatusBadge'
import type { Severity } from '@/core/ui/severity'
import { formatDateTime } from '@/core/util/date-format'
import type { StageRow } from './stages'

/**
 * The stage screen's columns (BackOffice ticket 3899): one row per store, its stage and its last move. Store codes and user
 * ids are machine values: monospace. A person is shown by name (owner ruling 2026-11-15), the user id as the cell's tooltip.
 */

const CODE = 'font-mono text-[12px]'

/** Every column id, so each has its header in both locales (`i18n-keys.test.ts`). */
export const STAGE_COLUMN_IDS = ['store', 'stage', 'lastFrom', 'lastMover', 'lastWho', 'lastWhy', 'lastMovedAt'] as const

/** The movers SIS.Stock logs, so each has its label in both locales. */
export const MOVERS = ['Person', 'CountClosing', 'Seed'] as const

/** The stage's colour: Shadow is quiet, Seeding in motion, Seeded ready, Blocking live. */
export const STAGE_SEVERITY: Record<string, Severity> = { Shadow: 'mute', Seeding: 'warn', Seeded: 'go', Blocking: 'ok' }

/** A stage's label, the server's own word when this screen does not know it. */
export const stageLabel = (t: TFunction, stage: string): string =>
  stage ? t(`stage.${stage}`, { defaultValue: stage }) : t('dash')

/** A mover's label, the server's own word when this screen does not know it. */
export const moverLabel = (t: TFunction, mover: string): string => (mover ? t(`mover.${mover}`, { defaultValue: mover }) : '')

const header = (t: TFunction, colId: (typeof STAGE_COLUMN_IDS)[number]): ColDef<StageRow> => ({
  colId,
  field: colId,
  headerName: t(`column.${colId}`),
})

export function stageColumns(t: TFunction): ColDef<StageRow>[] {
  return [
    { ...header(t, 'store'), pinned: pinStart, minWidth: 90, cellClass: CODE },
    {
      ...header(t, 'stage'),
      minWidth: 120,
      valueFormatter: ({ value }) => stageLabel(t, value as string),
      cellRenderer: ({ data }: { data?: StageRow }) =>
        data ? <StatusBadge sev={STAGE_SEVERITY[data.stage] ?? 'mute'}>{stageLabel(t, data.stage)}</StatusBadge> : null,
    },
    { ...header(t, 'lastFrom'), minWidth: 110, valueFormatter: ({ value }) => (value ? stageLabel(t, value as string) : '') },
    { ...header(t, 'lastMover'), minWidth: 120, valueFormatter: ({ value }) => moverLabel(t, value as string) },
    { ...header(t, 'lastWho'), minWidth: 140, tooltipField: 'lastWhoId' },
    { ...header(t, 'lastWhy'), flex: 1, minWidth: 220, tooltipField: 'lastWhy' },
    {
      ...header(t, 'lastMovedAt'),
      minWidth: 150,
      valueFormatter: ({ value }) => formatDateTime(value as string) || '',
      cellClass: 'tabular-nums',
    },
  ]
}
