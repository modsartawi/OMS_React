import { useTranslation } from 'react-i18next'
import { Copy } from 'lucide-react'
import { notify } from '@/core/services/notify'
import Button from '@/core/ui/Button'
import { copyText } from '@/core/util/copy-text'
import { keptRunLink } from './kept-runs-model'

/** "Copy link" (ticket 969): the link that opens the simulator on a stored run, for any holder of the run grant. */
export default function CopyRunLink({ runId, variant = 'outlined' }: { runId: string; variant?: 'outlined' | 'ghost' }) {
  const { t } = useTranslation('sourcing-simulator')
  const copy = async () => {
    const outcome = await copyText(keptRunLink(runId, window.location.origin))
    if (outcome === 'copied') notify.success(t('kept.linkCopied'))
    else notify.error(t('kept.linkNotCopied'), t('kept.linkNotCopiedDetail'))
  }
  return (
    <Button variant={variant} onClick={() => void copy()} data-copy-run-link={runId}>
      <Copy className="size-3.5" aria-hidden />
      {t('kept.copyLink')}
    </Button>
  )
}
