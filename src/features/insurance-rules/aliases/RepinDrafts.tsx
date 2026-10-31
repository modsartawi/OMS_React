import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useLocation, useSearchParams } from 'react-router'
import { Check, FileDiff, Loader2 } from 'lucide-react'

import { apiErrorMessage, isBareDenial } from '@/core/api'
import { BACKTEST_POLL_MS, backtestRunning, maskedKey } from '@/core/insurance-rules/backtest'
import { ByAt, DeniedCard, Loading, NUM, TD, TH } from '@/core/insurance-rules/parts'
import { notify } from '@/core/services/notify'
import { useSession } from '@/core/session'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Ltr from '@/core/ui/Ltr'
import Modal from '@/core/ui/Modal'
import StatusBadge from '@/core/ui/StatusBadge'
import { fsi } from '@/core/util/bidi'
import { REPINS_KEY, repinApi } from './api'
import { knownDecision, labelPairs, repinNeedsBacktest, repinStanding, repinSummary, type AffectedRuleset, type RepinBacktest, type RepinDraft } from './repin'

/**
 * The published rulesets still on an old form (oms 705; door 3294). Each offers a re-pin draft: the form before and
 * after and the back-test of old against new, approved by someone else. Until then the ruleset runs as pinned. A
 * labels-only draft (oms 708; door 3297) shows the text before and after instead, with no back-test. `?repin=<id>`
 * opens a draft, which is how a labels-changed review item reaches it.
 */
