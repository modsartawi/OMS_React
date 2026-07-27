/**
 * **The console's one confirmation surface** (ticket 167).
 *
 * "Are you sure" arrives on the SUCCESS path — `200`, the unchanged state, and a
 * `confirmToken` that pins the previewed change (CONTRACT.md §5) — and it is
 * always drawn here. Ruled a **modal sheet** at
 * [135](.issues/135-agent-console-prototype.md): an inline card in a scrolling
 * flow can be scrolled past, and these are the moments that must be able to stop
 * the agent.
 *
 * 🚩 This file owns everything that is true of *any* confirmation, so that the
 * second one to arrive ([169](.issues/169-below-availability-accepted.md)'s
 * below-availability acceptance) is a **body**, not a second mechanism: the
 * modal, the two buttons and which of them is the default, the re-issue notice
 * after `CONFIRM_TOKEN_STALE`, the failure line, and the block that refuses the
 * commit outright when the preview already knows the server would. What each
 * kind PREVIEWS is the only thing its own component supplies.
 *
 * The dismissing action is the default one, as with the abandon dialog: Escape,
 * the backdrop and *keep* all decline. Declining costs nothing — the preview is
 * the engine door run and not persisted, which is why there is no dry-run flag.
 */
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import Button from '@/core/ui/Button'
import Modal from '@/core/ui/Modal'
import { NOTE } from './console-notes'

/** Why the agent is being shown a second preview of the same action. Both are
 *  §7 codes the console answers by re-previewing rather than by committing. */
export type PreviewReissue = 'stale' | 'expired'

export default function ConfirmSheet({
  open,
  marker,
  title,
  reissue,
  blocked,
  busy,
  error,
  keepLabel,
  confirmLabel,
  busyLabel,
  onConfirm,
  onCancel,
  children,
}: {
  open: boolean
  /** Which confirmation this is (`pendingConfirmation.kind`) — the drives' handle
   *  and, at 169, the proof that both kinds arrive through this element. */
  marker: string
  title: string
  reissue: PreviewReissue | null
  /**
   * The preview already knows the commit would be refused — so it is refused
   * here rather than after a round trip. Drawn as the danger block, and it
   * disables the commit: a button whose only possible answer is a refusal is a
   * refusal the agent has to discover.
   */
  blocked?: ReactNode
  busy: boolean
  /** A failed commit that is not the surface's own outcome. */
  error: string | null
  keepLabel: string
  confirmLabel: string
  busyLabel: string
  onConfirm: () => void
  onCancel: () => void
  children: ReactNode
}) {
  const { t } = useTranslation('callcenter')
  return (
    <Modal
      open={open}
      // A dismissal mid-commit would leave the agent unsure whether it landed.
      // The request settles either way, so the sheet holds until it does.
      onClose={() => !busy && onCancel()}
      title={title}
      width="34rem"
      footer={
        <>
          <Button variant="text" onClick={onCancel} disabled={busy} data-cc-confirm-decline>
            {keepLabel}
          </Button>
          <Button
            variant="primary"
            onClick={onConfirm}
            disabled={busy || blocked !== undefined}
            data-cc-confirm-accept
          >
            {busy ? busyLabel : confirmLabel}
          </Button>
        </>
      }
    >
      <div className="space-y-3 text-sm" data-cc-confirm-sheet={marker}>
        {reissue && (
          // The agent already accepted a diff; this is not that diff.
          <p className={NOTE.attention} data-cc-confirm-reissued={reissue}>
            {t(reissue === 'stale' ? 'confirm.reissuedStale' : 'confirm.reissuedExpired')}
          </p>
        )}
        {children}
        {blocked !== undefined && (
          <div className={NOTE.danger} data-cc-confirm-blocked>
            {blocked}
          </div>
        )}
        {error && (
          <p className={NOTE.danger} data-cc-confirm-error>
            {error}
          </p>
        )}
      </div>
    </Modal>
  )
}
