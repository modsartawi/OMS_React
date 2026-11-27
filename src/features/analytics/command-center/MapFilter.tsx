import { CC_FILTERS, type CcFilter } from '@/core/models/command-center'
import Chip from '@/core/ui/Chip'
import type { CcT } from './lang'

/**
 * The map's filter (oms 947, spec 4165 story 29): all issues, sales, stock or delivery, as four chips with the chosen one
 * pressed. It changes the points, the shading and the region table together (`./map-view`).
 */
export default function MapFilter({ filter, onChange, t }: { filter: CcFilter; onChange: (filter: CcFilter) => void; t: CcT }) {
  return (
    <div className="flex flex-wrap items-center gap-1" role="group" aria-label={t('map.filter.label')}>
      {CC_FILTERS.map((option) => (
        <Chip key={option} on={option === filter} onClick={() => option !== filter && onChange(option)} data-cc-filter={option}>
          {t(`map.filter.${option}`)}
        </Chip>
      ))}
    </div>
  )
}
