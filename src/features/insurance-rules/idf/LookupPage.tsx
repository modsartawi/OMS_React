import { useEffect, useState, type FormEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { Search } from 'lucide-react'

import { apiErrorMessage, isBareDenial } from '@/core/api'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Field from '@/core/ui/Field'
import Input from '@/core/ui/Input'
import Ltr from '@/core/ui/Ltr'
import { useUrlQuery } from '@/core/ui/use-url-query'
import { formatFigure } from '@/core/util/number-format'
import { DeniedCard, Loading, NUM, TD, TH } from '@/core/insurance-rules/parts'
import { lookupQuery, mastersQuery } from './api'
import { masterName } from './masters'
import { IDF_SKIP_REASONS, isLookupReady, lookupFromParams, lookupToParams, lookupView, type IdfLookupQuery, type IdfLookupView } from './lookup'

/**
 * Insurance rules ▸ IDF lookup — `/insurance-rules/idf/lookup` (BackOffice spec 3157, door 3168; oms ticket 625).
 * "Why this priority": for an item and a store — optionally the insurer (its customer id, e.g. `0001100336`), a
 * document type, a sub-document type and a Nphies claim type (3166) — the item and its IDF group, the deciding tier
 * and master with its version, the item's priority and "hard above N, reminder above M", any exception row that
 * applied, the tiers skipped before it with their reasons, and the ranked IDF group with each row's source tier; the
 * looked-up item's row is marked.
 *
 * The search lives in the URL, so a lookup can be shared; the form is a draft until "Look up". The answer names its
 * deciding master (3168); the masters list only fills in a name the answer leaves blank and the live version number.
 *
 * 🚩 UNGATED until 628: a bare 403 on the lookup is "You do not have access"; a business refusal (`IDF-00018` no item /
 * no store / unknown document type, `IDF-00019` unknown item) shows the server's message.
 */
export default function LookupPage() {
  const { t, i18n } = useTranslation('insurance-idf')
  const { query, update, changedFromOutside } = useUrlQuery(lookupFromParams, lookupToParams)
  const [draft, setDraft] = useState<IdfLookupQuery>(query)
  useEffect(() => {
    if (changedFromOutside()) setDraft(query)
  }, [query, changedFromOutside])

  const ready = isLookupReady(query)
  const answer = useQuery({ ...lookupQuery(query), enabled: ready })
  const masters = useQuery({ ...mastersQuery(), enabled: ready })

  const nameOf = (id: string) => {
    const m = masters.data?.find((x) => x.masterId === id)
    return m ? masterName(m, i18n.language) : null
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    update(() => ({ ...draft }))
  }
  const field = (k: keyof IdfLookupQuery, required: boolean, opts: { className?: string; placeholder?: string } = {}) => (
    <Field label={t(`lookup.fields.${k}`)}>
      <Input
        className={opts.className ?? 'w-40'}
        dir="ltr"
        value={draft[k]}
        required={required}
        placeholder={opts.placeholder}
        onChange={(e) => setDraft((d) => ({ ...d, [k]: e.target.value }))}
        data-lookup-field={k}
      />
    </Field>
  )

  return (
    <section className="flex h-full w-full flex-col gap-4" data-idf-lookup-page="">
      <header className="max-w-3xl">
        <h1 className="text-lg font-semibold tracking-tight">{t('lookup.title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('lookup.lede')}</p>
      </header>
      <form className="flex flex-wrap items-end gap-3" onSubmit={submit} data-idf-lookup-form="">
        {field('item', true)}
        {field('store', true)}
        {field('payer', false, { className: 'w-52', placeholder: t('lookup.payerPlaceholder') })}
        {field('documentType', false, { className: 'w-48' })}
        {field('subDocumentType', false, { className: 'w-48' })}
        {field('nphiesClaimType', false, { className: 'w-44' })}
        <Button type="submit" variant="primary" className="h-9" data-lookup-submit="">
          <Search className="h-3.5 w-3.5" aria-hidden />
          {t('lookup.submit')}
        </Button>
      </form>
      {!ready ? (
        <p className="text-sm text-muted-foreground" data-idf-lookup-hint="">
          {t('lookup.hint')}
        </p>
      ) : answer.isError && isBareDenial(answer.error) ? (
        <DeniedCard ns="insurance-idf" hook="idf-lookup-denied" />
      ) : answer.isError ? (
        <div data-idf-lookup-error="">
          <ErrorBanner className="p-3" message={apiErrorMessage(answer.error, t('lookup.failed'))} />
        </div>
      ) : !answer.data ? (
        <Loading text={t('lookup.loading')} />
      ) : (
        <Answer view={lookupView(answer.data, query, i18n.language, masters.data ?? [])} masterNameOf={nameOf} />
      )}
    </section>
  )
}

function Answer({ view, masterNameOf }: { view: IdfLookupView; masterNameOf: (id: string) => string | null }) {
  const { t } = useTranslation('insurance-idf')
  const tier = (k: string) => t(`lookup.tier.${k}`, { defaultValue: k })
  const ex = view.exception
  const exMaster = ex?.masterId ? (masterNameOf(ex.masterId) ?? ex.masterId) : null
  return (
    <div className="flex flex-col gap-4" data-idf-lookup-answer="" data-deciding-tier={view.decidingTier}>
      <div className="rounded-md border border-border/60 bg-card p-4 text-sm" data-lookup-decision="">
        <div className="mb-2 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-xs text-muted-foreground" data-lookup-item="">
          <span>
            <Trans t={t} i18nKey="lookup.itemTitle" values={{ item: view.item.itemNumber }} components={{ v: <Ltr /> }} />
            {view.item.description && (
              <span className="ms-2 text-foreground">
                <bdi>{view.item.description}</bdi>
              </span>
            )}
          </span>
          {view.item.idfNumber && (
            <span data-col="idfGroup">
              <Trans t={t} i18nKey="lookup.idfGroup" values={{ group: view.item.idfNumber }} components={{ v: <Ltr /> }} />
            </span>
          )}
          {view.insurerCustomerId && (
            <span data-col="insurer">
              <Trans t={t} i18nKey="lookup.insurer" values={{ insurer: view.insurerCustomerId }} components={{ v: <Ltr /> }} />
            </span>
          )}
        </div>
        <div className="text-xs font-medium text-muted-foreground">{t('lookup.decidedBy')}</div>
        <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="font-semibold" data-col="tier">
            {tier(view.decidingTier)}
          </span>
          {view.master ? (
            <>
              <span className="font-medium" data-col="master">
                {view.master.name ? <bdi>{view.master.name}</bdi> : <Ltr>{view.master.masterId}</Ltr>}
              </span>
              <span className="text-muted-foreground" data-col="kind">
                {t(`masters.kind.${view.master.kind}`, { defaultValue: view.master.kind })}
              </span>
              {view.master.version && (
                <span className="text-muted-foreground" data-col="version">
                  <Trans t={t} i18nKey="lookup.version" values={{ version: view.master.version }} components={{ v: <Ltr /> }} />
                </span>
              )}
            </>
          ) : (
            <span className="text-muted-foreground" data-col="general">
              {t('lookup.generalMaster')}
            </span>
          )}
        </div>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
          {view.priority != null && (
            <span data-col="priority">
              <Trans t={t} i18nKey="lookup.priority" values={{ priority: formatFigure(view.priority) }} components={{ v: <Ltr /> }} />
            </span>
          )}
          <span data-col="thresholds">
            <Trans t={t} i18nKey="masters.thresholds" values={{ hard: formatFigure(view.hard), reminder: formatFigure(view.reminder) }} components={{ v: <Ltr /> }} />
          </span>
        </div>
        {view.cashNeverForces && (
          <p className="mt-2 text-xs text-muted-foreground" data-lookup-cash="">
            {t('lookup.cash')}
          </p>
        )}
      </div>

      {ex && (
        <div className="rounded-md border border-border/60 bg-muted/40 p-3 text-sm" data-lookup-exception={ex.exceptionId}>
          <div className="text-xs font-medium text-muted-foreground">{t('lookup.exceptionTitle')}</div>
          <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span>{t(`exceptions.keyKind.${ex.keyKind}`, { defaultValue: ex.keyKind })}</span>
            <span className="font-medium">
              <Ltr>{ex.key}</Ltr>
            </span>
            <span>{t(`exceptions.handling.${ex.handling}`, { defaultValue: ex.handling })}</span>
            {exMaster && <bdi className="text-muted-foreground">{exMaster}</bdi>}
            <span className="text-xs text-muted-foreground">{t(ex.allStores ? 'exceptions.stores.all' : 'exceptions.stores.pilot')}</span>
          </div>
        </div>
      )}

      <div data-lookup-skipped="">
        <h2 className="mb-1 text-sm font-semibold">{t('lookup.skippedTitle')}</h2>
        {view.skipped.length === 0 ? (
          <p className="text-sm text-muted-foreground" data-lookup-skipped-none="">
            {t('lookup.skippedNone')}
          </p>
        ) : (
          <ol className="flex flex-col gap-1 text-sm">
            {view.skipped.map((s) => (
              <li key={s.tier} className="flex flex-wrap gap-x-2" data-tier={s.tier} data-reason={s.reasonCode ?? ''}>
                <span className="font-medium" data-col="tier">
                  {tier(s.tier)}
                </span>
                <span className="text-muted-foreground" data-col="reason">
                  {s.reason ? (
                    <bdi>{s.reason}</bdi>
                  ) : s.reasonCode && (IDF_SKIP_REASONS as readonly string[]).includes(s.reasonCode) ? (
                    t(`lookup.skipReason.${s.reasonCode}`)
                  ) : (
                    s.reasonCode && <Ltr>{s.reasonCode}</Ltr>
                  )}
                </span>
                {s.masterId && (
                  <span className="text-xs text-muted-foreground" data-col="skippedMaster">
                    {masterNameOf(s.masterId) ? <bdi>{masterNameOf(s.masterId)}</bdi> : <Trans t={t} i18nKey="lookup.skippedMaster" values={{ id: s.masterId }} components={{ v: <Ltr /> }} />}
                  </span>
                )}
              </li>
            ))}
          </ol>
        )}
      </div>

      <div>
        <h2 className="mb-1 text-sm font-semibold">{t('lookup.groupTitle')}</h2>
        <div className="overflow-x-auto rounded-md border border-border/60">
          <table className="w-full text-sm" data-lookup-group="">
            <thead className="bg-muted/50">
              <tr>
                <th className={TH}>{t('lookup.columns.item')}</th>
                <th className={TH}>{t('lookup.columns.description')}</th>
                <th className={`${TH} text-end`}>{t('lookup.columns.priority')}</th>
                <th className={TH}>{t('lookup.columns.sourceTier')}</th>
              </tr>
            </thead>
            <tbody>
              {view.group.map((r) => (
                <tr
                  key={r.itemNumber}
                  className={`border-t border-border/60 ${r.isLookedUp ? 'bg-primary/10 font-medium' : ''}`}
                  data-item={r.itemNumber}
                  {...(r.isLookedUp ? { 'data-looked-up': '', 'aria-current': 'true' as const } : {})}
                >
                  <td className={TD} data-col="item">
                    <Ltr>{r.itemNumber}</Ltr>
                    {r.isLookedUp && <span className="ms-2 text-xs text-primary">{t('lookup.lookedUp')}</span>}
                  </td>
                  <td className={TD} data-col="description">
                    <bdi>{r.description}</bdi>
                  </td>
                  <td className={NUM} data-col="priority">
                    <Ltr>{formatFigure(r.priority)}</Ltr>
                  </td>
                  <td className={TD} data-col="sourceTier">
                    {tier(r.sourceTier)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