export default function RepinDrafts() {
  const { t } = useTranslation('insurance-aliases')
  const qc = useQueryClient()
  const affected = useQuery({ queryKey: [...REPINS_KEY, 'affected'], queryFn: () => repinApi.affected(), retry: false })
  const [params, setParams] = useSearchParams()
  const [openId, setOpenId] = useState<string | null>(() => params.get('repin'))
  // The Fields page links here: the list sits under the aliases, so the link brings it into view once it has loaded.
  const { hash } = useLocation()
  const section = useRef<HTMLElement>(null)
  const loaded = !!affected.data
  useEffect(() => {
    if (hash === '#repin-drafts') section.current?.scrollIntoView()
  }, [hash, loaded])
  const closeDraft = () => {
    setOpenId(null)
    if (params.has('repin')) {
      setParams(
        (p) => {
          p.delete('repin')
          return p
        },
        { replace: true },
      )
    }
  }
  const raise = useMutation({
    mutationFn: (row: AffectedRuleset) => repinApi.raise(row),
    onSuccess: (draft) => {
      setOpenId(draft.id)
      return qc.invalidateQueries({ queryKey: REPINS_KEY })
    },
    onError: (err) => (isBareDenial(err) ? notify.error(t('repin.raiseFailed'), t('repin.grant')) : notify.apiError(t('repin.raiseFailed'), err, t('repin.raiseFailed'))),
  })

  let body
  if (affected.isError && isBareDenial(affected.error)) body = <DeniedCard ns="insurance-aliases" hook="repin-denied" />
  else if (affected.isError) body = <ErrorBanner className="p-3" message={apiErrorMessage(affected.error, t('repin.failed'))} />
  else if (!affected.data) body = <Loading text={t('repin.loading')} />
  else if (affected.data.length === 0)
    body = (
      <p className="text-sm text-muted-foreground" data-repin-empty="">
        {t('repin.empty')}
      </p>
    )
  else
    body = (
      <div className="overflow-x-auto rounded-md border border-border/60">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted">
              <th className={TH}>{t('repin.col.ruleset')}</th>
              <th className={TH}>{t('repin.col.kind')}</th>
              <th className={TH}>{t('repin.col.subject')}</th>
              <th className={TH} />
            </tr>
          </thead>
          <tbody>
            {affected.data.map((row) => (
              <tr key={`${row.rulesetId}/${row.changeId}`} className="border-t border-border/60" data-repin-row={row.rulesetId} data-repin-kind={row.kind}>
                <td className={TD}>
                  <RulesetName name={row.rulesetName} version={row.rulesetVersion} />
                  {row.kind === 'labels' && (
                    <span className="ms-2" data-repin-labels-badge="">
                      <StatusBadge sev="warn">{t('repin.labels.badge')}</StatusBadge>
                    </span>
                  )}
                </td>
                <td className={TD}>{t(`repin.kind.${row.kind}`)}</td>
                <td className={`${TD} font-mono text-xs break-all`} data-repin-subject="">
                  <Ltr>{row.subject}</Ltr>
                </td>
                <td className={`${TD} text-end`}>
                  {row.draftId ? (
                    <Button variant="secondary" onClick={() => setOpenId(row.draftId)} data-repin-open={row.rulesetId}>
                      <FileDiff className="h-3.5 w-3.5" aria-hidden />
                      {t('repin.open')}
                    </Button>
                  ) : (
                    <Button variant="secondary" aria-disabled={raise.isPending} onClick={() => !raise.isPending && raise.mutate(row)} data-repin-raise={row.rulesetId}>
                      <FileDiff className="h-3.5 w-3.5" aria-hidden />
                      {t('repin.raise')}
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )

  return (
    <section ref={section} id="repin-drafts" className="flex flex-col gap-2" data-repin-list="">
      <div className="max-w-3xl">
        <h2 className="text-sm font-semibold">{t('repin.title')}</h2>
        <p className="text-xs text-muted-foreground">{t('repin.hint')}</p>
      </div>
      {body}
      {openId && <RepinDraftDialog id={openId} onClose={closeDraft} />}
    </section>
  )
}

function RulesetName({ name, version }: { name: string; version: number }) {
  const { t } = useTranslation('insurance-aliases')
  return (
    <span className="inline-flex flex-wrap items-baseline gap-x-1.5">
      <bdi data-repin-ruleset="">{name}</bdi>
      <span className="text-xs text-muted-foreground">
        {t('repin.version')} <Ltr>{version}</Ltr>
      </span>
    </span>
  )
}

function RepinDraftDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const { t } = useTranslation('insurance-aliases')
  const qc = useQueryClient()
  const userId = useSession((s) => s.userId)
  const query = useQuery({
    queryKey: [...REPINS_KEY, 'draft', id],
    queryFn: () => repinApi.draft(id),
    retry: false,
    refetchInterval: (q) => (q.state.data?.backtest && backtestRunning(q.state.data.backtest) ? BACKTEST_POLL_MS : false),
  })
  const draft = query.data
  const standing = draft ? repinStanding(draft, userId) : 'none'
  const approve = useMutation({
    mutationFn: () => repinApi.approve(id),
    onSuccess: (d) => {
      notify.success(t('repin.done'), fsi(String(d.versionNo)))
      onClose()
    },
    onError: (err) => (isBareDenial(err) ? notify.error(t('repin.approveFailed'), t('repin.grant')) : notify.apiError(t('repin.approveFailed'), err, t('repin.approveFailed'))),
    onSettled: () => qc.invalidateQueries({ queryKey: REPINS_KEY }),
  })

  return (
    <Modal
      open
      onClose={onClose}
      width="56rem"
      title={t('repin.draftTitle')}
      footer={
        <>
          {standing === 'ownDraft' && (
            <span className="me-auto self-center text-xs text-muted-foreground" data-repin-why="">
              {t('repin.own')}
            </span>
          )}
          {standing === 'noBacktest' && (
            <span className="me-auto self-center text-xs text-muted-foreground" data-repin-why="">
              {t('repin.waiting')}
            </span>
          )}
          <Button variant="text" onClick={onClose} data-repin-close="">
            {t('repin.close')}
          </Button>
          {standing === 'may' && (
            <Button variant="primary" aria-disabled={approve.isPending} onClick={() => !approve.isPending && approve.mutate()} data-repin-approve="">
              {approve.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Check className="h-3.5 w-3.5" aria-hidden />}
              {t('repin.approve')}
            </Button>
          )}
        </>
      }
    >
      {query.isError && <ErrorBanner className="p-3" message={isBareDenial(query.error) ? t('repin.grant') : apiErrorMessage(query.error, t('repin.draftFailed'))} />}
      {!query.isError && !draft && <Loading text={t('repin.draftLoading')} />}
      {draft && <DraftBody draft={draft} />}
    </Modal>
  )
}

function DraftBody({ draft }: { draft: RepinDraft }) {
  const { t } = useTranslation('insurance-aliases')
  const form = (value: string | null) => (value === null ? <span className="text-muted-foreground">{t('repin.nothingPinned')}</span> : <Ltr>{value}</Ltr>)
  const labels = draft.kind === 'labels'
  return (
    <div className="flex flex-col gap-4 text-sm" data-repin-draft={draft.id} data-repin-draft-state={draft.state}>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
        <dt className="text-xs text-muted-foreground">{t('repin.col.ruleset')}</dt>
        <dd>
          <RulesetName name={draft.rulesetName} version={draft.rulesetVersion} />
        </dd>
        <dt className="text-xs text-muted-foreground">{t('repin.col.kind')}</dt>
        <dd>{t(`repin.kind.${draft.kind}`)}</dd>
        <dt className="text-xs text-muted-foreground">{t('repin.col.subject')}</dt>
        <dd className="font-mono text-xs break-all">
          <Ltr>{draft.subject}</Ltr>
        </dd>
        <dt className="text-xs text-muted-foreground">{t(labels ? 'repin.labels.versionBefore' : 'repin.before')}</dt>
        <dd className="font-mono text-xs break-all" data-repin-before="">
          {form(draft.before)}
        </dd>
        <dt className="text-xs text-muted-foreground">{t(labels ? 'repin.labels.versionAfter' : 'repin.after')}</dt>
        <dd className="font-mono text-xs break-all" data-repin-after="">
          {form(draft.after)}
        </dd>
        <dt className="text-xs text-muted-foreground">{t('repin.raisedBy')}</dt>
        <dd className="text-xs" data-repin-raised-by="">
          <ByAt by={draft.createdBy} at={draft.createdAt} />
        </dd>
      </dl>
      <p className="text-xs text-muted-foreground" data-repin-pinned="">
        {t('repin.pinned')}
      </p>
      {repinNeedsBacktest(draft.kind) ? <BacktestView backtest={draft.backtest} /> : <LabelTexts draft={draft} />}
    </div>
  )
}

/** A labels-only draft: each rule's text before and after, in both languages, whatever the reader's. Each side its own isolate. */
function LabelTexts({ draft }: { draft: RepinDraft }) {
  const { t } = useTranslation('insurance-aliases')
  const pairs = labelPairs(draft.texts)
  const text = (value: string) => (value ? <bdi>{value}</bdi> : <span className="text-muted-foreground">{t('repin.labels.noText')}</span>)
  return (
    <div className="flex flex-col gap-3" data-repin-texts="">
      <h3 className="text-sm font-semibold">{t('repin.labels.title')}</h3>
      {pairs.length === 0 ? (
        <p className="flex items-center gap-2" data-repin-no-text-change="">
          <StatusBadge sev="ok">{t('repin.noChangeBadge')}</StatusBadge>
          {t('repin.labels.noChange')}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-md border border-border/60">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted">
                <th className={TH}>{t('repin.col.rule')}</th>
                <th className={TH}>{t('repin.labels.language')}</th>
                <th className={TH}>{t('repin.before')}</th>
                <th className={TH}>{t('repin.after')}</th>
              </tr>
            </thead>
            <tbody>
              {pairs.map((p) => (
                <tr key={`${p.ruleId}/${p.lang}`} className="border-t border-border/60" data-repin-text={`${p.ruleId}/${p.lang}`}>
                  <td className={`${TD} font-mono text-xs`}>
                    <Ltr>{p.ruleId}</Ltr>
                  </td>
                  <td className={`${TD} text-xs`}>{t(`repin.labels.lang.${p.lang}`)}</td>
                  <td className={TD} data-repin-text-before="">
                    {text(p.before)}
                  </td>
                  <td className={TD} data-repin-text-after="">
                    {text(p.after)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function BacktestView({ backtest }: { backtest: RepinBacktest | null }) {
  const { t } = useTranslation('insurance-aliases')
  if (!backtest) return null
  if (backtest.status === 'failed') return <ErrorBanner className="p-3" message={backtest.error || t('repin.backtestFailed')} />
  if (backtest.status !== 'done') return <Loading text={t('repin.backtestRunning')} />

  const summary = repinSummary(backtest)
  const decision = (d: string) => (knownDecision(d) ? t(`repin.decision.${d}`) : <Ltr>{d}</Ltr>)
  const moved = backtest.changes.filter((c) => c.before !== c.after)
  return (
    <div className="flex flex-col gap-3" data-repin-backtest="">
      <h3 className="text-sm font-semibold">{t('repin.backtestTitle')}</h3>
      <dl className="flex flex-wrap gap-x-6 gap-y-1">
        {(
          [
            ['bundles', summary.bundles],
            ['changed', summary.changed],
            ['unchanged', summary.unchanged],
          ] as const
        ).map(([key, value]) => (
          <div key={key} className="flex items-baseline gap-1.5" data-repin-stat={key}>
            <dt className="text-xs text-muted-foreground">{t(`repin.stat.${key}`)}</dt>
            <dd className="font-medium tabular-nums">
              <Ltr>{value}</Ltr>
            </dd>
          </div>
        ))}
      </dl>
      {summary.changed === 0 && (
        <p className="flex items-center gap-2" data-repin-no-change="">
          <StatusBadge sev="ok">{t('repin.noChangeBadge')}</StatusBadge>
          {t('repin.noChange')}
        </p>
      )}
      {summary.truncated && (
        <p className="text-xs text-muted-foreground" data-repin-truncated="">
          {t('repin.truncated')}
        </p>
      )}
      {summary.moves.length > 0 && (
        <div className="overflow-x-auto rounded-md border border-border/60">
          <table className="w-full text-sm" data-repin-moves="">
            <thead>
              <tr className="bg-muted">
                <th className={TH}>{t('repin.before')}</th>
                <th className={TH}>{t('repin.after')}</th>
                <th className={`${TH} text-end`}>{t('repin.col.bundles')}</th>
              </tr>
            </thead>
            <tbody>
              {summary.moves.map((m) => (
                <tr key={`${m.from}/${m.to}`} className="border-t border-border/60" data-repin-move={`${m.from}/${m.to}`}>
                  <td className={TD}>{decision(m.from)}</td>
                  <td className={TD}>{decision(m.to)}</td>
                  <td className={NUM}>
                    <Ltr>{m.count}</Ltr>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {moved.length > 0 && (
        <div className="overflow-x-auto rounded-md border border-border/60">
          <table className="w-full text-sm" data-repin-changes="">
            <thead>
              <tr className="bg-muted">
                <th className={TH}>{t('repin.col.on')}</th>
                <th className={TH}>{t('repin.col.bundle')}</th>
                <th className={TH}>{t('repin.col.payer')}</th>
                <th className={TH}>{t('repin.col.patient')}</th>
                <th className={TH}>{t('repin.col.rule')}</th>
                <th className={TH}>{t('repin.before')}</th>
                <th className={TH}>{t('repin.after')}</th>
              </tr>
            </thead>
            <tbody>
              {moved.map((c) => (
                <tr key={`${c.bundleId}/${c.ruleId}`} className="border-t border-border/60" data-repin-change={c.bundleId}>
                  <td className={`${TD} text-xs`}>
                    <Ltr>{c.on}</Ltr>
                  </td>
                  <td className={`${TD} font-mono text-xs`}>
                    <Ltr>{c.bundleId}</Ltr>
                  </td>
                  <td className={`${TD} font-mono text-xs`}>
                    <Ltr>{c.payer}</Ltr>
                  </td>
                  <td className={`${TD} font-mono text-xs`} data-repin-patient="">
                    <Ltr>{maskedKey(c.maskedKey)}</Ltr>
                  </td>
                  <td className={`${TD} font-mono text-xs`}>
                    <Ltr>{c.ruleId}</Ltr>
                  </td>
                  <td className={TD}>{decision(c.before)}</td>
                  <td className={TD}>{decision(c.after)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
