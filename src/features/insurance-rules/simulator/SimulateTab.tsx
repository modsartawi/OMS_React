import { useState, type ReactNode } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { Play, Plus, Trash2 } from 'lucide-react'

import { apiErrorMessage, isBareDenial } from '@/core/api'
import { guardDraftQuery } from '@/core/insurance-rules/api'
import { GuardSeverityBadge, RuleId } from '@/core/insurance-rules/badges'
import GuardSentenceView from '@/core/insurance-rules/GuardSentenceView'
import { guardRulePath, type Says } from '@/core/insurance-rules/model'
import { saysIn } from '@/core/rules/sentence'
import SaysBoth from '@/core/rules/SaysBoth'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Ltr from '@/core/ui/Ltr'
import { fsi } from '@/core/util/bidi'
import { simulatorApi } from './api'
import { INPUT, OutcomeBadge, TraceValueBadge } from './parts'
import {
  SIM_CHANNELS,
  emptyLine,
  emptySimForm,
  problemOf,
  simulateBody,
  type SimField,
  type SimForm,
  type SimLineForm,
  type SimLineResult,
  type SimProblem,
  type SimulateBody,
  type SimulateResult,
} from './simulate'
import { lineRules, type TracedRule, type TraceNode } from './trace'
import { DeniedCard, Loading, TD, TH } from '@/core/insurance-rules/parts'

type RequestField = 'store' | 'payer' | 'policy' | 'class' | 'patientKey'
const REQUEST_FIELDS: readonly RequestField[] = ['store', 'payer', 'policy', 'class', 'patientKey']
const LINE_FIELDS: readonly (keyof SimLineForm)[] = ['item', 'qty', 'unit', 'daysSupply', 'icd', 'price']

/**
 * Simulate (ticket 612): type one request and a patient key, run the guard DRAFT over it
 * (`POST InsuranceRules/Guards/Simulate`), read each line's outcome, the rules that fired and the trace of every
 * condition HQ read — true / false / unknown — laid onto the rule's own sentences. Writes nothing. The typed request
 * stays on the screen only (it holds a patient key, so never in the address).
 */
