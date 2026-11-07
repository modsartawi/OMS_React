import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Pin, PinOff } from 'lucide-react'
import { toast } from 'sonner'
import type { AnalyticsItem } from '@/core/models/analytics'
import IconButton from '@/core/ui/IconButton'
import { fsi } from '@/core/util/bidi'
import { ANALYTICS_HOME_KEY, analyticsApi } from './api'
import { asListed, isPinned, pinMutationOptions, pinRefusalWords } from './pin'

/** The Home entry every pin toggle (and Home itself) reads: one call, shared. Fresh on each mount, so Home shows the last open. */
export const analyticsHomeQuery = () => ({ queryKey: ANALYTICS_HOME_KEY, queryFn: () => analyticsApi.home(), retry: false, staleTime: 0 }) as const

/**
 * 840 (BackOffice 3443): pin or unpin an item — on every library row and on the board, view and report pages.
 * Any viewer may pin (runners too). Whether it is pinned comes from Home (`./pin`); until Home answers the toggle
 * is disabled rather than guessing. Optimistic: Pinned changes at once and goes back on a refusal, with its words.
 */
export default function PinToggle({ item, title }: { item: Omit<AnalyticsItem, 'definition'>; title: string }) {
  const { t } = useTranslation('boards')
  const queryClient = useQueryClient()
  const home = useQuery(analyticsHomeQuery())
  const pinned = isPinned(home.data, item.id)
  const toggle = useMutation(
    pinMutationOptions(queryClient, analyticsApi, (err, vars) => toast.error(pinRefusalWords(err, vars.pinned, t))),
  )
  const name = fsi(title || t('home.untitled'))
  return (
    <IconButton
      label={pinned ? t('pin.unpinLabel', { title: name }) : t('pin.pinLabel', { title: name })}
      aria-pressed={pinned === true}
      disabled={pinned === null}
      onClick={() => pinned !== null && toggle.mutate({ item: asListed(item), pinned: !pinned })}
      data-analytics-pin={item.id}
      data-analytics-pinned={pinned === null ? 'unknown' : String(pinned)}
    >
      {pinned ? <PinOff className="size-3.5" aria-hidden /> : <Pin className="size-3.5" aria-hidden />}
    </IconButton>
  )
}
