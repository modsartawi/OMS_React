import { useTranslation } from 'react-i18next'
import { Undo2 } from 'lucide-react'
import type { AdviseReply } from '@/core/models/sourcing-run'
import Button from '@/core/ui/Button'
import Ltr from '@/core/ui/Ltr'

/**
 * Above a replay's plans (ticket 964, spec 4354 §16; 4244 decision 15): a replay through the advise door plans on today's
 * figures and says so — "planned on today's figures, not the order's". A replay whose customer's point was moved by hand
 * is marked so, its "What happened" is hidden, and "Back to the order's point" plans it again from the order's own.
 */
export default function ReplayBanner({ reply, onBack, busy }: { reply: AdviseReply; onBack: () => void; busy: boolean }) {
  const { t } = useTranslation('sourcing-simulator')
  if (reply.kind !== 'REPLAY' && reply.kind !== 'REPLAY_MOVED_POINT') return null
  const moved = reply.kind === 'REPLAY_MOVED_POINT'
  return (
    <div className="flex flex-col gap-2 rounded-md border border-attention-border bg-attention-050 px-3 py-2 text-xs text-attention-800" data-replay-banner={reply.kind}>
      <span className="flex flex-wrap items-center gap-2">
        <span className="font-semibold" data-replay-todays="">
          {t('replay.todaysFigures')}
        </span>
        {reply.orderNumber && (
          <span className="font-mono" data-replay-order="">
            <Ltr>{reply.orderNumber}</Ltr>
          </span>
        )}
      </span>
      {moved && (
        <span className="flex flex-wrap items-center gap-2" data-replay-moved="">
          <span className="rounded-full border border-attention-border px-1.5 py-px font-medium">{t('replay.movedByHand')}</span>
          <span>{t('replay.movedHint')}</span>
          <Button variant="secondary" disabled={busy} onClick={onBack} data-replay-back="">
            <Undo2 className="size-3.5" aria-hidden />
            {t('replay.backToOrder')}
          </Button>
        </span>
      )}
    </div>
  )
}
