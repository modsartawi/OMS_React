import { useState } from 'react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { BadgeCheck, BadgeX, Lock, Share2, ShieldAlert, Trash2, UserRoundCog, UsersRound } from 'lucide-react'
import { itemHref } from '@/core/analytics-routes'
import type { AnalyticsBoard, AnalyticsItem, AnalyticsReport } from '@/core/models/analytics'
import Button from '@/core/ui/Button'
import { buttonClass, type ButtonVariant } from '@/core/ui/control-classes'
import Modal from '@/core/ui/Modal'
import { needsAuthor } from './access'
import { needsCurator, type TierActionKey } from './item-tier'
import ShareDialog, { ReassignDialog } from './ShareDialog'
import { useItemTier } from './use-item-tier'
import { analyticsRefusal, refusalWords } from './wire'

const ICONS = { share: Share2, unshare: Lock, narrow: UsersRound, reassign: UserRoundCog, certify: BadgeCheck, certifyRevision: BadgeCheck, uncertify: BadgeX, delete: Trash2 }
const VARIANT: Record<TierActionKey, ButtonVariant> = {
  share: 'secondary',
  unshare: 'secondary',
  narrow: 'secondary',
  reassign: 'secondary',
  certify: 'secondary',
  certifyRevision: 'secondary',
  uncertify: 'secondary',
  delete: 'danger-outlined',
}
/** Withdrawing a figure is asked once more; unsharing (reversible) and certifying are one click. */
const CONFIRMED: ReadonlySet<TierActionKey> = new Set(['uncertify', 'delete'])
/** 826: sharing (with an audience), narrowing and reassigning open their dialog. */
type DialogKey = Extract<TierActionKey, 'share' | 'narrow' | 'reassign'>
const isDialog = (key: TierActionKey): key is DialogKey => key === 'share' || key === 'narrow' || key === 'reassign'

/**
 * 826 (spec 819 §C/§E): Share opens the share dialog (everyone, or roles and users); a curator's Narrow opens it
 * narrowing only, with Unshare; Reassign hands the item to another author.
 *
 * The tier's actions on a view's or a board's header (ticket 778): an owner's Share / Unshare and Delete, a
 * curator's Certify (or Certify this revision into the existing certified copy), Un-certify and Delete. An action
 * the actor cannot take is not shown. A refusal is worded beside them; `ANALYTICS-402` says the curator grant
 * is gone, and the curator's actions are hidden from then on; `ANALYTICS-415` (822) the author grant, and every
 * author's action hides.
 */
export default function ItemTierActions({ item }: { item: AnalyticsItem | AnalyticsBoard | AnalyticsReport }) {
  const { t } = useTranslation('boards')
  const tier = useItemTier(item)
  const [asking, setAsking] = useState<Exclude<TierActionKey, DialogKey> | null>(null)
  const [dialog, setDialog] = useState<DialogKey | null>(null)

  const take = (key: TierActionKey) => {
    tier.reset()
    if (isDialog(key)) setDialog(key)
    else if (CONFIRMED.has(key)) setAsking(key)
    else tier.run(key)
  }
  // A lost grant (415, 402) is worded beside the actions, which hide; the dialog closes on it.
  const lostGrant = needsAuthor(tier.error) || needsCurator(tier.error)
  const dialogOpen = dialog !== null && !lostGrant
  const close = () => {
    setDialog(null)
    tier.reset()
  }
  let refusedWords: string | null = null
  if (tier.error && (!dialog || lostGrant)) {
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
            to={itemHref(item.kind, tier.certifiedCopy.id)}
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
          data-analytics-tier-refusal={needsCurator(tier.error) ? 'needs-curator' : needsAuthor(tier.error) ? 'needs-author' : 'other'}
        >
          <ShieldAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <span>
            <bdi>{refusedWords}</bdi>
          </span>
        </p>
      )}
      {dialogOpen && dialog === 'reassign' && (
        <ReassignDialog item={item} pending={tier.pending} error={tier.error} onClose={close} onSave={(owner) => tier.write({ key: 'reassign', owner }, close)} />
      )}
      {dialogOpen && dialog !== 'reassign' && (
        <ShareDialog
          item={item}
          mode={dialog}
          pending={tier.pending}
          error={tier.error}
          onClose={close}
          onSave={(audience) => tier.write({ key: dialog, audience }, close)}
          // A curator's Unshare lives in the narrowing dialog (§C "narrow the audience or unshare it").
          onUnshare={dialog === 'narrow' ? () => tier.write({ key: 'unshare' }, close) : undefined}
        />
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
