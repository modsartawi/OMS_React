import { useId, useState, type ReactNode } from 'react'
import { useMutation, useQuery, type UseQueryResult } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { Loader2, Play, X } from 'lucide-react'
import { apiErrorMessage } from '@/core/api'
import type { RuleLookupItem, RuleSimRequest } from '@/core/models/rule-campaign'
import { ruleCampaignApi, ruleCampaignQuery, ruleLookupQuery } from '@/core/rules/api'
import { campaignPath, simulatorPath } from '@/core/rules/campaign-state'
import { RULE_INPUT } from '@/core/rules/LookupPicks'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Ltr from '@/core/ui/Ltr'
import { formatPair, fsi } from '@/core/util/bidi'
import { toIsoDate } from '@/core/util/date-format'
import type { BasketLine } from './basket'
import BasketEditor from './BasketEditor'
import SimResults from './SimResults'
import { simRequest } from './sim-result'

const pad = (n: number) => String(n).padStart(2, '0')

/**
 * Campaigns ▸ Simulator (ticket 514, BackOffice spec 2737): a dry run of the rule engine. The
 * basket is typed or comes from a CSV; the sale has a store, an optional member, a channel and a
 * LOCAL date and time; campaigns run live, or as every working copy, or one campaign's working copy
 * (`?draft=<id>`, the dashboard's "Simulate the working copy"). **Run** asks HQ's dry run
 * (`RuleCampaign/Simulate`, PROVISIONAL) and shows its effects per line and on the sale, a trace per
 * campaign and the near misses. Distinct from Pricing's bonus-buy Simulation: that is the other
 * engine.
 *
 * No access probe yet (BackOffice 2759 seeds the roles): the door fails closed on the server.
 */
