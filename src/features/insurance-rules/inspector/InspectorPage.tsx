import { useState, type ReactNode } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router'

import { ApiError, apiErrorMessage, isBareDenial } from '@/core/api'
import { RuleId } from '@/core/insurance-rules/badges'
import { maskedKey } from '@/core/insurance-rules/backtest'
import { guardRulePath } from '@/core/insurance-rules/model'
import { DeniedCard, Loading, TD, TH } from '@/core/insurance-rules/parts'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Field from '@/core/ui/Field'
import Input from '@/core/ui/Input'
import Ltr from '@/core/ui/Ltr'
import StatusBadge from '@/core/ui/StatusBadge'
import type { Severity } from '@/core/ui/severity'
import { formatDateTime } from '@/core/util/date-format'
import { GUARD_LINE_OUTCOMES } from '@/core/insurance-rules/guard-check'
import { decisionQuery, inspectorApi } from './api'
import { factReading, messageReading, messageText, replayReading, type DecisionFact, type DecisionView, type MessageReading, type ReplayState } from './decision'

/**
 * Insurance rules ▸ Decision inspector — `/insurance-rules/decisions[/:decisionId]` (spec 3271 story 68, R4–R6, R10;
 * door 3298; oms ticket 710). Any decision of any age: its rule and version, each fact's key, path and typed value,
 * the replay, and on demand the message checked by hash. Opened from a Review row, or by its id here.
 */
