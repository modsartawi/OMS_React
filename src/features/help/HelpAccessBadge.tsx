import { useTranslation } from 'react-i18next'
import StatusBadge from '@/core/ui/StatusBadge'
import { helpAccessHeld, isHelpAccess } from '@/core/help/help-access'
import type { Permissions } from '@/core/permissions'
import type { HelpAccess, HelpLang } from '@/core/models/help'

/**
 * An article's access badge (oms 951): the level its features need, and the reader's sentence — "You have this
 * access" or "Ask your administrator for … access". No sentence until the permissions answer settles, so a reader
 * is never told to ask for access they hold. `quiet` keeps the sentence for screen readers only (the rail).
 */
export default function HelpAccessBadge({ access, permissions, lang, quiet = false }: { access: HelpAccess; permissions: Permissions; lang: HelpLang; quiet?: boolean }) {
  const { t } = useTranslation('help', { lng: lang })
  const held = permissions.settled && helpAccessHeld(access, permissions)
  // A level the app does not know (review 4182 #1) reads as a generic label, never a raw key.
  const known = isHelpAccess(access)
  const label = known ? t(`access.${access}`) : t('access.unknown')
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <span data-help-access={access} className="contents">
        <StatusBadge sev={held ? 'ok' : 'mute'}>{label}</StatusBadge>
      </span>
      {permissions.settled && (
        <span data-help-access-sentence className={quiet ? 'sr-only' : 'text-xs text-muted-foreground'}>
          {held ? t('access.held') : known ? t('access.ask', { access: label }) : t('access.askUnknown')}
        </span>
      )}
    </span>
  )
}
