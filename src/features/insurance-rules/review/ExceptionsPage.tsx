import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Loader2, Plus } from 'lucide-react'
import { apiErrorMessage, isBareDenial } from '@/core/api'
import { guardDraftQuery } from '@/core/insurance-rules/api'
import { RuleId } from '@/core/insurance-rules/badges'
import { saysIn } from '@/core/rules/sentence'
import { confirmAction } from '@/core/services/confirm'
import { notify } from '@/core/services/notify'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Ltr from '@/core/ui/Ltr'
import Modal from '@/core/ui/Modal'
import StatusBadge from '@/core/ui/StatusBadge'
import type { Severity } from '@/core/ui/severity'
import { formatPair, fsi } from '@/core/util/bidi'
import { formatDateTime, formatDay } from '@/core/util/date-format'
import { localToday } from '@/core/util/date-window'
import { EXCEPTIONS_KEY, reasonsQuery, reviewApi } from './api'
import {
  EMPTY_EXCEPTION_FORM,
  EXCEPTION_SCOPE_KINDS,
  exceptionBody,
  exceptionFormProblems,
  exceptionMaxUntil,
  exceptionStatus,
  scopeOf,
  type ExceptionForm,
  type ExceptionStatus,
} from './exception'
import { Code, DeniedCard, INPUT, ReasonText, TD, TH } from './shared'

/**
 * Insurance rules ▸ Exceptions — `/insurance-rules/exceptions` (BackOffice 3135, oms ticket 614). An
 * insurance-team user issues an HQ guard exception (patient key, one rule or every guard, item / same kind /
 * list, valid until at most 90 LOCAL days, reason, note), lists them, revokes one and reads its log of uses.
 *
 * 🚩 UNGATED: no access probe until 618 (the exception grant is the server's to refuse); a bare 403 on the
 * read is "You do not have access".
 */
