/**
 * **Resend** (574/576) — the one button the strip, the card's footer and the chip share: it
 * re-sends the held link's body, and while the 30 s cooldown runs it is disabled and shows the
 * seconds left (`resendIn`). The seconds are a machine value, isolated (`Ltr`); the label is
 * prose, read in its own language's direction (`dir="auto"`).
 *
 * Drawn only while the order may send a link (`canSendLocationLink`) — the caller leaves it
 * out otherwise: hidden, never disabled.
 */
import { Trans, useTranslation } from 'react-i18next'
import Button from '@/core/ui/Button'
import Ltr from '@/core/ui/Ltr'

export default function ResendButton({
  variant,
  onClick,
  resendIn,
  disabled = false,
}: {
  variant: 'text' | 'outlined'
  onClick: () => void
  /** Seconds left on the cooldown; `0` once Resend may be pressed. */
  resendIn: number
  /** Disabled for another reason too (a send or a card act in flight). */
  disabled?: boolean
}) {
  const { t } = useTranslation('callcenter')
  return (
    <Button
      variant={variant}
      onClick={onClick}
      disabled={disabled || resendIn > 0}
      data-cc-location-resend
      data-cc-location-resend-in={resendIn}
    >
      {resendIn > 0 ? (
        <span dir="auto">
          <Trans
            t={t}
            ns="callcenter"
            i18nKey="location.strip.resendIn"
            values={{ seconds: resendIn }}
            components={{ seconds: <Ltr /> }}
          />
        </span>
      ) : (
        t('location.strip.resend')
      )}
    </Button>
  )
}
