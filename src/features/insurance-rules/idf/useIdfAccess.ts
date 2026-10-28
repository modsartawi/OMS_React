import { useQuery } from '@tanstack/react-query'

import { NO_IDF_GRANTS, type IdfGrants } from './access'
import { idfAccessQuery } from './api'

/**
 * The session's IDF grants (oms ticket 654, `GET IdfPriority/Access`). While the probe is reading, and when it fails,
 * nothing is granted: the write controls stay hidden (fail closed). The doors re-check their grants regardless.
 */
export function useIdfAccess(): IdfGrants {
  const access = useQuery(idfAccessQuery())
  return access.data ?? NO_IDF_GRANTS
}
