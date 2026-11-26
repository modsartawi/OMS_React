import type { AdvisePin, AdviseWeightSetUsed } from '@/core/models/sourcing-run'
import Ltr from '@/core/ui/Ltr'
import { Trans } from 'react-i18next'
import type { PinsClash } from './pins-model'
import type { RunBasis } from './replan-model'
import { usePinWords } from './use-pin-words'

const ATTENTION = 'flex flex-col gap-1 rounded-md border border-attention-border bg-attention-050 px-3 py-2 text-xs text-attention-800'
const NOTE = 'rounded-md border border-border bg-card px-3 py-2 text-xs'

/**
 * What a run stands on (ticket 963, spec 4354 §10 and §11): the banner on a trial set, a draft's "unsaved, from {set}
 * version {n}", "figures as read at {time}, from run {number}" when it planned again on the same figures, the change that
 * was read afresh (`READ_AFRESH`, with the server's why), the held copy that was gone so the cart ran again, and the pins
 * that leave no plan, named in one banner.
 */
export default function RunBasisNotes({
  weightSet,
  basis,
  clash,
}: {
  weightSet: AdviseWeightSetUsed
  basis: RunBasis
  clash: PinsClash | null
}) {
  const w = usePinWords()
  const { t } = w
  return (
    <div className="flex flex-col gap-2" data-run-basis="">
      {clash && (
        <div className={ATTENTION} role="status" data-pins-clash="">
          <span className="font-semibold">{t('pins.clash.title')}</span>
          <ul className="flex flex-wrap gap-1.5">
            {clash.pins.map((p: AdvisePin) => (
              <li key={JSON.stringify(p)} className="rounded-full border border-attention-border px-2 py-px" data-pins-clash-pin="">
                {w.label(p)}
              </li>
            ))}
          </ul>
          {clash.rules.map((r) => (
            <bdi key={r} data-pins-clash-rule="">
              {r}
            </bdi>
          ))}
        </div>
      )}
      {weightSet.trial && (
        <p className={ATTENTION} data-run-trial-set="">
          <span className="font-semibold">{t('replan.trialTitle')}</span>
          <span>{t('replan.trialBody')}</span>
        </p>
      )}
      {weightSet.draft && weightSet.basedOn && (
        <p className={NOTE} data-run-draft="">
          <Trans
            t={t}
            i18nKey="replan.draft"
            values={{ name: weightSet.basedOn.name, version: weightSet.basedOn.version }}
            components={{ name: <bdi />, version: <Ltr /> }}
          />
        </p>
      )}
      {basis.figuresFrom && (
        <p className={NOTE} data-run-figures-from={basis.figuresFrom.runId}>
          <Trans
            t={t}
            i18nKey={basis.figuresFrom.readAt ? 'replan.figuresFrom' : 'replan.figuresFromRun'}
            values={{ time: basis.figuresFrom.readAt ?? '', run: basis.figuresFrom.runId }}
            components={{ time: <Ltr />, run: <Ltr /> }}
          />
        </p>
      )}
      {basis.readAfresh && (
        <p className={ATTENTION} data-run-read-afresh="">
          <span>{t('replan.readAfresh')}</span>
          {basis.readAfresh.why && <bdi data-run-read-afresh-why="">{basis.readAfresh.why}</bdi>}
        </p>
      )}
      {basis.heldGone && (
        <p className={ATTENTION} data-run-held-gone="">
          {t('replan.heldGone')}
        </p>
      )}
    </div>
  )
}
