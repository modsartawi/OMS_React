import { Link, useParams, useSearchParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { ArrowLeft } from 'lucide-react'
import ScreenGate from '@/core/ui/ScreenGate'
import Ltr from '@/core/ui/Ltr'
import { fsi } from '@/core/util/bidi'
import { bbyMaintainAccessQuery, canOpenBbyMaintain } from './api'
import { promotionPath } from './overview'

/**
 * The Create / Change / Display bonus-buy page the overview opens.
 *
 * ⚠️ **A placeholder until ticket 417 builds the SAP-copy editor here.** Ticket 416 wires the
 * route and every button that opens it (`editorPath`), so 417 replaces this body and nothing
 * else. It still stands behind the grant, as the editor will.
 */
export default function BonusBuyEditorPage() {
  const { t } = useTranslation('bonus-buy-maintenance')
  const { promoNumber = '', bbyNumber } = useParams()
  const [search] = useSearchParams()
  const mode = !bbyNumber ? 'create' : search.get('mode') === 'display' ? 'display' : 'change'

  return (
    <ScreenGate
      query={bbyMaintainAccessQuery()}
      can={canOpenBbyMaintain}
      ns="bonus-buy-maintenance"
      title={t(`editor.${mode}Title`)}
      subtitle={t('editor.subtitle', { promo: fsi(promoNumber) })}
    >
      <div className="flex flex-col gap-2 rounded-lg border border-border/60 bg-card p-4 text-sm">
        {bbyNumber && (
          <span className="font-mono">
            <Ltr>{bbyNumber}</Ltr>
          </span>
        )}
        <p className="text-muted-foreground">{t('editor.pending')}</p>
        <Link
          to={promotionPath(promoNumber)}
          className="inline-flex w-fit items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5 rtl:rotate-180" aria-hidden />
          {t('editor.back')}
        </Link>
      </div>
    </ScreenGate>
  )
}
