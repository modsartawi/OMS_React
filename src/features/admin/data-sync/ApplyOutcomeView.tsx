import { Trans, useTranslation } from 'react-i18next'
import { apiErrorMessage } from '@/core/api'
import Ltr from '@/core/ui/Ltr'
import { untaggedStores, type ApplyOutcome } from './apply-helpers'
import { CreateWarningList } from './CreateWarnings'
import { RefusalList, StoreList } from './ApplyPanel'
import { startRefusalWords } from './create-helpers'
import RefusalBanner from './RefusalBanner'
import { groupDigits } from './helpers'

/**
 * What an Apply create did, shown in the dialog once the campaign exists (ticket 564): the new
 * campaign, whether it started, the stores paused with its tag, ActionSync's per-store refusals,
 * any stores whose tag did not land, and the create's per-store warnings — warnings on a success,
 * not a failure.
 */
export default function ApplyOutcomeView({ outcome, paused }: { outcome: ApplyOutcome; paused: boolean }) {
  const { t } = useTranslation('data-sync')
  const c = outcome.campaign
  if (!c) return null
  const refused = [...(outcome.held?.refused ?? []), ...(outcome.tagged?.refused ?? [])]
  const untagged = untaggedStores(outcome)
  const tagged = outcome.tagged?.ok ?? []
  const startWords = outcome.startError ? startRefusalWords(outcome.startError) : null
  return (
    <div className="flex flex-col gap-3 text-sm" data-apply-outcome={c.campaignId}>
      <p data-apply-created="">
        <Trans
          t={t}
          i18nKey="apply.outcome.created"
          values={{ id: c.campaignId }}
          components={{
            id: (
              <code className="font-mono">
                <Ltr />
              </code>
            ),
          }}
        />
      </p>
      {!paused ? (
        <p className="text-muted-foreground">{t('apply.outcome.readyNoPause')}</p>
      ) : outcome.started ? (
        <p className="text-success-800" data-apply-started={outcome.started.status}>
          {t('apply.outcome.started')}
        </p>
      ) : (
        <RefusalBanner
          error={outcome.startError}
          title={t('apply.outcome.notStarted')}
          fallback={t('start.failedHint')}
          words={startWords && t(startWords)}
          hook="apply-start"
        />
      )}

      {paused && tagged.length > 0 && (
        <p data-apply-tagged={tagged.length}>
          <Trans
            t={t}
            i18nKey="apply.outcome.paused"
            count={tagged.length}
            values={{ figure: groupDigits(tagged.length) }}
            components={{ n: <Ltr /> }}
          />
        </p>
      )}

      {refused.length > 0 && (
        <div className="rounded-md border border-attention-border bg-attention-050 px-3 py-2 text-xs" data-apply-refusals="">
          <p className="font-medium">{t('apply.refusedTitle')}</p>
          <RefusalList refused={refused} />
        </div>
      )}

      {(untagged.length > 0 || outcome.tagged?.error != null) && (
        <div
          className="rounded-md border border-danger-border bg-danger-050 px-3 py-2 text-xs text-danger-800"
          data-apply-untagged={untagged.length}
        >
          {outcome.tagged?.error != null && (
            <p className="font-medium">
              {t('apply.outcome.tagFailed')} <bdi>{apiErrorMessage(outcome.tagged.error, t('apply.outcome.tagFailedHint'))}</bdi>
            </p>
          )}
          <p>{t('apply.outcome.untaggedTitle')}</p>
          <StoreList codes={untagged} attr="data-apply-untagged-store" />
        </div>
      )}

      {outcome.warnings.length > 0 && (
        <div
          className="rounded-md border border-attention-border bg-attention-050 px-3 py-2 text-xs"
          data-apply-warnings={outcome.warnings.length}
        >
          <p className="font-medium">{t('apply.outcome.warningsTitle')}</p>
          <CreateWarningList warnings={outcome.warnings} />
        </div>
      )}
    </div>
  )
}
