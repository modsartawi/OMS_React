import { useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { Loader2, Play, X } from 'lucide-react'
import { apiErrorCode, apiErrorDetails, apiErrorMessage, isBareDenial } from '@/core/api'
import type { RuleSimulateRequest } from '@/core/models/rule-campaign'
import { ruleCampaignApi, ruleCampaignQuery, ruleDraftsQuery, ruleLookupQuery, ruleOrderQuery } from '@/core/rules/api'
import { campaignPath, simulatorPath } from '@/core/rules/campaign-state'
import { AUDIENCE_CHANNELS, AUDIENCE_COUNTRIES, lookupName } from '@/core/rules/lookups'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Field from '@/core/ui/Field'
import Input from '@/core/ui/Input'
import Ltr from '@/core/ui/Ltr'
import Select from '@/core/ui/Select'
import { formatPair, fsi } from '@/core/util/bidi'
import { toIsoDate } from '@/core/util/date-format'
import type { BasketLine } from './basket'
import BasketEditor from './BasketEditor'
import SimResults from './SimResults'
import { draftTarget, needsDraft, parsePoints, refusalLines, saleMoney, simRequest } from './sim-result'

const pad = (n: number) => String(n).padStart(2, '0')

/** HQ's refusal of a campaign its checker rejects: the details point at its blocks. */
const INVALID_CAMPAIGN = 'RULES_INVALID_CAMPAIGN'

/**
 * Campaigns ▸ Simulator (tickets 514, 525, BackOffice spec 2737): a dry run of the rule engine. The
 * basket is typed (with the unit prices the author gives) or is a CSV file HQ reads; the sale has a
 * store, a country, a channel, an optional member, coupons and points, and a LOCAL date and time.
 * Campaigns run as the newest version publishes them, or one campaign as its saved draft
 * (`?draft=<id>`, the dashboard's "Simulate the working copy"). **Run** asks HQ's dry run
 * (`Rules/Authoring/Simulate`) and shows its effects per line and on the sale, the trace per
 * campaign and the near misses. Distinct from Pricing's bonus-buy Simulation: that is the other
 * engine.
 *
 * No access probe (BackOffice 2759 seeds the roles): a missing grant is a bare 403 on Run.
 */
export default function SimulatorPage() {
  const { t, i18n } = useTranslation('rule-simulator')
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const draftId = params.get('draft') || null

  const [basket, setBasket] = useState<BasketLine[]>([])
  const [file, setFile] = useState<string | null>(null)
  const [store, setStore] = useState('')
  const [country, setCountry] = useState(AUDIENCE_COUNTRIES[0])
  const [channel, setChannel] = useState(AUDIENCE_CHANNELS[0])
  const [memberId, setMemberId] = useState('')
  const [earning, setEarning] = useState(true)
  const [firstPurchase, setFirstPurchase] = useState(false)
  const [coupons, setCoupons] = useState('')
  const [points, setPoints] = useState('')
  const [flags, setFlags] = useState<string[]>([])
  const [now] = useState(() => new Date())
  const [date, setDate] = useState(() => toIsoDate(now))
  const [time, setTime] = useState(() => `${pad(now.getHours())}:${pad(now.getMinutes())}`)

  const stores = useQuery(ruleLookupQuery('stores', ''))
  const chosen = useQuery({ ...ruleCampaignQuery(draftId ?? ''), enabled: !!draftId })
  // Nothing published and no draft named: HQ refuses the run, so ask for a draft up front.
  const order = useQuery({ ...ruleOrderQuery(), enabled: !draftId })
  const noLive = needsDraft(draftId, order.data?.versionNo)
  const drafts = useQuery({ ...ruleDraftsQuery(), enabled: noLive })
  const loaded = draftId ? chosen.data : undefined
  const target = draftTarget(draftId, loaded)
  const money = saleMoney(country)

  const form = { basket, file, store, country, channel, memberId, earning, firstPurchase, coupons, points, flags, date, time, draft: target.draft }
  const request = target.ready && !noLive ? simRequest(form) : null
  const run = useMutation({
    mutationFn: (body: RuleSimulateRequest) => ruleCampaignApi.simulate(body),
  })
  const stale = !!run.data && !!run.variables && JSON.stringify(run.variables) !== JSON.stringify(request)
  // The store's engine as HQ holds it (the stores lookup's `detail`): a dry run runs at any store.
  const ranAt = run.variables?.storeCode
  const bonusBuy = !!ranAt && stores.data?.find((s) => s.code === ranAt)?.detail === 'BonusBuy'
  const names = useMemo(() => new Map(basket.map((l) => [l.sku, l.name])), [basket])
  const flag = (f: string, yes: boolean) => setFlags((all) => (yes ? [...new Set([...all, f])] : all.filter((x) => x !== f)))

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

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,28rem)_minmax(0,1fr)]">
        <div className="flex flex-col gap-4">
          <section className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4" data-sim-sale="">
            <h2 className="text-sm font-semibold">{t('sale.title')}</h2>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Field label={t('sale.store')}>
                  <Select className="w-full" value={store} onChange={(e) => setStore(e.target.value)} data-sim-field="store">
                    <option value="">{t('sale.chooseStore')}</option>
                    {(stores.data ?? []).map((x) => (
                      <option key={x.code} value={x.code}>
                        {fsi(formatPair(x.code, lookupName(x, i18n.language)))}
                      </option>
                    ))}
                  </Select>
                  {stores.isError && (
                    <span className="text-[11px] text-danger-800">
                      <bdi>{isBareDenial(stores.error) ? t('run.denied') : apiErrorMessage(stores.error, t('sale.storesFailed'))}</bdi>
                    </span>
                  )}
                </Field>
              </div>
              <Field label={t('sale.country')}>
                <Select value={country} onChange={(e) => setCountry(e.target.value)} data-sim-field="country">
                  {AUDIENCE_COUNTRIES.map((c) => (
                    <option key={c} value={c}>
                      {fsi(formatPair(c, saleMoney(c)?.currency ?? ''))}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={t('sale.channel')}>
                <Select value={channel} onChange={(e) => setChannel(e.target.value)} data-sim-field="channel">
                  {AUDIENCE_CHANNELS.map((c) => (
                    <option key={c} value={c}>
                      {fsi(c)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={t('sale.date')}>
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} data-sim-field="date" />
              </Field>
              <Field label={t('sale.time')}>
                <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} data-sim-field="time" />
              </Field>
              <div className="col-span-2">
                <Field label={t('sale.member')} hint={t('sale.memberHint')}>
                  <Input dir="ltr" className="w-full font-mono" value={memberId} onChange={(e) => setMemberId(e.target.value)} data-sim-field="member" />
                </Field>
              </div>
              <label className="col-span-2 inline-flex items-center gap-2 text-xs">
                <input type="checkbox" checked={earning} onChange={(e) => setEarning(e.target.checked)} data-sim-field="earning" />
                {t('sale.earning')}
              </label>
              <label className="col-span-2 inline-flex items-center gap-2 text-xs">
                <input type="checkbox" checked={firstPurchase} onChange={(e) => setFirstPurchase(e.target.checked)} data-sim-field="firstPurchase" />
                {t('sale.firstPurchase')}
              </label>
              <Field label={t('sale.coupons')} hint={t('sale.couponsHint')}>
                <Input dir="ltr" className="font-mono" value={coupons} onChange={(e) => setCoupons(e.target.value)} data-sim-field="coupons" />
              </Field>
              <Field label={t('sale.points')} hint={parsePoints(points) === null ? t('sale.pointsBad') : t('sale.pointsHint')}>
                <Input
                  dir="ltr"
                  inputMode="numeric"
                  aria-invalid={parsePoints(points) === null}
                  value={points}
                  onChange={(e) => setPoints(e.target.value)}
                  data-sim-field="points"
                />
              </Field>
            </div>
            {noLive && (
              <div className="flex flex-col gap-1.5 rounded-md border border-attention-border bg-attention-050 px-3 py-2 text-xs text-attention-800" data-sim-no-live="">
                <span>{t('sale.nothingLive')}</span>
                <Select
                  aria-label={t('sale.pickDraft')}
                  className="w-full"
                  value=""
                  onChange={(e) => e.target.value && navigate(simulatorPath(e.target.value), { replace: true })}
                  disabled={!drafts.data?.length}
                  data-sim-pick-draft=""
                >
                  <option value="">{drafts.isPending ? t('sale.draftsLoading') : drafts.data?.length ? t('sale.pickDraft') : t('sale.noDrafts')}</option>
                  {(drafts.data ?? []).map((x) => (
                    <option key={x.campaign} value={x.campaign}>
                      {fsi(formatPair(x.campaign, (i18n.language === 'ar' && x.name.ar) || x.name.en))}
                    </option>
                  ))}
                </Select>
              </div>
            )}
            {draftId && (
              <div className="flex flex-col gap-1 rounded-md border border-primary-border bg-primary-050 px-3 py-2 text-xs" data-sim-draft={draftId} data-sim-draft-sent={target.draft ?? ''}>
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{t('sale.draft')}</span>
                  <Link to={campaignPath(draftId)} className="font-mono text-primary hover:underline">
                    <Ltr>{loaded?.code ?? draftId}</Ltr>
                  </Link>
                  <button
                    type="button"
                    className="ms-auto inline-flex items-center gap-1 rounded-md px-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                    onClick={() => navigate(simulatorPath(), { replace: true })}
                    data-sim-drop-draft=""
                  >
                    <X className="size-3" aria-hidden />
                    {t('sale.dropDraft')}
                  </button>
                </span>
                {loaded && (
                  <span className="flex flex-col" data-sim-draft-name="">
                    <bdi lang="en">{loaded.name.en}</bdi>
                    <bdi dir="rtl" lang="ar">
                      {loaded.name.ar}
                    </bdi>
                  </span>
                )}
                {chosen.isError && (
                  <span className="text-danger-800" data-sim-draft-error="">
                    <bdi>{isBareDenial(chosen.error) ? t('run.denied') : apiErrorMessage(chosen.error, t('sale.draftUnread'))}</bdi>
                  </span>
                )}
                {loaded && <span className="text-muted-foreground">{target.draft ? t('sale.draftHint') : t('sale.noDraft')}</span>}
              </div>
            )}
          </section>

          <BasketEditor basket={basket} onChange={setBasket} file={file} onFile={setFile} currency={money?.currency ?? null} decimals={money?.decimals ?? 2} />
        </div>

        <div className="flex flex-col gap-3">
          {!request && (
            <p className="text-xs text-muted-foreground" data-sim-needs="">
              {noLive ? t('run.needsLiveOrDraft') : draftId && chosen.isError ? t('run.needsDraft') : t('run.needs')}
            </p>
          )}
          {run.isError && <RunRefusal error={run.error} draft={run.variables?.draft ?? null} />}
          {stale && (
            <p className="rounded-md border border-attention-border bg-attention-050 px-3 py-2 text-xs text-attention-800" data-sim-stale="">
              {t('run.stale')}
            </p>
          )}
          {run.data && bonusBuy && (
            <p className="rounded-md border border-attention-border bg-attention-050 px-3 py-2 text-xs text-attention-800" data-sim-bonus-buy="">
              {t('result.bonusBuy')}
            </p>
          )}
          {run.data ? (
            <SimResults result={run.data} names={names} flags={flags} onFlag={flag} />
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

/**
 * HQ's refusal of a run: its message and code, and its detail lines — a checker's refusal
 * (`RULES_INVALID_CAMPAIGN`) one per block, where → what, with its path, the way the builder's
 * checks pill lists them; a bad file (`RULES_BAD_BASKET`) one per file line. A bare 403 is the
 * missing grant, in our words.
 */
function RunRefusal({ error, draft }: { error: unknown; draft: string | null }) {
  const { t } = useTranslation('rule-simulator')
  const code = apiErrorCode(error)
  const lines = refusalLines(apiErrorDetails(error))
  return (
    <ErrorBanner className="px-3 py-2" title={t('run.failed')} message={isBareDenial(error) ? t('run.denied') : apiErrorMessage(error, t('run.failed'))}>
      {code && (
        <p className="mt-1 text-xs" data-sim-refusal-code={code}>
          {t('run.code')}{' '}
          <span className="font-mono">
            <Ltr>{code}</Ltr>
          </span>
        </p>
      )}
      {lines.length > 0 && (
        <ul className="mt-2 flex flex-col gap-1.5 text-xs" data-sim-refusal-lines="">
          {lines.map((l, i) => (
            <li key={i} className="flex flex-col" data-sim-refusal-line={l.path ?? l.where ?? ''}>
              {l.where && (
                <span className="text-muted-foreground" data-sim-refusal-where="">
                  <bdi>{l.where}</bdi>
                </span>
              )}
              <bdi>{l.message}</bdi>
              {l.path && (
                <code className="font-mono text-[11px] text-muted-foreground">
                  <Ltr>{l.path}</Ltr>
                </code>
              )}
            </li>
          ))}
        </ul>
      )}
      {code === INVALID_CAMPAIGN && draft && (
        <Link to={campaignPath(draft)} className="mt-2 inline-block text-xs text-primary hover:underline" data-sim-refusal-open="">
          {t('run.openCampaign')}
        </Link>
      )}
    </ErrorBanner>
  )
}

