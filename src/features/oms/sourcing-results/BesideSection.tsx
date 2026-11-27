import { useQuery } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { Loader2, X } from 'lucide-react'
import { apiErrorMessage } from '@/core/api'
import ShareBar from '@/core/charts/ShareBar'
import { TRIAL_CHANGE_KINDS, type TrialSide } from '@/core/models/sourcing-results'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Ltr from '@/core/ui/Ltr'
import { formatCount, fsi } from '@/core/util/bidi'
import { sourcingResultsApi } from './api'
import Fig from './Fig'
import type { BesidePick } from './filters'
import { classInk } from './inks'
import { countText, percentText } from './text'
import { besideView } from './trials-model'

/** The classes a side's thin bar is drawn in, in the comparison's order. */
const BAR_CLASSES = ['SAME_PLAN', ...TRIAL_CHANGE_KINDS, 'OUTSIDE_RULES', 'NOT_COMPARABLE'] as const

/**
 * "Set beside it" (ticket 973, spec 4354 §18, BO 4283 decisions 12–15; BO 4394 `Trials/Beside`): the tried set read
 * beside the candidate set as two trials over the same orders. A banner naming the set, the thin second bar (the set
 * against what happened, by class in the whole plan), the plans that differ between the two sets, the estimate between
 * them, and the promise check under that set — "the real deliveries, as this set would have promised them". No riyal
 * figure; the words stay the comparison's: an estimate, never "better".
 */
