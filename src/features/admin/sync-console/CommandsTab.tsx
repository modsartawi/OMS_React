import { useTranslation } from 'react-i18next'
import { EMPTY_COMMANDS_FILTER } from './command-helpers'
import CommandsFeed from './CommandsFeed'

/** The store page's Commands tab (ticket 448): the fleet-wide feed, narrowed to this store's code. */
export default function CommandsTab({ code }: { code: string }) {
  const { t } = useTranslation('sync-console')
  return <CommandsFeed filter={{ ...EMPTY_COMMANDS_FILTER, code }} empty={t('commands.emptyStore')} />
}
