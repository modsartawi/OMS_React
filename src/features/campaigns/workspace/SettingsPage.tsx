import { Navigate, useParams } from 'react-router'
import { campaignPath } from '@/core/rules/campaign-state'
import AudienceSettings from './AudienceSettings'
import DetailsSettings from './DetailsSettings'
import FeaturesSettings from './FeaturesSettings'
import { settingsPage } from './menu'
import OfflineSettings from './OfflineSettings'
import ScheduleSettings from './ScheduleSettings'

/**
 * Settings ▸ (ticket 509): Details, Schedule, Audience, Features and Offline, one page each at
 * `settings/<page>`, each with its own Cancel / Save. A page that is unknown or not landed yet
 * (Budgets, 510) opens Details instead.
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
    case 'offline':
      return <OfflineSettings />
    default:
      return <DetailsSettings />
  }
}
