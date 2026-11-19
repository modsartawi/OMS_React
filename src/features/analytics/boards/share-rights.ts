import type { AnalyticsItem } from '@/core/models/analytics'

/** A `boards:share.can.<key>` and a `boards:share.cannot.<key>`. */
export interface ShareRights {
  can: readonly string[]
  cannot: readonly string[]
}

const RUN: ShareRights = { can: ['run', 'params', 'export', 'link'], cannot: ['edit', 'ai', 'copy'] }
/** 926 (BackOffice spec 4057): an item list is read and exported by its audience, never run; only its owner changes it. */
const LIST: ShareRights = { can: ['readList', 'exportList'], cannot: ['changeList'] }

/** What the share dialog says an item's audience can do, and cannot, by its kind. */
export const shareRights = (kind: AnalyticsItem['kind']): ShareRights => (kind === 'itemlist' ? LIST : RUN)
