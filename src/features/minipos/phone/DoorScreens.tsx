import { useTranslation } from 'react-i18next'
import { CalendarX2, Lock, ShieldX } from 'lucide-react'
import Button from '@/core/ui/Button'
import Ltr from '@/core/ui/Ltr'
import type { ExistingOrder } from '@/core/models/callcenter'
import RefusalBanner from './RefusalBanner'
import ScannerView from './ScannerView'
import { PHARMACY_CODE_FORMATS, type ScanRead } from './scanner'
import type { ShownRefusal } from './refusal'

/** "Not assigned today" (spec 4032 story 3), or another refusal of the door that selling cannot get past. */
export function DoorRefusedScreen({
  notAssigned,
  refusal,
  busy,
  onRetry,
}: {
  notAssigned: boolean
  refusal: ShownRefusal | null
  busy: boolean
  onRetry: () => void
}) {
  const { t } = useTranslation('minipos')
  const Icon = notAssigned ? CalendarX2 : ShieldX
  return (
    <div className="flex flex-col gap-4" data-screen={notAssigned ? 'not-assigned' : 'blocked'}>
      <h1 className="flex items-center gap-2 text-lg font-semibold">
        <Icon className="size-5" aria-hidden />
        {notAssigned ? t('notAssigned.title') : t('blocked.title')}
      </h1>
      {refusal && <RefusalBanner refusal={refusal} />}
      {notAssigned && <p className="text-sm text-muted-foreground">{t('notAssigned.hint')}</p>}
      <Button variant="secondary" className="h-11 w-full justify-center" disabled={busy} onClick={onRetry}>
        {busy ? t('app.working') : t('app.retry')}
      </Button>
    </div>
  )
}

/**
 * Unlock (spec 4032 stories 4-8): scan the changing code on a till screen of the assigned pharmacy, or its printed code.
 * The server checks the code's signature, its window or print version, and the pharmacy; each refusal says which.
 */
export function UnlockScreen({
  refusal,
  busy,
  onCode,
}: {
  refusal: ShownRefusal | null
  busy: boolean
  onCode: (read: ScanRead) => void
}) {
  const { t } = useTranslation('minipos')
  return (
    <div className="flex flex-col gap-4" data-screen="unlock">
      <h1 className="flex items-center gap-2 text-lg font-semibold">
        <Lock className="size-5" aria-hidden />
        {t('unlock.title')}
      </h1>
      <p className="text-sm text-muted-foreground">{t('unlock.hint')}</p>
      <ScannerView formats={PHARMACY_CODE_FORMATS} onRead={onCode} autoStart paused={busy} />
      {busy && <p className="text-sm text-muted-foreground">{t('unlock.unlocking')}</p>}
      {refusal && <RefusalBanner refusal={refusal} />}
    </div>
  )
}

/** A basket is already open for this promoter: continue it, or cancel it and start again (one basket at a time). */
export function ExistingBasketScreen({
  existing,
  busy,
  refusal,
  onResume,
  onStartNew,
}: {
  existing: ExistingOrder
  busy: boolean
  refusal: ShownRefusal | null
  onResume: () => void
  onStartNew: () => void
}) {
  const { t } = useTranslation('minipos')
  return (
    <div className="flex flex-col gap-4" data-screen="existing">
      <h1 className="text-lg font-semibold">{t('existing.title')}</h1>
      <p className="text-sm">
        {t('existing.lines')} <Ltr>{existing.lineCount}</Ltr>
      </p>
      {refusal && <RefusalBanner refusal={refusal} />}
      <Button className="h-12 w-full justify-center" disabled={busy} onClick={onResume}>
        {t('existing.resume')}
      </Button>
      <Button variant="outlined" className="h-11 w-full justify-center" disabled={busy} onClick={onStartNew}>
        {t('existing.startNew')}
      </Button>
    </div>
  )
}
