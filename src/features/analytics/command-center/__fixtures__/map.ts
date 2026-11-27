/**
 * Test-only (oms 947): the home answer with its map half filled — the region table under each filter, the pharmacies'
 * points with their stored colours, one pharmacy with no coordinates, and the map key — in the shape
 * `src/core/models/command-center.ts` proposes for BO 4176 (unbuilt). Built on 946's `homeFixture`, so the brief is the same.
 */
import type { CcFilter, CcLang, CcRegionFigures, CcRegionRow, CommandCenterHome } from '@/core/models/command-center'
import { homeFixture } from './home'

const names: Record<CcLang, Record<string, string>> = {
  en: { Center: 'Center', East: 'East', North: 'North', South: 'South', West: 'West', BH: 'Bahrain' },
  ar: { Center: 'الوسطى', East: 'الشرقية', North: 'الشمالية', South: 'الجنوبية', West: 'الغربية', BH: 'البحرين' },
}

const f = (scored: number, flagged: number, share: string, shade: CcRegionFigures['shade']): CcRegionFigures => ({ scored, flagged, share, shade })

/** Each region's figures under each filter, as the server counted them. */
const figures: Record<string, Record<CcFilter, CcRegionFigures>> = {
  Center: { all: f(260, 100, '38%', 4), sales: f(260, 71, '27%', 3), stock: f(258, 22, '9%', 1), delivery: f(201, 14, '7%', 1) },
  East: { all: f(377, 148, '39%', 4), sales: f(377, 96, '25%', 3), stock: f(370, 61, '16%', 2), delivery: f(300, 40, '13%', 2) },
  North: { all: f(120, 50, '42%', 5), sales: f(120, 33, '28%', 3), stock: f(119, 12, '10%', 1), delivery: f(80, 30, '38%', 4) },
  South: { all: f(108, 44, '41%', 5), sales: f(108, 20, '19%', 2), stock: f(108, 41, '38%', 4), delivery: f(70, 9, '13%', 2) },
  West: { all: f(103, 36, '35%', 3), sales: f(103, 30, '29%', 3), stock: f(101, 5, '5%', 1), delivery: f(90, 11, '12%', 2) },
  BH: { all: f(2, 0, '0%', 0), sales: f(2, 0, '0%', 0), stock: f(2, 0, '0%', 0), delivery: f(0, 0, '0%', 0) },
}

export function mapHomeFixture(lang: CcLang = 'en'): CommandCenterHome {
  const regions: CcRegionRow[] = Object.keys(figures).map((region) => ({ region, name: names[lang][region], byFilter: figures[region] }))
  return {
    ...homeFixture(lang),
    regions,
    points: [
      { storeCode: 'P166', lat: 24.71, lon: 46.68, region: 'Center', colour: { all: 'red', sales: 'red', stock: 'green', delivery: 'amber' } },
      { storeCode: 'P031', lat: 26.43, lon: 50.1, region: 'East', colour: { all: 'amber', sales: 'green', stock: 'red', delivery: 'green' } },
      { storeCode: 'P402', lat: 21.54, lon: 39.17, region: 'West', colour: { all: 'green', sales: 'green', stock: 'green', delivery: null } },
      { storeCode: 'B002', lat: 26.22, lon: 50.58, region: 'BH', colour: { all: 'green', sales: 'green', stock: 'amber', delivery: null } },
    ],
    notOnMap: 1,
    maps: { key: 'planted-test-key' },
  }
}