export default function ExceptionsPage() {
  const { t } = useTranslation('insurance-review')
  const [issuing, setIssuing] = useState(false)
  return (
    <section className="flex h-full w-full flex-col gap-4" data-exceptions-page="">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-3xl">
          <h1 className="text-lg font-semibold tracking-tight">{t('exceptions.title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('exceptions.lede')}</p>
        </div>
        <Button variant="primary" onClick={() => setIssuing(true)} data-issue-open="">
          <Plus className="h-3.5 w-3.5" aria-hidden />
          {t('exceptions.issue')}
        </Button>
      </header>
      <Exceptions />
      {issuing && <IssueDialog onClose={() => setIssuing(false)} />}
    </section>
  )
}

const STATUS_SEV: Record<ExceptionStatus, Severity> = { active: 'ok', expired: 'mute', revoked: 'bad' }

function Exceptions() {
  const { t, i18n } = useTranslation('insurance-review')
  const qc = useQueryClient()
  const list = useQuery({ queryKey: EXCEPTIONS_KEY, queryFn: () => reviewApi.exceptions(), retry: false })
  const reasons = useQuery(reasonsQuery())
  const draft = useQuery(guardDraftQuery())
  const [logOf, setLogOf] = useState<string | null>(null)
  const today = localToday()
  const revoke = useMutation({
    mutationFn: (id: string) => reviewApi.revoke(id),
    onSuccess: () => {
      notify.success(t('exceptions.revoked'))
      void qc.invalidateQueries({ queryKey: EXCEPTIONS_KEY })
    },
    onError: (err) => notify.apiError(t('exceptions.revokeFailed'), err, t('exceptions.revokeFailed')),
  })
  const listName = (id: string) => draft.data?.lists.find((l) => l.id === id)?.name

  if (list.isError && isBareDenial(list.error)) return <DeniedCard hook="exceptions-denied" />
  if (list.isError) return <ErrorBanner className="p-3" message={apiErrorMessage(list.error, t('exceptions.failed'))} />
  if (!list.data) {
    return (
      <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground" role="status">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        {t('exceptions.loading')}
      </div>
    )
  }
  if (list.data.length === 0) {
    return (
      <p className="rounded-md border border-border/60 py-6 text-center text-sm text-muted-foreground" data-exceptions-empty="">
        {t('exceptions.empty')}
      </p>
    )
  }
  return (
    <div className="overflow-x-auto rounded-md border border-border/60">
      <table className="w-full text-sm" data-exceptions-table="">
        <thead className="border-b border-border/60 bg-muted/40">
          <tr>
            {(['id', 'patient', 'rule', 'scope', 'validUntil', 'reason', 'status', 'uses', 'issued', 'actions'] as const).map((c) => (
              <th key={c} className={TH}>
                {t(`exceptionColumns.${c}`)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {list.data.map((e) => {
            const status = exceptionStatus(e, today)
            const scope = scopeOf(e.scope)
            const name = scope.kind === 'list' ? listName(scope.value) : undefined
            return (
              <tr key={e.id} className="border-b border-border/40 last:border-b-0" data-exception-row={e.id} data-status={status}>
                <td className={TD}>
                  <Code value={e.id} hook="id" />
                </td>
                <td className={TD}>
                  <Code value={e.patientKey} hook="patient" />
                </td>
                <td className={TD} data-col="rule">
                  {e.ruleId ? <RuleId id={e.ruleId} /> : <span data-all-guards="">{t('exceptions.allGuards')}</span>}
                </td>
                <td className={TD} data-col="scope" data-scope={scope.kind}>
                  {t(`scope.${scope.kind}`)} <Code value={scope.value} hook="scope-value" />
                  {name && (
                    <bdi className="ms-1 text-muted-foreground" data-scope-name="">
                      {saysIn(name, i18n.language)}
                    </bdi>
                  )}
                </td>
                <td className={TD} data-col="validUntil">
                  <Ltr>{formatDay(e.validUntil)}</Ltr>
                </td>
                <td className={TD} data-col="reason">
                  <ReasonText code={e.reason} reasons={reasons.data?.reason} />
                  {e.note && (
                    <bdi className="block text-xs text-muted-foreground" data-note="">
                      {e.note}
                    </bdi>
                  )}
                </td>
                <td className={TD} data-col="status">
                  <StatusBadge sev={STATUS_SEV[status]}>{t(`status.${status}`)}</StatusBadge>
                </td>
                <td className={TD} data-col="uses">
                  {t('exceptions.uses', { count: e.uses })}
                </td>
                <td className={TD} data-col="issued">
                  <Ltr>{formatPair(e.issuedBy, formatDateTime(e.issuedAt))}</Ltr>
                </td>
                <td className={TD}>
                  <div className="flex gap-1">
                    <Button variant="outlined" onClick={() => setLogOf(e.id)} data-log-open="">
                      {t('exceptions.log')}
                    </Button>
                    {status === 'active' && (
                      <Button
                        variant="danger-outlined"
                        disabled={revoke.isPending}
                        data-revoke=""
                        onClick={async () => {
                          if (await confirmAction(t('exceptions.revokeBody'), t('exceptions.revokeTitle'))) revoke.mutate(e.id)
                        }}
                      >
                        {t('exceptions.revoke')}
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {logOf && <LogDialog id={logOf} onClose={() => setLogOf(null)} />}
    </div>
  )
}

function LogDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const { t } = useTranslation('insurance-review')
  const log = useQuery({ queryKey: [...EXCEPTIONS_KEY, id, 'log'], queryFn: () => reviewApi.log(id), retry: false })
  return (
    <Modal
      open
      onClose={onClose}
      width="44rem"
      title={t('log.title', { id: fsi(id) })}
      footer={
        <Button variant="text" onClick={onClose}>
          {t('log.close')}
        </Button>
      }
    >
      <div data-log-dialog={id}>
        {log.isError ? (
          <ErrorBanner message={apiErrorMessage(log.error, t('log.failed'))} />
        ) : !log.data ? (
          <p className="text-sm text-muted-foreground" role="status">
            {t('log.loading')}
          </p>
        ) : log.data.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('log.empty')}</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-border/60">
              <tr>
                {(['at', 'kind', 'by', 'store', 'rule', 'sourceRef'] as const).map((c) => (
                  <th key={c} className={TH}>
                    {t(`log.${c}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {log.data.map((entry, i) => (
                <tr key={i} className="border-b border-border/40 last:border-b-0" data-log-entry={entry.kind}>
                  <td className={TD}>
                    <Ltr>{formatDateTime(entry.at)}</Ltr>
                  </td>
                  <td className={TD}>{t(`log.${entry.kind}`)}</td>
                  <td className={TD}>
                    <Code value={entry.by} />
                  </td>
                  <td className={TD}>{entry.store && <Code value={entry.store} />}</td>
                  <td className={TD}>{entry.ruleId && <RuleId id={entry.ruleId} />}</td>
                  <td className={TD}>{entry.sourceRef && <Code value={entry.sourceRef} />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Modal>
  )
}

function IssueDialog({ onClose }: { onClose: () => void }) {
  const { t, i18n } = useTranslation('insurance-review')
  const qc = useQueryClient()
  const reasons = useQuery(reasonsQuery())
  const draft = useQuery(guardDraftQuery())
  const [form, setForm] = useState<ExceptionForm>(EMPTY_EXCEPTION_FORM)
  const [tried, setTried] = useState(false)
  const today = localToday()
  const max = exceptionMaxUntil(today)
  const problems = useMemo(() => exceptionFormProblems(form, today), [form, today])
  const set = <K extends keyof ExceptionForm>(key: K, value: ExceptionForm[K]) => setForm((f) => ({ ...f, [key]: value }))
  const issue = useMutation({
    mutationFn: () => reviewApi.issue(exceptionBody(form)),
    onSuccess: (made) => {
      notify.success(t('issue.issued', { id: fsi(made?.id ?? '') }))
      void qc.invalidateQueries({ queryKey: EXCEPTIONS_KEY })
      onClose()
    },
    onError: (err) => notify.apiError(t('issue.failed'), err, t('issue.failed')),
  })
  const problem = (field: keyof typeof problems) =>
    tried && problems[field] ? (
      <span className="text-xs text-danger-800" role="alert" data-problem={field}>
        {t(`problem.${problems[field]}`)}
      </span>
    ) : null
  const label = 'text-xs text-muted-foreground'

  return (
    <Modal
      open
      onClose={onClose}
      width="34rem"
      title={t('issue.title')}
      footer={
        <>
          <Button variant="text" onClick={onClose}>
            {t('issue.cancel')}
          </Button>
          <Button
            variant="primary"
            disabled={issue.isPending}
            data-issue-submit=""
            onClick={() => {
              setTried(true)
              if (Object.keys(problems).length === 0) issue.mutate()
            }}
          >
            {t('issue.submit')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3" data-issue-dialog="">
        <label className="flex flex-col gap-1">
          <span className={label}>{t('issue.patientKey')}</span>
          <input className={INPUT} dir="ltr" inputMode="numeric" placeholder={t('issue.patientKeyHint')} value={form.patientKey} onChange={(e) => set('patientKey', e.target.value)} data-field="patientKey" />
          {problem('patientKey')}
        </label>
        <label className="flex flex-col gap-1">
          <span className={label}>{t('issue.rule')}</span>
          <select className={INPUT} value={form.ruleId} onChange={(e) => set('ruleId', e.target.value)} data-field="ruleId">
            <option value="">{t('exceptions.allGuards')}</option>
            {(draft.data?.rules ?? []).map((r) => (
              <option key={r.id} value={r.id}>
                {fsi(formatPair(r.id, saysIn(r.name, i18n.language)))}
              </option>
            ))}
          </select>
        </label>
        <fieldset className="flex flex-col gap-1">
          <legend className={label}>{t('issue.scope')}</legend>
          <div className="flex flex-wrap gap-3" role="radiogroup">
            {EXCEPTION_SCOPE_KINDS.map((k) => (
              <label key={k} className="inline-flex items-center gap-1.5 text-sm">
                <input
                  type="radio"
                  name="scope"
                  value={k}
                  checked={form.scopeKind === k}
                  onChange={() => setForm((f) => ({ ...f, scopeKind: k, scopeValue: '' }))}
                  data-scope-kind={k}
                />
                {t(`scope.${k}`)}
              </label>
            ))}
          </div>
        </fieldset>
        <label className="flex flex-col gap-1">
          <span className={label}>{t(form.scopeKind === 'item' ? 'issue.item' : form.scopeKind === 'sameKind' ? 'issue.sameKindItem' : 'issue.list')}</span>
          {form.scopeKind === 'list' ? (
            <select className={INPUT} value={form.scopeValue} onChange={(e) => set('scopeValue', e.target.value)} data-field="scopeValue">
              <option value="">{t('issue.pickList')}</option>
              {(draft.data?.lists ?? []).map((l) => (
                <option key={l.id} value={l.id}>
                  {fsi(formatPair(l.id, saysIn(l.name, i18n.language)))}
                </option>
              ))}
            </select>
          ) : (
            <input className={INPUT} dir="ltr" value={form.scopeValue} onChange={(e) => set('scopeValue', e.target.value)} data-field="scopeValue" />
          )}
          {problem('scopeValue')}
        </label>
        <label className="flex flex-col gap-1">
          <span className={label}>{t('issue.validUntil')}</span>
          <input type="date" className={INPUT} min={today} max={max} value={form.validUntil} onChange={(e) => set('validUntil', e.target.value)} data-field="validUntil" />
          <span className="text-xs text-muted-foreground" data-valid-until-hint="">
            {t('issue.validUntilHint', { max: fsi(formatDay(max)) })}
          </span>
          {problem('validUntil')}
        </label>
        <label className="flex flex-col gap-1">
          <span className={label}>{t('issue.reason')}</span>
          <select className={INPUT} value={form.reason} onChange={(e) => set('reason', e.target.value)} data-field="reason">
            <option value="">{t('issue.pickReason')}</option>
            {(reasons.data?.reason ?? [])
              .filter((r) => r.active)
              .map((r) => (
                <option key={r.code} value={r.code}>
                  {fsi(formatPair(r.code, saysIn(r, i18n.language)))}
                </option>
              ))}
          </select>
          {problem('reason')}
        </label>
        <label className="flex flex-col gap-1">
          <span className={label}>{t('issue.note')}</span>
          <textarea className={`${INPUT} h-20 py-1`} dir="auto" value={form.note} onChange={(e) => set('note', e.target.value)} data-field="note" />
        </label>
      </div>
    </Modal>
  )
}