export default function InspectorPage() {
  const { t } = useTranslation('insurance-inspector')
  const { decisionId } = useParams()
  return (
    <section className="flex h-full w-full flex-col gap-4" data-inspector-page="">
      <header className="max-w-3xl">
        <h1 className="text-lg font-semibold tracking-tight">{t('title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('lede')}</p>
      </header>
      <OpenById key={`open-${decisionId ?? ''}`} current={decisionId ?? ''} />
      {decisionId ? <Decision key={decisionId} id={decisionId} /> : null}
    </section>
  )
}

function OpenById({ current }: { current: string }) {
  const { t } = useTranslation('insurance-inspector')
  const navigate = useNavigate()
  const [id, setId] = useState(current)
  return (
    <form
      className="flex flex-wrap items-end gap-3"
      data-inspector-open=""
      onSubmit={(e) => {
        e.preventDefault()
        if (id.trim()) void navigate(`/insurance-rules/decisions/${encodeURIComponent(id.trim())}`)
      }}
    >
      <Field label={t('open.id')}>
        <Input dir="ltr" value={id} onChange={(e) => setId(e.target.value)} data-inspector-id="" />
      </Field>
      <Button type="submit" variant="primary" data-inspector-go="">
        {t('open.go')}
      </Button>
    </form>
  )
}

function Decision({ id }: { id: string }) {
  const { t } = useTranslation('insurance-inspector')
  const q = useQuery(decisionQuery(id))
  if (q.isError && isBareDenial(q.error)) return <DeniedCard ns="insurance-inspector" hook="inspector-denied" />
  if (q.isError && q.error instanceof ApiError && q.error.statusCode === 404) return <ErrorBanner className="p-3" message={t('notFound', { id })} />
  if (q.isError) return <ErrorBanner className="p-3" message={apiErrorMessage(q.error, t('failed'))} />
  if (!q.data) return <Loading text={t('loading')} />
  const d = q.data
  return (
    <div className="flex flex-col gap-4" data-decision={d.id}>
      <Summary d={d} />
      <Facts facts={d.facts ?? []} />
      <Replay d={d} />
      <Message d={d} />
    </div>
  )
}

function Row({ label, hook, children }: { label: string; hook: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5" data-summary={hook}>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  )
}

/** An outcome in the screen's words; one it does not know is shown as it came. */
function Outcome({ value }: { value: string }) {
  const { t } = useTranslation('insurance-inspector')
  return (GUARD_LINE_OUTCOMES as readonly string[]).includes(value) ? <>{t(`outcome.${value}`)}</> : <Ltr>{value}</Ltr>
}

function Summary({ d }: { d: DecisionView }) {
  const { t } = useTranslation('insurance-inspector')
  return (
    <dl className="grid grid-cols-2 gap-3 rounded-lg border border-border/60 bg-card p-4 md:grid-cols-4">
      <Row label={t('summary.rule')} hook="rule">
        {d.ruleId ? (
          <Link to={guardRulePath(d.ruleId)} className="text-primary hover:underline">
            <RuleId id={d.ruleId} />
          </Link>
        ) : (
          t('summary.noRule')
        )}
      </Row>
      <Row label={t('summary.version')} hook="version">
        {d.ruleVersion === null || d.ruleVersion === undefined ? t('summary.noVersion') : <Ltr>{String(d.ruleVersion)}</Ltr>}
      </Row>
      <Row label={t('summary.outcome')} hook="outcome">
        <Outcome value={d.outcome} />
      </Row>
      <Row label={t('summary.at')} hook="at">
        <Ltr>{formatDateTime(d.at)}</Ltr>
      </Row>
      <Row label={t('summary.store')} hook="store">
        <Ltr>{d.store}</Ltr>
      </Row>
      <Row label={t('summary.pharmacist')} hook="pharmacist">
        <Ltr>{d.pharmacist}</Ltr>
      </Row>
      <Row label={t('summary.patient')} hook="patient">
        <Ltr>{maskedKey(d.patient ?? '')}</Ltr>
      </Row>
      <Row label={t('summary.source')} hook="source">
        <Ltr>{d.sourceRef}</Ltr>
      </Row>
    </dl>
  )
}

function FactValue({ fact }: { fact: DecisionFact }) {
  const { t } = useTranslation('insurance-inspector')
  const r = factReading(fact)
  if (r.state !== 'value') return <span className={r.state === 'yes' || r.state === 'no' ? '' : 'text-muted-foreground'}>{t(`fact.${r.state}`)}</span>
  return r.isolate === 'ltr' ? <Ltr>{r.text}</Ltr> : <bdi>{r.text}</bdi>
}

function Facts({ facts }: { facts: DecisionFact[] }) {
  const { t } = useTranslation('insurance-inspector')
  return (
    <div className="flex flex-col gap-1">
      <h2 className="text-base font-semibold tracking-tight">{t('fact.title')}</h2>
      {facts.length === 0 ? (
        <p className="rounded-md border border-dashed border-border/60 p-4 text-sm text-muted-foreground" data-facts-none="">
          {t('fact.none')}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border/60 bg-card">
          <table className="w-full text-sm" data-facts="">
            <thead>
              <tr>
                <th className={TH}>{t('fact.key')}</th>
                <th className={TH}>{t('fact.path')}</th>
                <th className={TH}>{t('fact.value')}</th>
              </tr>
            </thead>
            <tbody>
              {facts.map((f) => (
                <tr key={f.key} className="border-t border-border/60" data-fact={f.key} data-fact-state={factReading(f).state}>
                  <td className={`${TD} font-mono`}>
                    <Ltr>{f.key}</Ltr>
                  </td>
                  <td className={`${TD} font-mono`}>
                    <Ltr>{f.path}</Ltr>
                  </td>
                  <td className={TD} data-col="value">
                    <FactValue fact={f} />
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

const REPLAY_SEV: Record<ReplayState, Severity> = { same: 'ok', different: 'warn', none: 'mute' }

function Replay({ d }: { d: DecisionView }) {
  const { t } = useTranslation('insurance-inspector')
  const r = replayReading(d.replay)
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border/60 bg-card p-4 text-sm" data-replay={r.state}>
      <span className="font-semibold">{t('replay.title')}</span>
      {r.outcome && <Outcome value={r.outcome} />}
      <StatusBadge sev={REPLAY_SEV[r.state]}>{t(`replay.${r.state}`)}</StatusBadge>
    </div>
  )
}

const CHECK_TONE: Record<MessageReading['check'], string> = {
  match: 'border-border/60 bg-card',
  differs: 'border-danger-border bg-danger-050 text-danger-800',
  notFound: 'border-attention-border bg-attention-050 text-attention-800',
}

function Message({ d }: { d: DecisionView }) {
  const { t } = useTranslation('insurance-inspector')
  // A mutation, not a query, and gone with the view: a re-fetched message is shown, never kept. Each Show is a new
  // read, which the door logs.
  const show = useMutation({ mutationFn: () => inspectorApi.message(d.id), gcTime: 0 })
  const reading = show.isSuccess ? messageReading(show.data) : null
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border/60 bg-card p-4" data-message="">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-base font-semibold tracking-tight">{t('message.title')}</h2>
        {reading?.body ? (
          <Button variant="text" className="ms-auto" onClick={() => show.reset()} data-message-hide="">
            {t('message.hide')}
          </Button>
        ) : (
          <Button variant="outlined" className="ms-auto" disabled={show.isPending} onClick={() => show.mutate()} data-message-show="">
            {show.isPending ? t('message.showing') : t('message.show')}
          </Button>
        )}
      </div>
      <p className="text-xs text-muted-foreground" data-message-kept={d.message?.kept ? 'kept' : 'purged'}>
        {t(d.message?.kept ? 'message.held' : 'message.purged')}
      </p>
      <p className="text-xs text-muted-foreground" data-message-stored="">
        {t('message.ref')} <Ltr>{d.message?.ref}</Ltr>
      </p>
      <p className="text-xs text-muted-foreground" data-message-hash="">
        {t('message.hash')} <Ltr>{d.message?.hash}</Ltr>
      </p>

      {show.isError && isBareDenial(show.error) ? (
        <DeniedCard ns="insurance-inspector" hook="message-denied" />
      ) : show.isError ? (
        <ErrorBanner className="p-3" message={apiErrorMessage(show.error, t('message.failed'))} />
      ) : reading ? (
        <>
          <p className={`rounded-md border p-3 text-sm ${CHECK_TONE[reading.check]}`} role="status" data-message-check={reading.words}>
            {t(`message.check.${reading.words}`)}
          </p>
          {reading.check === 'differs' && (
            <p className="text-xs text-muted-foreground" data-message-found-hash="">
              {t('message.foundHash')} <Ltr>{reading.foundHash ?? ''}</Ltr>
            </p>
          )}
          {reading.body !== null && (
            <pre dir="ltr" className="max-h-96 overflow-auto rounded-md border border-border/60 bg-muted/40 p-3 text-xs" data-message-body="">
              {messageText(reading.body)}
            </pre>
          )}
        </>
      ) : null}
    </div>
  )
}
