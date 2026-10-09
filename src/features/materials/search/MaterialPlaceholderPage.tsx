import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'
import { Construction } from 'lucide-react'

/**
 * The ONE placeholder the Materials area's not-yet-built routes render (ticket 451):
 * `/materials/:no`, `/materials/stock` and `/materials/gs1`, registered now so the search grid's
 * links and the menu's leaves never land on a 404. 453 and 454 point their routes at their own
 * pages; 452 points `:no` at its page and DELETES this file. No feature imports it — only the router.
 */
export default function MaterialPlaceholderPage() {
  const { t } = useTranslation('materials-search')
  // Which route matched: the static `stock` / `gs1` routes carry no `:no`. The drive reads it to
  // prove React Router ranks those two above the dynamic material route.
  const { no } = useParams()
  return (
    <div
      className="mx-auto mt-16 max-w-md rounded-lg border border-border/60 bg-card p-6 text-center"
      data-material-placeholder={no === undefined ? 'static' : 'material'}
    >
      <Construction className="mx-auto mb-2 h-6 w-6 text-muted-foreground" aria-hidden />
      <div className="text-base font-semibold tracking-tight">{t('placeholder.title')}</div>
      <p className="mt-2 text-sm text-muted-foreground">{t('placeholder.body')}</p>
      <Link to="/materials" className="mt-4 inline-block text-sm text-primary-800 underline-offset-2 hover:underline">
        {t('placeholder.back')}
      </Link>
    </div>
  )
}
