import type { ColDef, ICellRendererParams } from 'ag-grid-community'
import type { TFunction } from 'i18next'
import { Link } from 'react-router'

import Ltr from '@/core/ui/Ltr'
import StatusBadge from '@/core/ui/StatusBadge'
import type { PendingStore, SyncCommand } from '@/core/models/sync-console'
import { MONO, formatTime } from './console-columns'
import { failureLabelKey } from './control-helpers'
import { connectionTestVerdict, type PastedRow, type TestVerdict, type WizardResultRow } from './onboard-helpers'

/**
 * The onboarding grids' columns (ticket 449): the Sync pending list, the paste preview
 * and the wizard's result per row. As on every console grid, the base `defaultColDef`
 * isolates the plain cells; a renderer isolates its own values.
 */

/** A store code as a link to its page, or as plain text when it has none yet. */
const codeCell = (code: string, linked: boolean) =>
  linked ? (
    <Link
      to={`/admin/sync/store/${encodeURIComponent(code)}`}
      className="font-medium text-primary underline-offset-2 hover:underline"
      data-result-store={code}
    >
      <Ltr>{code}</Ltr>
    </Link>
  ) : (
    <Ltr>{code}</Ltr>
  )

// ── Sync pending ────────────────────────────────────────────────────────────────

/**
 * The pending list. With `canOperate`, a row carries **Finish**, which opens the
 * wizard at step 2 for its code (the description rides along as router state);
 * without it, no action column at all (absent, not disabled).
 */
export function buildPendingColumns(t: TFunction, canOperate: boolean): ColDef<PendingStore>[] {
  const columns: ColDef<PendingStore>[] = [
    { headerName: t('pending.columns.code'), field: 'code', width: 110, cellClass: MONO },
    { headerName: t('pending.columns.description'), field: 'description', flex: 1, minWidth: 200 },
    { headerName: t('pending.columns.city'), field: 'city', width: 160 },
    { headerName: t('pending.columns.createdAt'), field: 'createdAt', width: 160, valueFormatter: formatTime },
  ]
  if (canOperate)
    columns.push({
      headerName: '',
      colId: 'finish',
      width: 140,
      cellRenderer: (p: ICellRendererParams<PendingStore>) =>
        p.data ? (
          <Link
            to={`/admin/sync/new-store?code=${encodeURIComponent(p.data.code)}`}
            state={{ description: p.data.description }}
            className="font-medium text-primary underline-offset-2 hover:underline"
            data-pending-finish={p.data.code}
          >
            {t('pending.finish')}
          </Link>
        ) : null,
    })
  return columns
}

// ── The paste preview ───────────────────────────────────────────────────────────

/** One parsed row's cells, keyed by column. */
type Pasted = PastedRow<string>

/**
 * The parsed paste, before any call: the line, every column, and what is wrong with
 * the row (each problem in words), so a bad code is marked where it was pasted.
 */
export function buildPasteColumns(t: TFunction, columns: readonly string[]): ColDef<Pasted>[] {
  return [
    { headerName: t('onboard.paste.line'), field: 'line', width: 70 },
    ...columns.map(
      (key): ColDef<Pasted> => ({
        headerName: t(`onboard.fields.${key}`),
        colId: key,
        valueGetter: (p) => p.data?.fields[key] ?? '',
        width: key === 'code' ? 90 : key === 'description' || key === 'address' ? 180 : 130,
        cellClass: key === 'code' || key === 'ip' ? MONO : undefined,
      }),
    ),
    {
      headerName: t('onboard.paste.check'),
      colId: 'problems',
      flex: 1,
      minWidth: 220,
      cellRenderer: (p: ICellRendererParams<Pasted>) =>
        p.data ? (
          <span className="flex flex-wrap items-center gap-1" data-paste-row={p.data.line} data-paste-problems={p.data.problems.join(' ')}>
            {p.data.problems.length === 0 ? (
              <StatusBadge sev="ok">{t('onboard.paste.ok')}</StatusBadge>
            ) : (
              p.data.problems.map((problem) => (
                <StatusBadge key={problem} sev="bad">
                  {t(`onboard.problems.${problem}`)}
                </StatusBadge>
              ))
            )}
          </span>
        ) : null,
    },
  ]
}

// ── The result per row ──────────────────────────────────────────────────────────

