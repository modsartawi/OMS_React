import { useEffect, useMemo, useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import Modal from '@/core/ui/Modal'
import Button from '@/core/ui/Button'
import PasteCodesDialog from '@/core/ui/PasteCodesDialog'
import ChecklistPicker, { type ChecklistOption, type ChecklistPickerLabels } from '@/core/ui/ChecklistPicker'
import { chipsFor, markDisabled, rememberOptions } from '@/core/ui/checklist'
import BatchSummary from '@/core/ui/BatchSummary'
import Ltr from '@/core/ui/Ltr'
import { useBatchRun } from '@/core/ui/use-batch-run'
import { formatPair, fsi } from '@/core/util/bidi'
import { useDebounced } from '@/core/util/use-debounced'
import { refusalText, type RefusalWords } from '@/core/util/batch-runner'
import type { UaEmployeeGridRow } from '@/core/models/ua-user'
import { authzAdminApi } from './api'
import { resolvePastedIds, type PasteResolution } from './paste-ids'

interface Props {
  open: boolean
  onClose: () => void
  roleName: string
  /** Employee IDs that hold the role directly: shown greyed "Already holds", never ticked. */
  holders: string[]
  /** After a batch that assigned at least one person: re-read the holders, counts and assigned roles. */
  onAssigned: () => void | Promise<void>
}

/** One person as a picker row: `employeeId · name`, a pair led by a machine value (isolated once, LTR). */
function personOption(row: UaEmployeeGridRow, inactive: string): ChecklistOption {
  const option: ChecklistOption = { value: row.employeeId, label: formatPair(row.employeeId, row.displayName), machine: true }
  if (!row.isActive) option.tag = inactive
  return option
}

/**
 * Give a role to many people at once from the role's side (spec 805, ticket 807). The picker runs in
 * server mode over `AuthzAdminWeb/Employees` (contains-match on ID or name, capped at 50): each term
 * brings a new result set, and the picks — plain employee IDs — survive it as removable chips.
 *
 * **Assign to N** writes one `Users/AssignRole` per picked person, in pick order, through the batch
 * runner: a refusal (delegation scope, protected role) never stops it. The dialog stays open with
 * "N assigned, M refused"; refused people stay ticked with the server's message, so pressing the
 * button again retries just those. A person with no user account yet is fine — the server creates it
 * on the first assign. An expired session ends the batch and is `handle401`'s. While a batch or a
 * paste's lookups run, the dialog cannot be dismissed.
 */
export default function AddHoldersModal({ open, onClose, roleName, holders, onAssigned }: Props) {
  const { t } = useTranslation('authz-admin')
  const [query, setQuery] = useState('')
  const [picks, setPicks] = useState<string[]>([])
  // Every person seen in a result set, so a pick off the current page keeps its name on its chip.
  const [known, setKnown] = useState<Map<string, ChecklistOption>>(() => new Map())
  // Paste IDs (808): the paste box, the lookups' progress, and what the last paste resolved to.
  const [pasting, setPasting] = useState(false)
  const [resolving, setResolving] = useState<{ completed: number; total: number } | null>(null)
  const [pasteReport, setPasteReport] = useState<PasteResolution | null>(null)
  // Assigned people leave the picks (and, after the re-read, show "Already holds"); refused ones stay ticked.
  const batch = useBatchRun<string>({
    open,
    write: (employeeId) => authzAdminApi.assignRole(employeeId, roleName),
    onPicks: setPicks,
    onDone: onAssigned,
  })

  useEffect(() => {
    if (open) {
      setQuery('')
      setPicks([])
      setKnown(new Map())
      setPasting(false)
      setResolving(null)
      setPasteReport(null)
    }
  }, [open])

  const term = useDebounced(query.trim(), 300)
  const search = useQuery({
    queryKey: ['authz-admin', 'holder-search', term],
    queryFn: () => authzAdminApi.search(term),
    enabled: open && term !== '',
    // The last result set stays drawn while the next term's is fetched (as AddStoresDialog does).
    placeholderData: keepPreviousData,
  })

  const options = useMemo(() => {
    if (term === '' || !search.data) return []
    const rows = search.data.rows.map((r) => personOption(r, t('addHolders.inactive')))
    return markDisabled(rows, holders, t('addHolders.alreadyHolds'))
  }, [term, search.data, holders, t])

  useEffect(() => {
    if (options.length > 0) setKnown((k) => rememberOptions(k, options))
  }, [options])

  const labels: ChecklistPickerLabels = {
    list: t('addHolders.list'),
    search: t('addHolders.search'),
    selectAllShown: t('addHolders.selectAllShown'),
    clear: t('addHolders.clear'),
    picked: (count) => t('addHolders.picked', { count, n: fsi(String(count)) }),
    empty: t('addHolders.empty'),
    noMatch: t('addHolders.noMatch'),
    loading: t('addHolders.loading'),
    failed: t('addHolders.failed'),
    capped: t('addHolders.capped', { cap: fsi(String(search.data?.rowCap ?? 50)) }),
    removeChip: (label) => t('addHolders.removeChip', { person: label }),
  }
  const refusal: RefusalWords = { fallback: t('toast.failed'), denied: t('common.denied') }

  const { progress, running, result, refusals } = batch
  const busy = running || resolving !== null
  const searching = term !== '' && search.isFetching
  const nameOf = (id: string) => known.get(id)?.label ?? id

  /**
   * Each pasted ID is looked up through the same people search, one at a time, and picked only when a
   * row's ID equals it; current holders are reported, unknown IDs listed back. A paste that settles
   * after its dialog session ended keeps nothing.
   */
  async function resolvePaste(codes: string[]) {
    const isCurrent = batch.begin()
    setPasting(false)
    setPasteReport(null)
    // Seeded with the parsed count, so the progress never reads "0 of 0"; the resolver refines it.
    setResolving({ completed: 0, total: codes.length })
    const resolution = await resolvePastedIds(codes.join('\n'), {
      holders,
      skip: picks,
      lookup: (id) => authzAdminApi.search(id),
      onProgress: (completed, total) => {
        if (isCurrent()) setResolving({ completed, total })
      },
    })
    if (!isCurrent()) return
    setResolving(null)
    // An expired session is handle401's: it is already redirecting to the login.
    if (resolution.stopped) return
    const found = resolution.found.map((row) => personOption(row, t('addHolders.inactive')))
    setKnown((k) => rememberOptions(k, found))
    setPicks((p) => [...p, ...found.map((o) => o.value).filter((id) => !p.includes(id))])
    setPasteReport(resolution)
  }

  const count = picks.length
  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        dismissable={!busy}
        title={t('addHolders.title', { role: fsi(roleName) })}
        width="38rem"
        footer={
          <>
            <Button variant="text" onClick={onClose} disabled={busy}>
              {t('common.done')}
            </Button>
            <Button
              variant="primary"
              onClick={() => void batch.run(picks)}
              disabled={count === 0 || busy}
              data-testid="add-holders-submit"
            >
              {progress
                ? t('addHolders.assigning', { done: fsi(String(progress.completed)), total: fsi(String(progress.total)) })
                : t('addHolders.assignN', { count, n: fsi(String(count)) })}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <div className="flex items-start gap-2">
            <p className="flex-1 rounded-lg border border-primary/30 bg-primary/5 p-2.5 text-xs text-muted-foreground">
              {t('addHolders.intro')}
            </p>
            <Button variant="secondary" onClick={() => setPasting(true)} disabled={busy} data-testid="add-holders-paste-open">
              {resolving
                ? t('addHolders.pasteResolving', { done: fsi(String(resolving.completed)), total: fsi(String(resolving.total)) })
                : t('addHolders.pasteIds')}
            </Button>
          </div>
          {pasteReport && <PasteReport report={pasteReport} />}
          {result && (
            <BatchSummary
              result={result}
              summary={(done, refused) =>
                t('addHolders.summary', {
                  assigned: t('addHolders.summaryAssigned', { count: done, n: fsi(String(done)) }),
                  refused: t('addHolders.summaryRefused', { count: refused, n: fsi(String(refused)) }),
                })
              }
              refusal={refusal}
              nameOf={nameOf}
              data-testid="add-holders-summary"
            />
          )}
          <ChecklistPicker
            mode="server"
            options={options}
            picks={picks}
            onPicksChange={setPicks}
            query={query}
            onQueryChange={setQuery}
            labels={labels}
            chips={chipsFor(picks, known)}
            disabled={busy}
            loading={searching}
            failed={term !== '' && search.isError}
            capped={term !== '' && (search.data?.isCapped ?? false)}
            optionsTerm={term}
            rowNote={(id) =>
              refusals.has(id) ? (
                <span className="block text-xs text-danger-800">
                  <bdi>{refusalText(refusals.get(id), refusal)}</bdi>
                </span>
              ) : null
            }
            data-testid="add-holders-picker"
          />
        </div>
      </Modal>
      <PasteCodesDialog
        open={pasting}
        existing={picks}
        testId="holders-paste"
        labels={{
          title: t('addHolders.paste.title'),
          hint: t('addHolders.paste.hint'),
          added: (n) => t('addHolders.paste.added', { count: n, n: fsi(String(n)) }),
          skipped: (n) => t('addHolders.paste.skipped', { count: n, n: fsi(String(n)) }),
          ok: t('addHolders.paste.ok'),
          cancel: t('common.cancel'),
        }}
        onClose={() => setPasting(false)}
        onConfirm={(codes) => void resolvePaste(codes)}
      />
    </>
  )
}

/**
 * What a paste resolved to: how many were picked, and the IDs it could not use, each isolated LTR —
 * current holders, IDs whose search was too wide to tell (check by hand), IDs not found, failed lookups.
 */
function PasteReport({ report }: { report: PasteResolution }) {
  const { t } = useTranslation('authz-admin')
  const n = report.found.length
  const ids = (list: readonly string[]) => (
    <span className="flex flex-wrap gap-x-2">
      {list.map((id) => (
        <span key={id} data-paste-id={id} className="font-mono">
          <Ltr>{id}</Ltr>
        </span>
      ))}
    </span>
  )
  return (
    <div role="status" className="flex flex-col gap-1 rounded-lg border border-border/60 bg-muted/40 p-2.5 text-xs" data-testid="add-holders-paste-report">
      <p className="font-semibold" data-paste="found">
        {t('addHolders.pasteFound', { count: n, n: fsi(String(n)) })}
      </p>
      {report.alreadyHolds.length > 0 && (
        <div className="flex flex-wrap gap-x-2" data-paste="already-holds">
          <span>{t('addHolders.pasteAlreadyHolds')}</span>
          {ids(report.alreadyHolds)}
        </div>
      )}
      {report.tooMany.length > 0 && (
        <div className="flex flex-wrap gap-x-2 text-attention-800" data-paste="too-many">
          <span>{t('addHolders.pasteTooMany')}</span>
          {ids(report.tooMany)}
        </div>
      )}
      {report.notFound.length > 0 && (
        <div className="flex flex-wrap gap-x-2 text-danger-800" data-paste="not-found">
          <span>{t('addHolders.pasteNotFound')}</span>
          {ids(report.notFound)}
        </div>
      )}
      {report.failed.length > 0 && (
        <ul className="flex flex-col gap-0.5 text-danger-800" data-paste="failed">
          {report.failed.map(({ id, error }) => (
            <li key={id} className="flex flex-wrap gap-x-2">
              <span data-paste-id={id} className="font-mono">
                <Ltr>{id}</Ltr>
              </span>
              <bdi>{refusalText(error, { fallback: t('addHolders.pasteFailed'), denied: t('common.denied') })}</bdi>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
