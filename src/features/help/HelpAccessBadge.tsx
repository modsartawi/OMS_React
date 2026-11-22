import { useTranslation } from 'react-i18next'
import StatusBadge from '@/core/ui/StatusBadge'
import { helpAccessHeld, helpAccessLacking, isHelpAccess } from '@/core/help/help-access'
import type { Permissions } from '@/core/permissions'
import type { HelpAccess, HelpLang } from '@/core/models/help'

/**
 * An article's access badges (oms 951; BackOffice 4183 sends a list, lowest first): one badge per level, and the
 * reader's sentence — "You have this access", or "Ask your administrator for …" naming only the levels they lack. No
 * sentence until the permissions answer settles, so a reader is never told to ask for access they hold. `quiet` keeps
 * the sentence for screen readers only (the rail).
 */
export default function HelpAccessBadge({ access, permissions, lang, quiet = false }: { access: readonly HelpAccess[]; permissions: Permissions; lang: HelpLang; quiet?: boolean }) {
  const { t } = useTranslation('help', { lng: lang })
  if (access.length === 0) return null
  const lacking = helpAccessLacking(access, permissions)
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      {access.map((level) => (
        <span key={level} data-help-access={level} className="contents">
          <StatusBadge sev={permissions.settled && helpAccessHeld(level, permissions) ? 'ok' : 'mute'}>{helpAccessLabel(t, level)}</StatusBadge>
        </span>
      ))}
      {permissions.settled && (
        <span data-help-access-sentence className={quiet ? 'sr-only' : 'text-xs text-muted-foreground'}>
          {lacking.length === 0
            ? t('access.held')
            : lacking.every(isHelpAccess)
              ? t('access.ask', { access: joinLevels(lacking.map((l) => helpAccessLabel(t, l)), lang) })
              : t('access.askUnknown')}
        </span>
      )}
    </span>
  )
}

/** A level's label; one the app does not know (review 4182 #1) reads as a generic label, never a raw key. */
export const helpAccessLabel = (t: (key: string) => string, level: string): string => (isHelpAccess(level) ? t(`access.${level}`) : t('access.unknown'))

/** Translated level names joined as the language joins a list: "Author and Curator", "مُنشئ ومشرف". */
const joinLevels = (labels: string[], lang: HelpLang): string => new Intl.ListFormat(lang, { style: 'long', type: 'conjunction' }).format(labels)
