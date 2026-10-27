import { useState, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { Loader2 } from 'lucide-react'

import { apiErrorMessage, isBareDenial } from '@/core/api'
import { GUARD_DRAFT_KEY, INSURANCE_RULES_KEY, guardDraftQuery, insuranceRulesApi } from '@/core/insurance-rules/api'
import { GUARD_BACKTESTS_KEY, backtestProgressPct, backtestStanding, draftBacktestQuery, type GuardBacktest } from '@/core/insurance-rules/backtest'
import { GuardSeverityBadge, RuleId } from '@/core/insurance-rules/badges'
import { checksVerdict } from '@/core/insurance-rules/checks'
import { INSURANCE_RULES_PATH, guardRulePath, ruleSeverity, type GuardRule, type GuardRuleset } from '@/core/insurance-rules/model'
import { saysIn } from '@/core/rules/sentence'
import { confirmAction } from '@/core/services/confirm'
import { notify } from '@/core/services/notify'
import { useSession } from '@/core/session'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Field from '@/core/ui/Field'
import Input from '@/core/ui/Input'
import Ltr from '@/core/ui/Ltr'
import Textarea from '@/core/ui/Textarea'
import { fsi } from '@/core/util/bidi'
import { formatDay, toIsoDate } from '@/core/util/date-format'
import { actionsFor, type ApprovalAction, type DraftApproval } from '@/core/insurance-rules/approval'
import { promoteGate } from './approval'
import { APPROVALS_KEY, approvalQuery, approvalsApi, shadowFiguresQuery, versionsQuery, type RulesetVersion } from './api'
import { ByAt, DeniedCard, Loading } from '@/core/insurance-rules/parts'

const NS = 'insurance-approvals'
/** 612's simulator, where the back-test is run (`app/insurance-rules-routes`). */
const SIMULATOR_PATH = `${INSURANCE_RULES_PATH}/simulator`

/**
 * Insurance rules ▸ Approvals — `/insurance-rules/approvals` (oms ticket 611; doors 3139, back-test 3140). The
 * guard draft's approval panel by role: an author asks for approval (only once a back-test of the CURRENT
 * revision has finished and HQ's checks show no error); a different user, the approver, approves or sends it
 * back. Shadow rules with their shadow figures and days in shadow, which the approver promotes (or, under 14 days,
 * skips shadow with a reason). The ruleset's versions — who, when, note — each restorable as a new draft.
 *
 * 🚩 UNGATED: no access probe until 618; the role comes from the (guessed) Approval read, and a bare 403 is
 * "You do not have access".
 */
export default function ApprovalsPage() {
  const { t } = useTranslation(NS)
  const draft = useQuery(guardDraftQuery())
  const approval = useQuery(approvalQuery())

  const error = draft.error ?? approval.error
  let body: ReactNode
  if (error && isBareDenial(error)) body = <DeniedCard ns="insurance-approvals" hook="approvals-denied" />
  else if (error) body = <ErrorBanner className="p-3" message={apiErrorMessage(error, t('failed'))} />
  else if (!draft.data || !approval.data) body = <Loading text={t('loading')} />
  else
    body = (
      <>
        <DraftPanel doc={draft.data} approval={approval.data} />
        <ShadowSection doc={draft.data} approver={approval.data.viewer.approver} />
        <VersionsSection author={approval.data.viewer.author} />
      </>
    )

  return (
    <section className="flex w-full max-w-5xl flex-col gap-5" data-approvals-page="">
      <header>
        <h1 className="text-lg font-semibold tracking-tight">{t('title')}</h1>
        <p className="text-sm text-muted-foreground">{t('lede')}</p>
      </header>
      {body}
    </section>
  )
}

// ── The draft: ask, approve, send back ─────────────────────────────────────────────────────────

function DraftPanel({ doc, approval }: { doc: GuardRuleset; approval: DraftApproval }) {
  const { t } = useTranslation(NS)
  const queryClient = useQueryClient()
  const userId = useSession((s) => s.userId)
  const backtest = useQuery(draftBacktestQuery(approval.backtestId))
  // HQ's checks of THIS revision; asked once per revision.
  const checks = useQuery({
    queryKey: [...INSURANCE_RULES_KEY, 'guards', 'checks', doc.revision],
    queryFn: () => insuranceRulesApi.validateGuardDraft(doc),
    retry: false,
  })
  const verdict = checks.data ? checksVerdict(checks.data) : null
  const actions = actionsFor({ approval, userId, backtest: approval.backtestId ? backtest.data : null, checks: verdict })
  const [note, setNote] = useState('')

  const act = useMutation({
    mutationFn: (kind: ApprovalAction['kind']) =>
      kind === 'submit' ? approvalsApi.submit(note.trim()) : kind === 'approve' ? approvalsApi.approve(note.trim()) : approvalsApi.sendBack(note.trim()),
    onSuccess: async (next, kind) => {
      setNote('')
      queryClient.setQueryData(APPROVALS_KEY, next)
      notify.success(t(`done.${kind}`))
      // The rules' states move with the draft (waiting → shadow / live, or back to draft).
      await queryClient.invalidateQueries({ queryKey: GUARD_DRAFT_KEY })
      await queryClient.invalidateQueries({ queryKey: [...INSURANCE_RULES_KEY, 'guards', 'list'] })
      await queryClient.invalidateQueries({ queryKey: [...INSURANCE_RULES_KEY, 'guards', 'versions'] })
    },
  })
  const run = (a: ApprovalAction) => {
    if (!a.enabled || act.isPending) return
    act.mutate(a.kind)
  }

  const standing = backtestStanding(approval.backtestId ? backtest.data : null, approval.revision)
  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border/60 bg-card p-4" data-approval-panel={approval.state}>
      <div className="flex flex-wrap items-baseline gap-2">
        <h2 className="text-base font-semibold tracking-tight">{t('draft.title')}</h2>
        <span className="text-sm text-muted-foreground" data-draft-revision="">
          {t('draft.revision')} <Ltr>{doc.revision}</Ltr>
        </span>
        <span className="ms-auto rounded-full border border-border px-2 py-0.5 text-xs font-medium" data-approval-state={approval.state}>
          {t(`draft.state.${approval.state}`)}
        </span>
      </div>

      {approval.state === 'waiting' && (
        <div className="text-sm" data-submitted="">
          <span className="text-muted-foreground">{t('draft.submittedBy')}</span> <ByAt by={approval.submittedBy} at={approval.submittedAt} />
          {approval.note && (
            <p className="mt-1" data-submitted-note="">
              <bdi>{approval.note}</bdi>
            </p>
          )}
        </div>
      )}
      {approval.state === 'draft' && approval.sentBack && (
        <div className="rounded-md border border-border bg-attention-050 p-2 text-sm text-attention-800" data-sent-back="">
          <span>{t('draft.sentBackBy')}</span> <ByAt by={approval.sentBack.by} at={approval.sentBack.at} />
          <p className="mt-1">
            <bdi>{approval.sentBack.note}</bdi>
          </p>
        </div>
      )}

      <dl className="grid gap-1 text-sm sm:grid-cols-[10rem_minmax(0,1fr)]">
        <dt className="text-muted-foreground">{t('backtest.label')}</dt>
        <dd data-backtest-standing={standing}>
          <BacktestLine standing={standing} bt={approval.backtestId ? (backtest.data ?? null) : null} loading={!!approval.backtestId && backtest.isPending} />
        </dd>
        <dt className="text-muted-foreground">{t('checks.label')}</dt>
        <dd data-checks={checks.isPending ? 'checking' : checks.isError ? 'failed' : verdict?.blocked ? 'errors' : 'pass'}>
          {checks.isPending ? (
            t('checks.checking')
          ) : checks.isError ? (
            apiErrorMessage(checks.error, t('checks.failed'))
          ) : verdict?.blocked ? (
            <>
              {t('checks.errors')} <Ltr>{verdict.errors}</Ltr>
            </>
          ) : verdict && verdict.warnings > 0 ? (
            <>
              {t('checks.warnings')} <Ltr>{verdict.warnings}</Ltr>
            </>
          ) : (
            t('checks.pass')
          )}
        </dd>
      </dl>

      {approval.state === 'waiting' && !actions.length && (
        <p className="text-sm text-muted-foreground" data-waiting-note="">
          {t('draft.waitingForApprover')}
        </p>
      )}

      {actions.length > 0 && (
        <div className="flex flex-col gap-2" data-approval-actions="">
          <Field label={t(approval.state === 'draft' ? 'note.toApprover' : 'note.toAuthor')}>
            <Textarea rows={2} dir="auto" value={note} onChange={(e) => setNote(e.target.value)} className="w-full" data-note="" />
          </Field>
          <div className="flex flex-wrap items-center gap-2">
            {actions.map((a) => (
              <Button
                key={a.kind}
                variant={a.kind === 'sendBack' ? 'secondary' : 'primary'}
                aria-disabled={!a.enabled || act.isPending}
                title={a.why ? t(`why.${a.why}`) : undefined}
                onClick={() => run(a)}
                data-action={a.kind}
              >
                {act.isPending && act.variables === a.kind && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
                {t(`action.${a.kind}`)}
              </Button>
            ))}
            {actions[0].why && (
              <span className="text-xs text-muted-foreground" data-why={actions[0].why}>
                {t(`why.${actions[0].why}`)}
              </span>
            )}
          </div>
          {act.isError && (
            <div data-action-refused="">
              <ErrorBanner message={apiErrorMessage(act.error, t('failedAction'))} />
            </div>
          )}
        </div>
      )}
    </section>
  )
}

function BacktestLine({ standing, bt, loading }: { standing: ReturnType<typeof backtestStanding>; bt: GuardBacktest | null; loading: boolean }) {
  const { t } = useTranslation(NS)
  const run = (
    <Link to={SIMULATOR_PATH} className="text-primary hover:underline">
      {t('backtest.open')}
    </Link>
  )
  if (loading) return <>{t('backtest.loading')}</>
  if (!bt)
    return (
      <span className="inline-flex flex-wrap items-baseline gap-1">
        {t('backtest.none')} {run}
      </span>
    )
  return (
    <span className="inline-flex flex-wrap items-baseline gap-1">
      <span>{t(`backtest.${standing}`)}</span>
      {standing === 'running' && <Ltr>{`${backtestProgressPct(bt)}%`}</Ltr>}
      <span className="text-muted-foreground">{t('backtest.ofRevision')}</span>
      <Ltr>{bt.revision}</Ltr>
      {standing !== 'current' && standing !== 'running' && run}
    </span>
  )
}

// ── Shadow rules: figures, days, promote ───────────────────────────────────────────────────────

function ShadowSection({ doc, approver }: { doc: GuardRuleset; approver: boolean }) {
  const { t } = useTranslation(NS)
  const shadow = doc.rules.filter((r) => r.state === 'shadow')
  return (
    <section className="flex flex-col gap-2" data-shadow-section="">
      <div>
        <h2 className="text-base font-semibold tracking-tight">{t('shadow.title')}</h2>
        <p className="text-xs text-muted-foreground">{t('shadow.hint')}</p>
      </div>
      {shadow.length === 0 ? (
        <p className="rounded-md border border-border/60 py-4 text-center text-sm text-muted-foreground" data-shadow-empty="">
          {t('shadow.empty')}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {shadow.map((r) => (
            <ShadowRow key={r.id} rule={r} approver={approver} />
          ))}
        </ul>
      )}
    </section>
  )
}

function ShadowRow({ rule, approver }: { rule: GuardRule; approver: boolean }) {
  const { t, i18n } = useTranslation(NS)
  const queryClient = useQueryClient()
  const now = new Date()
  const [reason, setReason] = useState('')
  const gate = promoteGate({ rule, now, approver, skipReason: reason })
  const from = formatDay(rule.shadowSince) || toIsoDate(now)
  const figures = useQuery(shadowFiguresQuery(rule.id, from, toIsoDate(now)))
  const severity = ruleSeverity(rule)

  const promote = useMutation({
    mutationFn: () => approvalsApi.promote(rule.id, gate.needsReason ? reason.trim() : null),
    onSuccess: async () => {
      notify.success(t('shadow.promoted', { id: fsi(rule.id) }))
      await queryClient.invalidateQueries({ queryKey: GUARD_DRAFT_KEY })
      await queryClient.invalidateQueries({ queryKey: [...INSURANCE_RULES_KEY, 'guards', 'list'] })
    },
  })
  const onPromote = () => {
    if (!gate.can || promote.isPending) return
    promote.mutate()
  }

  return (
    <li className="flex flex-col gap-2 rounded-lg border border-border/60 bg-card p-3 text-sm" data-shadow-rule={rule.id}>
      <div className="flex flex-wrap items-center gap-2">
        <Link to={guardRulePath(rule.id)} className="hover:underline">
          <RuleId id={rule.id} />
        </Link>
        <bdi className="font-medium" data-rule-name="">
          {saysIn(rule.name, i18n.language)}
        </bdi>
        {severity && <GuardSeverityBadge severity={severity} />}
      </div>
      <dl className="flex flex-wrap gap-x-6 gap-y-1 text-muted-foreground">
        <div className="flex gap-1">
          <dt>{t('shadow.since')}</dt>
          <dd data-shadow-since="">
            {rule.shadowSince ? <Ltr>{formatDay(rule.shadowSince)}</Ltr> : t('shadow.unknown')}
          </dd>
        </div>
        <div className="flex gap-1">
          <dt>{t('shadow.days')}</dt>
          <dd data-shadow-days={gate.days ?? ''}>
            {gate.days === null ? t('shadow.unknown') : <Ltr>{gate.days}</Ltr>}
          </dd>
        </div>
        <div className="flex gap-1">
          <dt>{t('shadow.fires')}</dt>
          <dd data-shadow-fires={figures.data ? figures.data.shadowFires : figures.isPending ? 'loading' : 0}>
            {figures.isPending ? t('shadow.loadingFigures') : figures.isError ? t('shadow.noFigures') : <Ltr>{figures.data?.shadowFires ?? 0}</Ltr>}
          </dd>
        </div>
      </dl>
      {approver && (
        <div className="flex flex-col gap-1.5" data-promote-panel="">
          {gate.needsReason && (
            <Field label={t('shadow.skipReason')}>
              <Input dir="auto" value={reason} onChange={(e) => setReason(e.target.value)} className="w-full" data-skip-reason="" />
            </Field>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" aria-disabled={!gate.can || promote.isPending} onClick={onPromote} data-promote={rule.id}>
              {promote.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
              {t(gate.needsReason ? 'shadow.skip' : 'shadow.promote')}
            </Button>
            {gate.why && (
              <span className="text-xs text-muted-foreground" data-promote-why={gate.why}>
                {t(`shadow.why.${gate.why}`)}
              </span>
            )}
          </div>
          {promote.isError && (
            <div data-promote-refused="">
              <ErrorBanner message={apiErrorMessage(promote.error, t('failedAction'))} />
            </div>
          )}
        </div>
      )}
    </li>
  )
}

// ── Versions: who, when, note; restore as a new draft ──────────────────────────────────────────

function VersionsSection({ author }: { author: boolean }) {
  const { t } = useTranslation(NS)
  const versions = useQuery(versionsQuery())
  return (
    <section className="flex flex-col gap-2" data-versions="">
      <div>
        <h2 className="text-base font-semibold tracking-tight">{t('versions.title')}</h2>
        <p className="text-xs text-muted-foreground">{t('versions.hint')}</p>
      </div>
      {versions.isError ? (
        isBareDenial(versions.error) ? (
          <DeniedCard ns="insurance-approvals" hook="approvals-denied" />
        ) : (
          <ErrorBanner message={apiErrorMessage(versions.error, t('versions.failed'))} />
        )
      ) : !versions.data ? (
        <Loading text={t('versions.loading')} />
      ) : versions.data.length === 0 ? (
        <p className="text-sm text-muted-foreground" data-versions-empty="">
          {t('versions.empty')}
        </p>
      ) : (
        <table className="w-full text-sm">
          <thead className="text-xs text-muted-foreground">
            <tr className="border-b border-border/60">
              <th className="py-1.5 text-start font-medium">{t('versions.version')}</th>
              <th className="py-1.5 text-start font-medium">{t('versions.byAt')}</th>
              <th className="py-1.5 text-start font-medium">{t('versions.note')}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {versions.data.map((v) => (
              <VersionRow key={v.version} v={v} author={author} />
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}

function VersionRow({ v, author }: { v: RulesetVersion; author: boolean }) {
  const { t } = useTranslation(NS)
  const queryClient = useQueryClient()
  const restore = useMutation({
    mutationFn: () => approvalsApi.restore(v.version),
    onSuccess: async (doc) => {
      queryClient.setQueryData(GUARD_DRAFT_KEY, doc)
      notify.success(t('versions.restored', { version: fsi(v.version), revision: fsi(doc.revision) }))
      await queryClient.invalidateQueries({ queryKey: APPROVALS_KEY })
      await queryClient.invalidateQueries({ queryKey: GUARD_BACKTESTS_KEY })
      await queryClient.invalidateQueries({ queryKey: [...INSURANCE_RULES_KEY, 'guards', 'list'] })
    },
    onError: (err) => notify.apiError(t('versions.restoreFailed'), err, t('versions.restoreFailed')),
  })
  const onRestore = async () => {
    if (restore.isPending) return
    if (await confirmAction(t('versions.confirmBody', { version: fsi(v.version) }), t('versions.confirmTitle'))) restore.mutate()
  }
  return (
    <tr className="border-b border-border/40" data-version={v.version}>
      <td className="py-1.5" data-col="version">
        <Ltr>{v.version}</Ltr>
      </td>
      <td className="py-1.5" data-col="byAt">
        <ByAt by={v.by} at={v.at} />
      </td>
      <td className="py-1.5" data-col="note">
        {v.note ? <bdi>{v.note}</bdi> : <span className="text-muted-foreground">{t('versions.noNote')}</span>}
      </td>
      <td className="py-1.5 text-end">
        {author && (
          <Button variant="text" onClick={() => void onRestore()} aria-disabled={restore.isPending} data-restore={v.version}>
            {restore.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
            {t('versions.restore')}
          </Button>
        )}
      </td>
    </tr>
  )
}

// ── small parts ────────────────────────────────────────────────────────────────────────────────

