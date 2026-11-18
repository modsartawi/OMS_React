import { usePermissions } from '@/core/permissions'
import { idfGrants, type IdfGrants } from './access'

/**
 * The session's IDF grants (oms ticket 654; oms 914: off the one permissions answer). While it is reading, and when it
 * fails, nothing is granted: the write controls stay hidden (fail closed). The doors re-check their grants regardless.
 */
export function useIdfAccess(): IdfGrants {
  return idfGrants(usePermissions())
}