export default function SimulatorPage() {
  const { t } = useTranslation('rule-simulator')
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const draftId = params.get('draft') || null

  const [basket, setBasket] = useState<BasketLine[]>([])
  const [store, setStore] = useState('')
  const [channel, setChannel] = useState<string | null>(null)
  const [memberId, setMemberId] = useState('')
  const [now] = useState(() => new Date())
  const [date, setDate] = useState(() => toIsoDate(now))
  const [time, setTime] = useState(() => `${pad(now.getHours())}:${pad(now.getMinutes())}`)
  const [includeDrafts, setIncludeDrafts] = useState(false)

  const stores = useQuery(ruleLookupQuery('stores', ''))
  const channels = useQuery(ruleLookupQuery('channels', ''))
  const chosen = useQuery({ ...ruleCampaignQuery(draftId ?? ''), enabled: !!draftId })
  const draft = draftId ? chosen.data : undefined
  // Until the reader picks one, the channel is the first HQ lists.
  const channelValue = channel ?? channels.data?.[0]?.code ?? ''

  const request = simRequest({ basket, store, memberId, channel: channelValue, date, time, includeDrafts, draftId })
  const run = useMutation({
    mutationFn: (body: RuleSimRequest) => ruleCampaignApi.simulate(body),
  })
  const stale = !!run.data && !!run.variables && JSON.stringify(run.variables) !== JSON.stringify(request)

  return (
    <section className="flex w-full max-w-7xl flex-col gap-4" data-simulator="">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-3xl">
          <h1 className="text-lg font-semibold tracking-tight">{t('title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('lede')}</p>
        </div>
        <Button variant="primary" disabled={!request || run.isPending} onClick={() => request && run.mutate(request)} data-sim-run="">
          {run.isPending ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Play className="size-3.5" aria-hidden />}
          {run.isPending ? t('run.running') : t('run.action')}
        </Button>
      </header>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
        <div className="flex flex-col gap-4">
          <section className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4" data-sim-sale="">
            <h2 className="text-sm font-semibold">{t('sale.title')}</h2>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t('sale.store')}>
                {(id) => (
                  <LookupSelect id={id} kind="stores" query={stores} value={store} onChange={setStore} placeholder={t('sale.chooseStore')} data="store" />
                )}
              </Field>
              <Field label={t('sale.channel')}>
                {(id) => <LookupSelect id={id} kind="channels" query={channels} value={channelValue} onChange={setChannel} data="channel" />}
              </Field>
              <Field label={t('sale.date')}>
                {(id) => <input id={id} type="date" className={RULE_INPUT} value={date} onChange={(e) => setDate(e.target.value)} data-sim-field="date" />}
              </Field>
              <Field label={t('sale.time')}>
                {(id) => <input id={id} type="time" className={RULE_INPUT} value={time} onChange={(e) => setTime(e.target.value)} data-sim-field="time" />}
              </Field>
              <div className="col-span-2">
                <Field label={t('sale.member')} hint={t('sale.memberHint')}>
                  {(id) => (
                    <input
                      id={id}
                      dir="ltr"
                      className={`${RULE_INPUT} w-full font-mono`}
                      value={memberId}
                      onChange={(e) => setMemberId(e.target.value)}
                      data-sim-field="member"
                    />
                  )}
                </Field>
              </div>
            </div>
            {draftId && (
              <div className="flex flex-col gap-1 rounded-md border border-primary-border bg-primary-050 px-3 py-2 text-xs" data-sim-draft={draftId}>
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{t('sale.draft')}</span>
                  <Link to={campaignPath(draftId)} className="font-mono text-primary hover:underline">
                    <Ltr>{draft?.code ?? draftId}</Ltr>
                  </Link>
                  <button
                    type="button"
                    className="ms-auto inline-flex items-center gap-1 rounded px-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                    onClick={() => navigate(simulatorPath(), { replace: true })}
                    data-sim-drop-draft=""
                  >
                    <X className="size-3" aria-hidden />
                    {t('sale.dropDraft')}
                  </button>
                </span>
                {draft && (
                  <span className="flex flex-col" data-sim-draft-name="">
                    <bdi lang="en">{draft.name.en}</bdi>
                    <bdi dir="rtl" lang="ar">
                      {draft.name.ar}
                    </bdi>
                  </span>
                )}
                {chosen.isError && (
                  <span className="text-danger-800" data-sim-draft-error="">
                    {apiErrorMessage(chosen.error, t('sale.draftUnread'))}
                  </span>
                )}
                <span className="text-muted-foreground">{t('sale.draftHint')}</span>
              </div>
            )}
            <label className="inline-flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={includeDrafts && !draftId}
                disabled={!!draftId}
                onChange={(e) => setIncludeDrafts(e.target.checked)}
                data-sim-field="includeDrafts"
              />
              {t('sale.includeDrafts')}
            </label>
            {draftId && <span className="text-[11px] text-muted-foreground">{t('sale.draftExcludes')}</span>}
          </section>

          <BasketEditor basket={basket} onChange={setBasket} />
        </div>

        <div className="flex flex-col gap-3">
          {!request && (
            <p className="text-xs text-muted-foreground" data-sim-needs="">
              {t('run.needs')}
            </p>
          )}
          {run.isError && <ErrorBanner title={t('run.failed')} message={apiErrorMessage(run.error, t('run.failed'))} className="px-3 py-2" />}
          {stale && (
            <p className="rounded-md border border-attention-border bg-attention-050 px-3 py-2 text-xs text-attention-800" data-sim-stale="">
              {t('run.stale')}
            </p>
          )}
          {run.data ? (
            <SimResults result={run.data} />
          ) : (
            !run.isError && (
              <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground" data-sim-no-result="">
                {t('result.none')}
              </p>
            )
          )}
        </div>
      </div>
    </section>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: (id: string) => ReactNode }) {
  const id = useId()
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <label htmlFor={id} className="text-xs font-medium text-muted-foreground">
        {label}
      </label>
      {children(id)}
      {hint && <span className="text-[11px] text-muted-foreground">{hint}</span>}
    </div>
  )
}

/** A store or a channel, from HQ's lookup; a failed read says so under the field. */
function LookupSelect({
  id,
  kind,
  query,
  value,
  onChange,
  placeholder,
  data,
}: {
  id: string
  kind: 'stores' | 'channels'
  query: UseQueryResult<RuleLookupItem[]>
  value: string
  onChange: (code: string) => void
  placeholder?: string
  data: string
}) {
  const { t } = useTranslation('rule-simulator')
  return (
    <>
      <select id={id} className={RULE_INPUT} value={value} onChange={(e) => onChange(e.target.value)} data-sim-field={data}>
        {placeholder && <option value="">{placeholder}</option>}
        {(query.data ?? []).map((x) => (
          <option key={x.code} value={x.code}>
            {fsi(formatPair(x.code, x.name))}
          </option>
        ))}
      </select>
      {query.isError && (
        <span className="text-[11px] text-danger-800">
          {apiErrorMessage(query.error, t(`sale.${kind}Failed`))}
        </span>
      )}
    </>
  )
}
