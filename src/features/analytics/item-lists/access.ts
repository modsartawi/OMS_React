import { canAuthorAnalytics, canViewAnalytics } from '@/core/analytics-access'
import type { Permissions } from '@/core/permissions'

/**
 * What an item list offers whom (BackOffice spec 4057 default 2): making and changing a list needs the author grant
 * (spec 3408's, `canAuthorAnalytics`); reading and exporting one needs only to be in its audience, which the server
 * judges — the client offers them on the view grant. A re-upload replaces the list in place, so, as a board saves in
 * place only for its owner, it is offered to the list's owner. Not the security boundary: every door judges its grant.
 */
export interface ItemListActions {
  read: boolean
  export: boolean
  upload: boolean
  reupload: boolean
}

export function itemListActions(p: Permissions, userId: string | null, list: { owner: string } | null): ItemListActions {
  const view = canViewAnalytics(p)
  const author = canAuthorAnalytics(p)
  const owns = !!list && !!userId && list.owner.toLowerCase() === userId.toLowerCase()
  return { read: view, export: view, upload: author, reupload: author && owns }
}
