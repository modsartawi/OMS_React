import { useTranslation } from 'react-i18next'
import { Braces, Copy } from 'lucide-react'
import type { PickSupportCopyBundle } from '@/core/models/pick-support'
import { notify } from '@/core/services/notify'
import Button from '@/core/ui/Button'
import { copyText } from '@/core/util/copy-text'

/**
 * Copy diagnosis (the brief's panel §7): "Copy as text" puts `copy.text` on the clipboard and
 * "Copy as JSON" `copy.json` — VERBATIM. The client never assembles a copy block of its own: the
 * server built it from this same diagnosis, so it cannot say anything the panel does not.
 *
 * Shown at every verdict; under UNKNOWN it is the prominent action (`prominent`), since escalating
 * with this block is the only thing support can do.
 */
export default function CopyDiagnosis({ copy, prominent = false }: { copy: PickSupportCopyBundle; prominent?: boolean }) {
  const { t } = useTranslation('pick-support')

  async function put(text: string) {
    const outcome = await copyText(text)
    if (outcome === 'copied') notify.success(t('copy.done'))
    else notify.error(t('copy.failed'), t('copy.failedDetail'))
  }

  const variant = prominent ? 'primary' : 'outlined'
  return (
    <div role="group" aria-label={t('copy.label')} className="inline-flex items-center gap-px" data-ps-copy-group={prominent ? 'prominent' : ''}>
      <Button variant={variant} className="rounded-e-none" onClick={() => void put(copy.text ?? '')} data-ps-copy="text">
        <Copy className="h-3.5 w-3.5" aria-hidden />
        {t('copy.text')}
      </Button>
      <Button variant={variant} className="rounded-s-none" onClick={() => void put(copy.json ?? '')} data-ps-copy="json">
        <Braces className="h-3.5 w-3.5" aria-hidden />
        {t('copy.json')}
      </Button>
    </div>
  )
}