export default function SimulateTab() {
  const { t } = useTranslation('insurance-simulator')
  const [form, setForm] = useState<SimForm>(emptySimForm)
  const [problems, setProblems] = useState<SimProblem[]>([])
  const [asked, setAsked] = useState<SimulateBody | null>(null)
  const draft = useQuery(guardDraftQuery())
  const run = useMutation({ mutationFn: (body: SimulateBody) => simulatorApi.simulate(body) })

  const set = (patch: Partial<SimForm>) => setForm((f) => ({ ...f, ...patch }))
  const setLine = (i: number, patch: Partial<SimLineForm>) => setForm((f) => ({ ...f, lines: f.lines.map((l, j) => (j === i ? { ...l, ...patch } : l)) }))

  const submit = () => {
    const r = simulateBody(form)
    setProblems(r.problems)
    if (!r.body) return
    setAsked(r.body)
    run.mutate(r.body)
  }

  return (
    <div className="flex flex-col gap-4">
      <form
        className="flex flex-col gap-3 rounded-lg border border-border/60 bg-card p-4"
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
        noValidate
        data-sim-form=""
      >
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            {t('form.channel')}
            <select className={INPUT} value={form.channel} onChange={(e) => set({ channel: e.target.value as SimForm['channel'] })} data-field="channel">
              {SIM_CHANNELS.map((c) => (
                <option key={c} value={c}>
                  {t(`insurance-rules:sentence.channel.${c}`)}
                </option>
              ))}
            </select>
          </label>
          {REQUEST_FIELDS.map((f) => (
            <Field key={f} label={t(`form.${f}`)} problem={problemOf(problems, f as SimField)}>
              <input
                className={`${INPUT} font-mono`}
                dir="ltr"
                value={form[f]}
                onChange={(e) => set({ [f]: e.target.value })}
                placeholder={f === 'patientKey' ? t('form.patientKeyHint') : undefined}
                autoComplete="off"
                aria-invalid={!!problemOf(problems, f as SimField)}
                data-field={f}
              />
            </Field>
          ))}
        </div>

        <fieldset className="flex flex-col gap-2" data-sim-lines="">
          <legend className="mb-1 text-sm font-medium">{t('form.lines')}</legend>
          {problemOf(problems, 'lines') && <Problem p={problemOf(problems, 'lines')!} />}
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className={TH}>{t('form.line')}</th>
                {LINE_FIELDS.map((f) => (
                  <th key={f} className={TH}>
                    {t(`form.${f}`)}
                  </th>
                ))}
                <th className={TH}>
                  <span className="sr-only">{t('form.removeLine')}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {form.lines.map((l, i) => (
                <tr key={i} data-line={i + 1}>
                  <td className={`${TD} pt-3 text-muted-foreground`}>
                    <Ltr>{i + 1}</Ltr>
                  </td>
                  {LINE_FIELDS.map((f) => {
                    const p = f === 'icd' ? undefined : problemOf(problems, f as SimField, i + 1)
                    return (
                      <td key={f} className={TD}>
                        <input
                          className={`${INPUT} font-mono`}
                          dir="ltr"
                          value={l[f]}
                          onChange={(e) => setLine(i, { [f]: e.target.value })}
                          aria-label={t(`form.${f}`)}
                          placeholder={f === 'icd' ? t('form.icdHint') : undefined}
                          inputMode={f === 'qty' || f === 'daysSupply' ? 'numeric' : f === 'price' ? 'decimal' : undefined}
                          aria-invalid={!!p}
                          data-field={f}
                        />
                        {p && <Problem p={p} />}
                      </td>
                    )
                  })}
                  <td className={TD}>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setForm((f) => ({ ...f, lines: f.lines.filter((_, j) => j !== i) }))}
                      aria-label={t('form.removeLine')}
                      title={t('form.removeLine')}
                      data-remove-line=""
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outlined" onClick={() => setForm((f) => ({ ...f, lines: [...f.lines, emptyLine()] }))} data-add-line="">
              <Plus className="h-4 w-4" aria-hidden />
              {t('form.addLine')}
            </Button>
            <Button type="submit" variant="primary" className="ms-auto" disabled={run.isPending} data-run="">
              <Play className="h-4 w-4" aria-hidden />
              {run.isPending ? t('form.running') : t('form.run')}
            </Button>
          </div>
        </fieldset>
        {draft.data && (
          <p className="text-xs text-muted-foreground" data-draft-revision={draft.data.revision}>
            {t('form.draftRevision', { revision: fsi(draft.data.revision) })}
          </p>
        )}
      </form>

      {run.isError && isBareDenial(run.error) ? (
        <DeniedCard ns="insurance-simulator" hook="sim-denied" />
      ) : run.isError ? (
        <ErrorBanner className="p-3" message={apiErrorMessage(run.error, t('result.failed'))} />
      ) : run.isPending ? (
        <Loading text={t('form.running')} />
      ) : run.data && asked ? (
        <Result result={run.data} asked={asked} draft={draft.data ?? null} />
      ) : (
        <p className="rounded-md border border-dashed border-border/60 p-4 text-sm text-muted-foreground" data-sim-empty="">
          {t('result.empty')}
        </p>
      )}
    </div>
  )
}

function Field({ label, problem, children }: { label: string; problem?: SimProblem; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-xs text-muted-foreground">
      {label}
      {children}
      {problem && <Problem p={problem} />}
    </label>
  )
}

function Problem({ p }: { p: SimProblem }) {
  const { t } = useTranslation('insurance-simulator')
  return (
    <span className="text-xs text-danger-800" role="alert" data-problem={`${p.field}${p.line ? `:${p.line}` : ''}`}>
      {t(`form.problem.${p.problem}`)}
    </span>
  )
}

function Result({ result, asked, draft }: { result: SimulateResult; asked: SimulateBody; draft: Parameters<typeof lineRules>[1] }) {
  const { t } = useTranslation('insurance-simulator')
  return (
    <section className="flex flex-col gap-3" data-sim-result="">
      <h2 className="text-base font-semibold tracking-tight">{t('result.title')}</h2>
      {result.lines.map((line, i) => (
        <LineResult key={i} n={i + 1} item={asked.request.lines[i]?.item ?? ''} line={line} draft={draft} />
      ))}
    </section>
  )
}

function LineResult({ n, item, line, draft }: { n: number; item: string; line: SimLineResult; draft: Parameters<typeof lineRules>[1] }) {
  const { t } = useTranslation('insurance-simulator')
  const rules = lineRules(line, draft)
  return (
    <article className="flex flex-col gap-3 rounded-lg border border-border/60 bg-card p-4" data-result-line={n}>
      <header className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">{t('result.line', { n: fsi(n) })}</span>
        <code className="font-mono text-xs" data-result-item="">
          <Ltr>{item}</Ltr>
        </code>
        <OutcomeBadge outcome={line.outcome} />
      </header>
      {line.fired.length === 0 && (
        <p className="text-sm text-muted-foreground" data-none-fired="">
          {t('result.noneFired')}
        </p>
      )}
      {rules.map((r) => (
        <RuleTrace key={r.ruleId} r={r} />
      ))}
    </article>
  )
}

function RuleTrace({ r }: { r: TracedRule }) {
  const { t } = useTranslation('insurance-simulator')
  const f = r.fired
  return (
    <div className="flex flex-col gap-2 border-t border-border/60 pt-3" data-traced-rule={r.ruleId} data-fired={f ? f.severity : 'none'}>
      <div className="flex flex-wrap items-center gap-2">
        <Link to={guardRulePath(r.ruleId)} className="text-primary hover:underline" data-rule-link={r.ruleId}>
          <RuleId id={r.ruleId} />
        </Link>
        {r.rule && (
          <bdi className="text-sm font-medium" data-rule-name="">
            <RuleName name={r.rule.name} />
          </bdi>
        )}
        {f ? <GuardSeverityBadge severity={f.severity} /> : <span className="text-xs text-muted-foreground">{t('trace.readOnly')}</span>}
      </div>
      {f && (
        <div className="flex flex-col gap-1.5 text-sm" data-fired-detail="">
          <SaysBoth says={{ en: f.en, ar: f.ar }} />
          <dl className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {f.codes?.conflict && (
              <div className="flex gap-1">
                <dt>{t('result.codes.conflict')}</dt>
                <dd data-code="conflict">
                  <Ltr>{f.codes.conflict}</Ltr>
                </dd>
              </div>
            )}
            {f.codes?.nphies && (
              <div className="flex gap-1">
                <dt>{t('result.codes.nphies')}</dt>
                <dd data-code="nphies">
                  <Ltr>{f.codes.nphies}</Ltr>
                </dd>
              </div>
            )}
            {(['maxQuantity', 'maxDaysSupply'] as const).map((k) =>
              f.suggestion?.[k] !== undefined && f.suggestion?.[k] !== null ? (
                <div key={k} className="flex gap-1">
                  <dt>{t(`result.suggestion.${k}`)}</dt>
                  <dd data-suggestion={k}>
                    <Ltr>{String(f.suggestion[k])}</Ltr>
                  </dd>
                </div>
              ) : null,
            )}
          </dl>
        </div>
      )}
      {r.nodes.length > 0 && (
        <div>
          <div className="mb-1 text-xs font-medium text-muted-foreground">{t('trace.title')}</div>
          <TraceTree nodes={r.nodes} />
        </div>
      )}
      {r.loose.length > 0 && (
        <div data-trace-loose="">
          <div className="mb-1 text-xs text-muted-foreground">{r.rule ? t('trace.loose') : t('trace.notInDraft')}</div>
          <table className="text-xs">
            <tbody>
              {r.loose.map((e, i) => (
                <tr key={i} data-trace-path={e.blockPath}>
                  <td className={`${TD} font-mono`}>
                    <Ltr>{e.blockPath}</Ltr>
                  </td>
                  <td className={TD}>
                    <TraceValueBadge value={e.value} />
                  </td>
                  <td className={TD} data-why="">
                    <Why why={e.why ?? null} />
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

function RuleName({ name }: { name: Says }) {
  const { i18n } = useTranslation()
  return <>{saysIn(name, i18n.language)}</>
}

function TraceTree({ nodes, depth = 0 }: { nodes: readonly TraceNode[]; depth?: number }) {
  return (
    <ul className={depth ? 'ms-5 mt-1 flex flex-col gap-1 border-s border-border/60 ps-3' : 'flex flex-col gap-1'} data-trace-depth={depth}>
      {nodes.map((n) => (
        <li key={n.path} data-trace-path={n.path} data-check={n.check} data-not={n.not ? 'true' : 'false'}>
          <div className="flex flex-wrap items-baseline gap-2 text-sm">
            <TraceValueBadge value={n.value} />
            <span data-sentence="">
              <GuardSentenceView s={n.sentence} />
            </span>
            {n.why && (
              <span className="text-xs text-muted-foreground" data-why="">
                <Why why={n.why} />
              </span>
            )}
          </div>
          {n.children && <TraceTree nodes={n.children} depth={depth + 1} />}
        </li>
      ))}
    </ul>
  )
}

/** HQ's reason for a value: free text in either script. */
function Why({ why }: { why: Says | string | null }) {
  const { i18n } = useTranslation()
  if (!why) return null
  return <bdi>{typeof why === 'string' ? why : saysIn(why, i18n.language)}</bdi>
}