/** The tests being followed, by command id, and whether the poll gave up first. */
export interface FollowedTests {
  commands: ReadonlyMap<string, Pick<SyncCommand, 'status' | 'result'>>
  timedOut: boolean
}

const TEST_SEVERITY: Record<TestVerdict, 'go' | 'ok' | 'warn' | 'mute'> = {
  testing: 'go',
  ok: 'ok',
  warning: 'warn',
  stillRunning: 'mute',
}

/**
 * The answer per row: the store master (created, or existed and skipped), the sync
 * location, the refusal with its code, and the connection test — whose failure is a
 * 🚩 **warning**, never an error. A preview says what WOULD happen and has no test.
 */
export function buildResultColumns(
  t: TFunction,
  { preview, master, tests }: { preview: boolean; master: boolean; tests: FollowedTests | null },
): ColDef<WizardResultRow>[] {
  const when = preview ? 'preview' : 'done'
  const columns: ColDef<WizardResultRow>[] = [
    {
      headerName: t('onboard.result.code'),
      field: 'code',
      width: 90,
      cellClass: MONO,
      cellRenderer: (p: ICellRendererParams<WizardResultRow>) =>
        p.data ? codeCell(p.data.code, !preview && p.data.locationCreated) : null,
    },
  ]
  if (master)
    columns.push({
      headerName: t('onboard.result.store'),
      colId: 'store',
      width: 170,
      cellRenderer: (p: ICellRendererParams<WizardResultRow>) =>
        p.data && p.data.store && p.data.store !== 'none' ? (
          <span data-result-master={p.data.store}>
            <StatusBadge sev={p.data.store === 'created' ? 'ok' : 'mute'}>
              {t(`onboard.result.${when}.${p.data.store}`)}
            </StatusBadge>
          </span>
        ) : null,
    })
  columns.push(
    {
      headerName: t('onboard.result.location'),
      colId: 'location',
      width: 170,
      cellRenderer: (p: ICellRendererParams<WizardResultRow>) =>
        p.data?.locationCreated ? (
          <span data-result-location="">
            <StatusBadge sev="ok">{t(`onboard.result.${when}.location`)}</StatusBadge>
          </span>
        ) : null,
    },
    {
      headerName: t('onboard.result.refusal'),
      colId: 'refusal',
      width: 340,
      cellRenderer: (p: ICellRendererParams<WizardResultRow>) => {
        if (!p.data || p.data.ok) return null
        const code = p.data.error ?? ''
        // Here NO_STORE means the store master is missing: it is created first (step 1), not looked up.
        const key = code === 'NO_STORE' ? 'onboard.result.noStore' : code ? failureLabelKey(code) : null
        return (
          <span className="flex min-w-0 items-center gap-1.5" data-failure={p.data.code} data-failure-code={code}>
            <StatusBadge sev="bad">{key ? t(key) : t('onboard.result.refused')}</StatusBadge>
            {code && (
              <span className="font-mono text-[12px] text-muted-foreground">
                <Ltr>{code}</Ltr>
              </span>
            )}
          </span>
        )
      },
    },
  )
  if (!preview)
    columns.push({
      headerName: t('onboard.result.test'),
      colId: 'test',
      flex: 1,
      minWidth: 260,
      cellRenderer: (p: ICellRendererParams<WizardResultRow>) => {
        const row = p.data
        if (!row) return null
        // `Store/Onboard` names no test to follow; its own warning says how the test went.
        if (row.warning)
          return (
            <span className="flex min-w-0 items-center gap-1.5" data-result-test="warning">
              <StatusBadge sev="warn">{t('onboard.test.warning')}</StatusBadge>
              <bdi className="truncate text-muted-foreground">{row.warning}</bdi>
            </span>
          )
        if (!row.testCommandId || !tests) return null
        const command = tests.commands.get(row.testCommandId)
        const verdict = connectionTestVerdict(command, tests.timedOut)
        return (
          <span className="flex min-w-0 items-center gap-1.5" data-result-test={verdict}>
            <StatusBadge sev={TEST_SEVERITY[verdict]}>{t(`onboard.test.${verdict}`)}</StatusBadge>
            {verdict !== 'testing' && command?.result && (
              <bdi className="truncate text-muted-foreground">{command.result}</bdi>
            )}
          </span>
        )
      },
    })
  return columns
}
