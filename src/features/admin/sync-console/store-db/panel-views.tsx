import type { ComponentType } from 'react'
import type { StoreDbStore } from '@/core/models/store-database'
import type { StoreDbPanel } from './panels'

import ReadingsPanel from './ReadingsPanel'

// 917: import LivePanel from './LivePanel'

// 917: import HealthPanel from './HealthPanel'

// 918: import SpacePanel from './SpacePanel'

// 918: import BackupPanel from './BackupPanel'

// 918: import JobsPanel from './JobsPanel'

// 919: import RestorePanel from './RestorePanel'

/** What every store panel is handed: the page's `GET StoreDatabase/Store` answer (its `code` included). */
export interface StoreDbPanelProps {
  store: StoreDbStore
}

/**
 * The store page's mounted panels (oms 916–919). ONE line per panel, blank-line separated, in the page's order —
 * so the tickets that build panels side by side each un-comment their own lines (here and the import above) and
 * never touch a neighbour's. A panel is shown once it is here (`storeDbPanels`); the order is `STORE_DB_PANELS`'.
 */
export const PANEL_VIEWS: Partial<Record<StoreDbPanel, ComponentType<StoreDbPanelProps>>> = {
  readings: ReadingsPanel,

  // live: LivePanel,

  // health: HealthPanel,

  // space: SpacePanel,

  // backup: BackupPanel,

  // jobs: JobsPanel,

  // restore: RestorePanel,
}
