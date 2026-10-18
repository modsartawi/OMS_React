import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import { apiErrorCode, apiErrorMessage, isBareDenial } from '@/core/api'
import type { RuleDraft, RuleEvaluationTree } from '@/core/models/rule-campaign'
import { rememberSavedDraft, ruleCampaignApi, ruleDraftsQuery } from '@/core/rules/api'
import { setAt } from '@/core/rules/campaign-state'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Ltr from '@/core/ui/Ltr'
import Modal from '@/core/ui/Modal'
import { formatDateTime } from '@/core/util/date-format'
import { carrierDrafts, orderSave } from './order'

/** The draft the order was to ride with is no longer being edited (waiting, or sent back). */
class NotEditing extends Error {}
/** The draft already carries an order of its own: saving would replace it, so the reader is asked. */
class CarriesOrder extends Error {}

/**
 * Which draft carries the order (ticket 524). HQ has no order save (BackOffice 2759: "an order-only
 * change rides a campaign draft"), so the edited tree goes out with one draft's Drafts/Save — the
 * draft as it is now (`Drafts/Load`), at its revision, with `tree`. Only a draft being edited may
 * carry it (`carrierDrafts`). A draft that already carries an order of its own is not overwritten
 * unasked — unless it is the draft this page saved the order with (`preferred`). The order goes live
 * when that draft is activated; an order edited from a live order that changes meanwhile is refused at
 * Activate (`RULES_ORDER_STALE`).
 */
export default function CarrierDialog({
  tree,
  preferred,
  onClose,
  onSaved,
}: {
  tree: RuleEvaluationTree
  /** The draft the page last saved the order with: picked at first, and its order replaced unasked. */
  preferred: string | null
  onClose: () => void
  /** The carrier's id and the tree HQ saved on it. */
  onSaved: (campaign: string, tree: RuleEvaluationTree) => void
}) {
  const { t } = useTranslation('campaign-priority')
  const queryClient = useQueryClient()
  const drafts = useQuery(ruleDraftsQuery())
  const carriers = carrierDrafts(drafts.data ?? [])
  const [picked, setPicked] = useState<string | null>(preferred)
  const chosen = carriers.some((d) => d.campaign === picked) ? picked : null

  const save = useMutation({
    mutationFn: async ({ campaign, replace }: { campaign: string; replace: boolean }): Promise<RuleDraft> => {
      // The draft whole, as it is now: the save is the draft's whole state.
      const loaded = await ruleCampaignApi.load(campaign)
      if (loaded.source !== 'draft' || loaded.state !== 'editing') throw new NotEditing()
      if (loaded.tree && !replace && campaign !== preferred) throw new CarriesOrder()
      return ruleCampaignApi.save(orderSave(loaded, tree))
    },
    onSuccess: (saved) => {
      rememberSavedDraft(queryClient, saved)
      void queryClient.invalidateQueries({ queryKey: ruleDraftsQuery().queryKey })
      onSaved(saved.code, saved.tree ?? tree)
    },
  })

  const failure = save.error
  const carries = failure instanceof CarriesOrder
  const failureText = carries
    ? t('carrier.carriesOrder')
    : failure instanceof NotEditing
      ? t('carrier.notEditing')
      : isBareDenial(failure)
        ? t('carrier.denied')
        : apiErrorCode(failure) === 'RULES_DRAFT_STALE'
          ? t('carrier.stale')
          : apiErrorCode(failure) === 'RULES_DRAFT_PENDING'
            ? t('carrier.notEditing')
            : apiErrorMessage(failure, t('carrier.failed'))

  return (
    <Modal
      open
      onClose={() => !save.isPending && onClose()}
      title={t('carrier.title')}
      width="34rem"
      footer={
        <>
          <Button variant="text" onClick={onClose} disabled={save.isPending} data-carrier-cancel="">
            {t('carrier.cancel')}
          </Button>
          {carries && chosen ? (
            <Button variant="danger" disabled={save.isPending} onClick={() => save.mutate({ campaign: chosen, replace: true })} data-carrier-replace="">
              {save.isPending && <Loader2 className="size-3.5 animate-spin" aria-hidden />}
              {t('carrier.replace')}
            </Button>
          ) : (
            <Button variant="primary" disabled={!chosen || save.isPending} onClick={() => chosen && save.mutate({ campaign: chosen, replace: false })} data-carrier-save="">
              {save.isPending && <Loader2 className="size-3.5 animate-spin" aria-hidden />}
              {t('carrier.save')}
            </Button>
          )}
        </>
      }
    >
      <div className="flex flex-col gap-3" data-carrier="">
        <p className="text-sm">{t('carrier.intro')}</p>
        <p className="text-sm font-medium" data-carrier-live-note="">
          {t('carrier.goesLive')}
        </p>
        {drafts.isPending ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
            <Loader2 className="size-3.5 animate-spin" aria-hidden />
            {t('carrier.loading')}
          </p>
        ) : drafts.isError ? (
          <ErrorBanner
            className="p-2.5"
            title={t('carrier.listFailedTitle')}
            message={isBareDenial(drafts.error) ? t('carrier.denied') : apiErrorMessage(drafts.error, t('carrier.failed'))}
          />
        ) : carriers.length === 0 ? (
          <p className="text-sm text-muted-foreground" data-carrier-none="">
            {t('carrier.none')}
          </p>
        ) : (
          <fieldset className="flex flex-col gap-1.5" data-carrier-list="">
            <legend className="mb-1 text-xs font-medium text-muted-foreground">{t('carrier.legend')}</legend>
            {carriers.map((d) => {
              const at = setAt(d.updatedAt)
              return (
                <label key={d.campaign} className="flex cursor-pointer items-start gap-2 rounded-md border border-border/60 px-2.5 py-2 text-sm hover:bg-accent">
                  <input
                    type="radio"
                    name="carrier"
                    className="mt-1"
                    checked={chosen === d.campaign}
                    disabled={save.isPending}
                    onChange={() => {
                      setPicked(d.campaign)
                      save.reset()
                    }}
                    data-carrier-draft={d.campaign}
                  />
                  <span className="flex min-w-0 flex-col">
                    <span className="flex flex-wrap items-baseline gap-2">
                      <span className="font-mono text-xs font-semibold">
                        <Ltr>{d.campaign}</Ltr>
                      </span>
                      <bdi>{d.name.en}</bdi>
                    </span>
                    {at && (
                      <span className="text-xs text-muted-foreground">
                        <Trans t={t} i18nKey="carrier.saved" values={{ at: formatDateTime(at), by: d.updatedBy }} components={{ at: <Ltr />, by: <bdi /> }} />
                      </span>
                    )}
                  </span>
                </label>
              )
            })}
          </fieldset>
        )}
        {save.isError && (
          <div data-carrier-refusal="">
            <ErrorBanner className="p-2.5" title={t(carries ? 'carrier.carriesOrderTitle' : 'carrier.failedTitle')} message={failureText} />
          </div>
        )}
      </div>
    </Modal>
  )
}
