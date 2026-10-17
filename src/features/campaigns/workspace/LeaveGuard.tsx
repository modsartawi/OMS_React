import { useTranslation } from 'react-i18next'
import CoreLeaveGuard from '@/core/ui/LeaveGuard'

/**
 * Leaving a workspace page with unsaved changes asks first (the rule builder, 505; each Settings
 * page, 509) — `@/core/ui/LeaveGuard` in this namespace's words. `words` is the locale prefix of the
 * page's own wording (`title`, `body`, `stay`, `go`).
 */
export default function LeaveGuard({ dirty, words }: { dirty: boolean; words: 'builder.leave' | 'settings.leave' }) {
  const { t } = useTranslation('campaign-workspace')
  return (
    <CoreLeaveGuard
      dirty={dirty}
      words={{ title: t(`${words}.title`), body: t(`${words}.body`), stay: t(`${words}.stay`), go: t(`${words}.go`) }}
    />
  )
}
