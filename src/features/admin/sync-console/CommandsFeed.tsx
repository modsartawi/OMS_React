import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import GridPager from '@/core/ui/GridPager'
import { clampToLastPageWhenCurrentPageEmpties, showsPager } from '@/core/ui/pager'
import { fsi } from '@/core/util/bidi'
import type { SyncCommand } from '@/core/models/sync-console'
import { AUDIT_KEY, COMMANDS_KEY, commandsQueryOptions, syncConsoleAccessQuery, syncConsoleApi } from './api'
import { buildCommandColumns } from './command-columns'
import { COMMANDS_PAGE_SIZE, commandKindKey, type CommandsFilter } from './command-helpers'
import { controlResultSummary } from './control-helpers'
import { notifyOutcome, resultSentence, type ControlOutcome } from './ControlDialog'
import ControlResults from './ControlResults'
import ReasonDialog from './ReasonDialog'
import TabGrid from './TabGrid'

const commandId = (c: SyncCommand) => c.id

/**
 * One page of `GET ActionSync/Commands` (ticket 448), newest first, paged by the
 * door at 50 — the fleet-wide Commands page and a store's Commands tab both draw
 * through this. The caller keys it on its filter, so a new filter starts at page 1.
 *
 * With `canOperate`, a Pending command carries **Cancel**, which asks for a reason on
 * the shared dialog and posts `ActionSync/Commands/Cancel`; a `NOT_PENDING` refusal
 * (it started meanwhile) is listed with its code.
 */
export default function CommandsFeed({ filter, empty }: { filter: CommandsFilter; empty: string }) {
  const { t } = useTranslation('sync-console')
  const qc = useQueryClient()
  const access = useQuery(syncConsoleAccessQuery())
  const canOperate = access.data?.canOperate === true
  const [page, setPage] = useState(1)
  const commands = useQuery({ ...commandsQueryOptions(filter, page), placeholderData: keepPreviousData })
  const [target, setTarget] = useState<SyncCommand | null>(null)
  const [outcome, setOutcome] = useState<ControlOutcome | null>(null)

  // The Cancel cell reads the latest setter through a ref, so the columns are built once.
  const pick = useRef(setTarget)
  pick.current = setTarget
  const onCancel = useCallback((c: SyncCommand) => pick.current(c), [])
  const columns = useMemo(() => buildCommandColumns(t, canOperate ? onCancel : null), [t, canOperate, onCancel])

  // As on the Fleet table: a failed read draws none of the previous page's rows.
  const shown = commands.isError ? undefined : commands.data
  const total = shown?.total ?? 0

  // A later read can shrink the feed under an inner page: an emptied page falls back to the last.
  const settled = shown && !commands.isPlaceholderData ? shown : undefined
  useEffect(() => {
    if (!settled) return
    const last = clampToLastPageWhenCurrentPageEmpties({
      page: settled.page,
      rowCount: settled.items.length,
      totalMatches: settled.total,
      pageSize: COMMANDS_PAGE_SIZE,
    })
    if (last !== settled.page) setPage((p) => (p === settled.page ? last : p))
  }, [settled])

  const cancel = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      syncConsoleApi.cancelCommands({ commandIds: [id], reason }),
    onSuccess: (data) => {
      const summary = controlResultSummary(data.results, (r) => r.commandId)
      const sentence = resultSentence(t, t('auditActions.CancelCommand'), summary, 'cancelResults')
      notifyOutcome(summary, sentence)
      setOutcome({ action: 'CancelCommand', summary })
      void qc.invalidateQueries({ queryKey: COMMANDS_KEY })
      void qc.invalidateQueries({ queryKey: AUDIT_KEY })
      close()
    },
  })

  const close = () => {
    cancel.reset()
    setTarget(null)
  }

  const kindLabel = (kind: string) => {
    const key = commandKindKey(kind)
    // A kind this bundle does not know is a machine code in a sentence: isolated whole.
    return key ? t(key) : fsi(kind)
  }

  return (
    <div className="flex flex-col gap-2">
      <ControlResults outcome={outcome} onDismiss={() => setOutcome(null)} />
      <TabGrid
        rows={shown?.items}
        columns={columns}
        rowId={commandId}
        pending={commands.isPending}
        error={commands.error}
        failed={t('commands.failed')}
        empty={page > 1 ? t('commands.emptyPage') : empty}
        loading={t('commands.loading')}
        data="commands"
      />
      {/* Drawn beside an empty or failed inner page too: it is the only way back from one. */}
      {((shown && showsPager(total, COMMANDS_PAGE_SIZE)) || page > 1) && (
        <div className="overflow-hidden rounded-md border border-border/60">
          <GridPager
            page={page}
            pageSize={COMMANDS_PAGE_SIZE}
            totalMatches={total}
            busy={commands.isPlaceholderData}
            onPage={setPage}
          />
        </div>
      )}
      <p className="text-xs text-muted-foreground">{t('commands.expiryNote')}</p>
      {target && (
        <ReasonDialog
          open
          title={t('commands.cancelTitle', { kind: kindLabel(target.kind), code: fsi(target.code) })}
          codes={[target.code]}
          busy={cancel.isPending}
          error={cancel.error}
          confirmLabel={t('commands.cancelConfirm')}
          onConfirm={(reason) => cancel.mutate({ id: target.id, reason })}
          onClose={close}
        />
      )}
    </div>
  )
}
