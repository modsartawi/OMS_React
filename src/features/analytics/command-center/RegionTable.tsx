import type { CcRegionKey } from '@/core/models/command-center'
import Button from '@/core/ui/Button'
import Ltr from '@/core/ui/Ltr'
import type { CcT } from './lang'
import type { RegionTableRow } from './map-view'

/**
 * The region table beside the map (oms 947, spec 4165 story 30): per region and Bahrain, the pharmacies scored, the
 * flagged count and their share, under the map's filter, as the server counted them. A plain table, not AG Grid: the
 * page lays itself out right to left live (`?lang=ar`), which a mounted grid would not follow. Choosing a region zooms
 * the map to it, as tapping its shape does.
 */
export default function RegionTable({
  rows,
  selected,
  onSelect,
  t,
}: {
  rows: readonly RegionTableRow[]
  selected: CcRegionKey | null
  onSelect: (region: CcRegionKey) => void
  t: CcT
}) {
  return (
    <table className="w-full text-sm" data-cc-regions>
      <caption className="sr-only">{t('regions.caption')}</caption>
      <thead>
        <tr className="border-b border-border/60 text-xs text-muted-foreground">
          <th scope="col" className="py-1.5 text-start font-medium">
            {t('regions.region')}
          </th>
          <th scope="col" className="py-1.5 text-end font-medium">
            {t('regions.scored')}
          </th>
          <th scope="col" className="py-1.5 text-end font-medium">
            {t('regions.flagged')}
          </th>
          <th scope="col" className="py-1.5 text-end font-medium">
            {t('regions.share')}
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.region} className="border-b border-border/40 last:border-0" data-cc-region={row.region}>
            <th scope="row" className="py-1 text-start font-normal">
              <Button variant="ghost" aria-pressed={row.region === selected} onClick={() => onSelect(row.region)} data-cc-region-select={row.region}>
                <bdi>{row.name}</bdi>
              </Button>
            </th>
            <td className="py-1 text-end tabular-nums">
              <Ltr>{row.scored}</Ltr>
            </td>
            <td className="py-1 text-end tabular-nums">
              <Ltr>{row.flagged}</Ltr>
            </td>
            <td className="py-1 text-end tabular-nums">
              <Ltr>{row.share}</Ltr>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
