import type { ComponentType } from 'react'
import type { StoreDbStore } from '@/core/models/store-database'
import type { StoreDbPanel } from './panels'
import BackupPanel from './BackupPanel'
import HealthPanel from './HealthPanel'
import JobsPanel from './JobsPanel'
import LivePanel from './LivePanel'
import ReadingsPanel from './ReadingsPanel'
import RestorePanel from './RestorePanel'
import SpacePanel from './SpacePanel'

/** What every store panel is handed: the page's `GET StoreDatabase/Store` answer (its `code` included). */
export interface StoreDbPanelProps {
  store: StoreDbStore
}

/** The store page's panels (oms 916–919), each by its key; the page's order is `STORE_DB_PANELS`'. */
export const PANEL_VIEWS: Record<StoreDbPanel, ComponentType<StoreDbPanelProps>> = {
  readings: ReadingsPanel,
  live: LivePanel,
  health: HealthPanel,
  space: SpacePanel,
  backup: BackupPanel,
  jobs: JobsPanel,
  restore: RestorePanel,
}
