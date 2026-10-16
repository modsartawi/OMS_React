import { Navigate, useParams } from 'react-router'
import { campaignPath } from '@/core/rules/campaign-state'
import AudienceSettings from './AudienceSettings'
import BudgetsSettings from './BudgetsSettings'
import DetailsSettings from './DetailsSettings'
import FeaturesSettings from './FeaturesSettings'
import { settingsPage } from './menu'
import OfflineSettings from './OfflineSettings'
import ScheduleSettings from './ScheduleSettings'

/**
 * Settings ▸ (ticket 509): Details, Schedule, Audience, Features, Budgets (510) and Offline, one
 * page each at `settings/<page>` — each with its own Cancel / Save, Budgets saving from its drawer.
 * A page that is unknown or not landed yet opens Details instead.
 */
export default function SettingsPage() {
  const { id = '', '*': page } = useParams()
  const key = settingsPage(page)
  if (!key) return <Navigate to={`${campaignPath(id)}/settings/details`} replace />
  switch (key) {
    case 'schedule':
      return <ScheduleSettings />
    case 'audience':
      return <AudienceSettings />
    case 'features':
      return <FeaturesSettings />
    case 'budgets':
      return <BudgetsSettings />
    case 'offline':
      return <OfflineSettings />
    default:
      return <DetailsSettings />
  }
}
