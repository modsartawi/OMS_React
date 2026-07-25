import { useTranslation } from 'react-i18next'

import { apiErrorMessage } from '@/core/api'
import ErrorBanner from '@/core/ui/ErrorBanner'
import { faultRoute } from './fault-route'

/**
 * The whole-run failure banner (ticket 120, spec 110 stories 68–72).
 *
 * It sits **where the work area would be** — the Page renders it INSTEAD of the
 * results, never above them — so a failed run never leaves the previous run's
 * results sitting below an error, and Items stays exactly where it was so the
 * offending line is corrected in place.
 *
 * It carries the route (`faultRoute`, the pure rule): an item fault points at the
 * Items frame just above; a determination fault offers to open the run settings.
 * That one is a **button, not an effect** — the form opens on click and never by
 * itself. The screen must not move while the analyst is starting to read a failure.
 *
 * The money is the Page's business: it passes `null` on a failed run, so the total
 * is absent rather than zeroed.
 */
interface Props {
  error: unknown
  /** Opens the run strip's form. Called only from the settings route's click. */
  onOpenSettings: () => void
}

export default function SimFailureBanner({ error, onOpenSettings }: Props) {
  const { t } = useTranslation('simulation')
  const route = faultRoute(error)
  const title = t('banner.failed')

  return (
    <div data-sim-failure>
      <ErrorBanner title={title} message={apiErrorMessage(error, title)} className="p-4">
        {route === 'items' ? (
          <p data-fault-route="items" className="mt-1.5 font-medium">
            {t('banner.routeItems')}
          </p>
        ) : null}
        {route === 'settings' ? (
          <button
            type="button"
            data-fault-route="settings"
            onClick={onOpenSettings}
            className="mt-1.5 rounded-full border border-danger-border px-3 py-1 text-xs font-medium hover:bg-danger-border/40"
          >
            {t('banner.routeSettings')}
          </button>
        ) : null}
      </ErrorBanner>
    </div>
  )
}
