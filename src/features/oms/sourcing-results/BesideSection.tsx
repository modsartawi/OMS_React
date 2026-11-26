import { Trans, useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import ShareBar from '@/core/charts/ShareBar'
import type { ResultsBeside } from '@/core/models/sourcing-results'
import Button from '@/core/ui/Button'
import Ltr from '@/core/ui/Ltr'
import { formatRange, fsi } from '@/core/util/bidi'
import Fig from './Fig'
import { PromiseCheck } from './Panels'
import { countText, percentText } from './text'
import { besideView } from './trials-model'

/**
 * "Set beside it" (ticket 973, spec 4354 §18, BO 4283 decisions 12–15): the tried set read beside the candidate set as
 * two trials over the same orders. A banner naming the set, the thin second bar (the set against what happened), the
 * plans that differ between the two sets, and the promise check under that set — "the real deliveries, as this set
 * would have promised them". No riyal figure; the words stay the comparison's: an estimate, never "better".
 */
export default function BesideSection({ beside, onClear }: { beside: ResultsBeside; onClear: () => void }) {
  const { t } = useTranslation('sourcing-results')
  const view = besideView(beside)
  const setName = t(view.trialSet ? 'filters.setTrial' : 'filters.set', { name: fsi(view.set.name), version: fsi(view.set.version) })
  const est = view.estimate

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
            i18nKey={view.trialSet ? 'beside.bannerTrialSet' : 'beside.banner'}
            components={{
              b: <b />,
              set: <bdi />,
              period: <Fig value={formatRange(view.period.from, view.period.to)} />,
              leftOut: <Fig value={countText(view.leftOut)} />,
            }}
            values={{ set: setName }}
          />
        </p>
        <Button variant="secondary" onClick={onClear} data-beside-clear="">
          <X className="h-3.5 w-3.5" aria-hidden />
          {t('beside.clear')}
        </Button>
      </div>

      <div className="flex flex-col gap-1.5" data-beside-bar="">
        <p className="text-xs">
          <Trans
            t={t}
            i18nKey="beside.barSentence"
            components={{
              b: <b />,
              orders: <Fig value={countText(view.bar.sentence.orders)} />,
              stores: <Fig bold value={percentText(view.bar.sentence.storesPercent)} />,
              plan: <Fig bold value={percentText(view.bar.sentence.planPercent)} />,
            }}
          />
        </p>
        <ShareBar
          segments={view.bar.segments.map((s) => ({ id: s.segment, weight: s.count, colour: s.ink }))}
          label={t('beside.barLabel', {
            stores: fsi(percentText(view.bar.sentence.storesPercent)),
            plan: fsi(percentText(view.bar.sentence.planPercent)),
          })}
        />
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-2 text-sm" data-beside-differ="">
          <h3 className="text-sm font-semibold">{t('beside.differTitle')}</h3>
          <p>
            <Trans
              t={t}
              i18nKey="beside.differ"
              components={{
                count: <Fig bold value={countText(view.differ.share.count)} />,
                percent: <Fig value={percentText(view.differ.share.percent)} />,
                orders: <Fig value={countText(view.differ.orders)} />,
              }}
            />
          </p>
          <ul className="flex flex-col gap-1 text-xs">
            {view.differ.kinds.map((k) => (
              <li key={k.kind} className="flex items-center justify-between gap-2 border-b border-border/60 pb-1" data-beside-kind={k.kind}>
                <span>{t(`classes.${k.kind}`)}</span>
                <span>
                  <b>
                    <Ltr>{countText(k.count)}</Ltr>
                  </b>{' '}
                  <span className="text-muted-foreground">
                    (<Ltr>{percentText(k.percent)}</Ltr>)
                  </span>
                </span>
              </li>
            ))}
          </ul>
          <p className="text-xs" data-beside-estimate="">
            {est ? (
              <Trans
                t={t}
                i18nKey="beside.estimate"
                values={{ says: est.middle > 0 ? t('differ.says.earlier', { minutes: fsi(est.middle) }) : est.middle < 0 ? t('differ.says.later', { minutes: fsi(-est.middle) }) : t('differ.says.same') }}
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
                lower: <Fig value={percentText(view.listFee.lowerPercent)} />,
                same: <Fig value={percentText(view.listFee.samePercent)} />,
                higher: <Fig value={percentText(view.listFee.higherPercent)} />,
              }}
            />
          </p>
        </div>
        <div className="flex flex-col gap-2" data-beside-promise="">
          <h3 className="text-sm font-semibold">{t('beside.promiseTitle')}</h3>
          <PromiseCheck rows={beside.promise} drill={false} />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">{t('beside.note')}</p>
    </section>
  )
}