export default function BesideSection({ pick, onClear }: { pick: NonNullable<BesidePick>; onClear: () => void }) {
  const { t } = useTranslation('sourcing-results')
  const read = useQuery({
    queryKey: ['sourcing-results', 'beside', pick.against, pick.beside],
    queryFn: () => sourcingResultsApi.beside(pick.against, pick.beside),
    retry: false,
  })

  const clear = (
    <Button variant="secondary" onClick={onClear} data-beside-clear="">
      <X className="h-3.5 w-3.5" aria-hidden />
      {t('beside.clear')}
    </Button>
  )
  if (read.isError)
    return (
      <section className="flex flex-col gap-2" data-results-beside="failed">
        <ErrorBanner title={t('beside.failedTitle')} message={apiErrorMessage(read.error, t('beside.failed'))} />
        <div>{clear}</div>
      </section>
    )
  if (!read.data)
    return (
      <p className="inline-flex items-center gap-2 text-sm text-muted-foreground" role="status">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        {t('beside.loading')}
      </p>
    )

  const view = besideView(read.data)
  const setName = t('filters.set', { name: fsi(view.set.name), version: fsi(view.set.version) })
  const candidateName = t('filters.set', { name: fsi(view.candidate.name), version: fsi(view.candidate.version) })
  const est = view.estimate
  const says = (m: number) =>
    m < 0 ? t('beside.says.earlier', { minutes: fsi(-m) }) : m > 0 ? t('beside.says.later', { minutes: fsi(m) }) : t('beside.says.same')

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4" data-results-beside="">
      <div
        className="flex flex-wrap items-start justify-between gap-3 rounded-md border border-attention-border bg-attention-050 px-3 py-2 text-sm text-attention-800"
        role="status"
        data-beside-banner=""
      >
        <p className="max-w-[90ch]">
          <Trans
            t={t}
            i18nKey={view.set.trialSet ? 'beside.bannerTrialSet' : 'beside.banner'}
            values={{ set: setName, candidate: candidateName }}
            components={{
              b: <b />,
              set: <bdi />,
              candidate: <bdi />,
              compared: <Fig value={countText(view.compared)} />,
              leftOut: <Fig value={countText(view.leftOut)} />,
            }}
          />
        </p>
        {clear}
      </div>

      <div className="grid gap-3 md:grid-cols-2" data-beside-bars="">
        <ThinBar title={candidateName} side={read.data.first} against={view.against.candidate} compared={view.compared} data="candidate" />
        <ThinBar title={setName} side={read.data.second} against={view.against.beside} compared={view.compared} data="beside" />
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-2 text-sm" data-beside-differ="">
          <h3 className="text-sm font-semibold">{t('beside.differTitle')}</h3>
          <p>
            <Trans
              t={t}
              i18nKey="beside.differ"
              components={{
                count: <Fig bold value={countText(view.differ.count)} />,
                percent: <Fig value={percentText(view.differ.share)} />,
                orders: <Fig value={countText(view.compared)} />,
              }}
            />
          </p>
          <ul className="flex flex-col gap-1 text-xs">
            {view.differ.kinds.map((k) => (
              <li key={k.kind} className="flex items-center justify-between gap-2 border-b border-border/60 pb-1" data-beside-kind={k.kind}>
                <span>{t(`classes.${k.kind}`, { defaultValue: fsi(k.kind) })}</span>
                <b>
                  <Ltr>{countText(k.count)}</Ltr>
                </b>
              </li>
            ))}
          </ul>
          <p className="text-xs" data-beside-estimate="">
            {est ? (
              <Trans
                t={t}
                i18nKey="beside.estimate"
                values={{ says: says(est.middle) }}
                components={{ low: <Fig value={String(est.low)} />, high: <Fig value={String(est.high)} /> }}
              />
            ) : (
              t('beside.noEstimate')
            )}
          </p>
          <p className="text-xs" data-beside-shipments="">
            <Trans
              t={t}
              i18nKey="beside.shipments"
              components={{ candidate: <Fig value={countText(view.shipments.candidate)} />, beside: <Fig value={countText(view.shipments.beside)} /> }}
            />
          </p>
          <p className="text-xs" data-beside-fee="">
            <Trans
              t={t}
              i18nKey="beside.listFee"
              components={{
                lower: <Fig value={countText(view.fee.lower)} />,
                same: <Fig value={countText(view.fee.same)} />,
                higher: <Fig value={countText(view.fee.higher)} />,
              }}
            />
          </p>
          {view.leftOutBy.length > 0 && (
            <p className="text-xs text-muted-foreground" data-beside-left-out="">
              {t('beside.leftOutBy')}{' '}
              {view.leftOutBy.map((x) => (
                <span key={x.reason} className="me-2 inline-flex gap-1">
                  {t(`trials.refusals.${x.reason}`, { defaultValue: t(`trials.leftOut.${x.reason}`, { defaultValue: fsi(x.reason) }) })}{' '}
                  <Ltr>{countText(x.count)}</Ltr>
                </span>
              ))}
            </p>
          )}
        </div>
        <div className="flex flex-col gap-2" data-beside-promise="">
          <h3 className="text-sm font-semibold">{t('beside.promiseTitle')}</h3>
          <ul className="flex flex-col gap-1 text-sm">
            {view.promise.map((p) => (
              <li key={p.mode} className="flex items-center justify-between gap-2 border-b border-border/60 pb-1" data-beside-promise-row={p.mode}>
                <span>{t(`modes.${p.mode}`)}</span>
                <span>
                  <b>{p.share == null ? t('dash') : <Ltr>{percentText(p.share)}</Ltr>}</b>{' '}
                  <span className="text-xs text-muted-foreground">
                    (<Ltr>{formatCount(countText(p.within), countText(p.checked))}</Ltr>)
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">{t('beside.note')}</p>
    </section>
  )
}

function ThinBar({
  title,
  side,
  against,
  compared,
  data,
}: {
  title: string
  side: TrialSide
  against: { samePlan: number; sameStores: number }
  compared: number
  data: string
}) {
  const { t } = useTranslation('sourcing-results')
  return (
    <div className="flex flex-col gap-1.5" data-beside-bar={data}>
      <p className="text-xs">
        <Trans
          t={t}
          i18nKey="beside.barSentence"
          values={{ set: title }}
          components={{
            set: <bdi />,
            b: <b />,
            plan: <Fig bold value={countText(against.samePlan)} />,
            stores: <Fig bold value={countText(against.sameStores)} />,
            orders: <Fig value={countText(compared)} />,
          }}
        />
      </p>
      <ShareBar
        segments={BAR_CLASSES.map((cls) => ({ id: cls, weight: side.wholeClasses[cls] ?? 0, colour: classInk(cls) }))}
        label={t('beside.barLabel', { set: title, plan: fsi(countText(against.samePlan)), orders: fsi(countText(compared)) })}
      />
    </div>
  )
}
