import { useState } from 'react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { BadgeCheck, BadgeX, Lock, Share2, ShieldAlert, Trash2 } from 'lucide-react'
import type { AnalyticsBoard, AnalyticsItem } from '@/core/models/analytics'
import Button from '@/core/ui/Button'
import { buttonClass, type ButtonVariant } from '@/core/ui/control-classes'
import Modal from '@/core/ui/Modal'
import { needsCurator, type TierActionKey } from './item-tier'
import { useItemTier } from './use-item-tier'
import { analyticsRefusal, refusalWords } from './wire'

const ICONS = { share: Share2, unshare: Lock, certify: BadgeCheck, certifyRevision: BadgeCheck, uncertify: BadgeX, delete: Trash2 }
const VARIANT: Record<TierActionKey, ButtonVariant> = {
  share: 'secondary',
  unshare: 'secondary',
  certify: 'secondary',
  certifyRevision: 'secondary',
  uncertify: 'secondary',
  delete: 'danger-outlined',
}
/** Withdrawing a figure is asked once more; sharing (reversible) and certifying are one click. */
const CONFIRMED: ReadonlySet<TierActionKey> = new Set(['uncertify', 'delete'])

/**
 * The tier's actions on a view's or a board's header (ticket 778): an owner's Share / Unshare and Delete, a
 * curator's Certify (or Certify this revision into the existing certified copy), Un-certify and Delete. An action
 * the actor cannot take is not shown. A refusal is worded beside them; `ANALYTICS-402` says the curator grant
 * is gone, and the curator's actions are hidden from then on.
 */
export default function ItemTierActions({ item }: { item: AnalyticsItem | AnalyticsBoard }) {
  const { t } = useTranslation('boards')
  const tier = useItemTier(item)
  const [asking, setAsking] = useState<TierActionKey | null>(null)

  const take = (key: TierActionKey) => {
    tier.reset()
    if (CONFIRMED.has(key)) setAsking(key)
    else tier.run(key)
  }
  let refusedWords: string | null = null
  if (tier.error) {
    if (needsCurator(tier.error)) refusedWords = t('tierActions.refused.needsCurator')
    else {
      const refusal = analyticsRefusal(tier.error, t('tierActions.failed'))
      refusedWords = refusalWords(refusal, t)
    }
  }

  if (tier.actions.length === 0 && !refusedWords && !tier.certifiedCopy) return null
  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex flex-wrap items-center justify-end gap-2" role="group" aria-label={t('tierActions.label')} data-analytics-tier-actions>
        {tier.certifiedCopy && (
          <Link
            to={`/analytics/${item.kind === 'board' ? 'board' : 'view'}/${encodeURIComponent(tier.certifiedCopy.id)}`}
            className={buttonClass('link')}
            data-analytics-certified-copy={tier.certifiedCopy.id}
          >
            {t('tierActions.openCertifiedCopy')}
          </Link>
        )}
        {tier.actions.map((key) => {
          const Icon = ICONS[key]
          return (
            <Button key={key} variant={VARIANT[key]} onClick={() => take(key)} disabled={tier.pending} data-analytics-action={key}>
              <Icon className="size-3.5" aria-hidden />
              {t(`tierActions.${key}`)}
            </Button>
          )
        })}
      </div>
      {refusedWords && (
        <p
          className="flex max-w-md items-start gap-1 text-xs text-attention-800"
          role="alert"
          data-analytics-tier-refusal={needsCurator(tier.error) ? 'needs-curator' : 'other'}
        >
          <ShieldAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <span>
            <bdi>{refusedWords}</bdi>
          </span>
        </p>
      )}
      <Modal
        open={asking !== null}
        onClose={() => setAsking(null)}
        title={asking ? t(`tierActions.confirm.${asking}.title`) : ''}
        footer={
          <>
            <Button variant="text" onClick={() => setAsking(null)}>
              {t('tierActions.confirm.cancel')}
            </Button>
            <Button
              variant="danger"
              data-analytics-confirm={asking ?? ''}
              onClick={() => {
                if (asking) tier.run(asking)
                setAsking(null)
              }}
            >
              {asking ? t(`tierActions.${asking}`) : ''}
            </Button>
          </>
        }
      >
        {asking && <p className="text-sm">{t(`tierActions.confirm.${asking}.body.${item.kind}`)}</p>}
      </Modal>
    </div>
  )
}
