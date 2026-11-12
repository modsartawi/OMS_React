import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { ICellRendererParams, ValueFormatterParams } from 'ag-grid-community'
import { describe, expect, it } from 'vitest'
import CellBar from './CellBar'
import type { TableChartColumn } from './TableChart'
import { compareSentFigures, sentFigure, tableColumnDefs, type TableRow } from './table-columns'

// Ticket 878 (BackOffice spec 3587 B22): a column of the server's own texts is shown as sent and sorted by number.

const COLUMNS: TableChartColumn[] = [
  { key: 'city', role: 'dimension', label: 'City' },
  { key: 'deliveries', role: 'measure', label: 'Deliveries', unit: 'count', max: 1204, tooltip: 'By delivery date' },
  { key: 'share', role: 'measure', label: 'Share of the change', asSent: true },
]

type Compare = (a: unknown, b: unknown) => number
const defOf = (key: string, sort: { key: string; direction: 'asc' | 'desc' } | null = null) => tableColumnDefs(COLUMNS, sort, 'en').find((d) => d.colId === key)!
const sortedBy = (texts: (string | null)[], compare: Compare) => [...texts].sort(compare)

describe('the number a sent text holds', () => {
  it('readsAPlainFigure_APercent_ASign_AndThousands', () => {
    expect(sentFigure('3000')).toBe(3000)
    expect(sentFigure('1500.5')).toBe(1500.5)
    expect(sentFigure('-620')).toBe(-620)
    expect(sentFigure('62.0%')).toBe(62)
    expect(sentFigure('-3.0%')).toBe(-3)
    expect(sentFigure('+30')).toBe(30)
    expect(sentFigure('−620')).toBe(-620) // a typographic minus
    expect(sentFigure('1,204,000.5')).toBe(1204000.5)
    expect(sentFigure('SAR 1,200.00')).toBe(1200)
    expect(sentFigure('3 of 11')).toBe(3)
    expect(sentFigure(12)).toBe(12)
  })

  it('aTextWithNoFigure_holdsNone', () => {
    for (const v of [null, undefined, '', '  ', 'not available', '%', Number.NaN]) expect(sentFigure(v)).toBeNull()
  })
})

describe('sorting a column of sent texts', () => {
  it('sortsByNumber_notByText', () => {
    const shares = ['62.0%', '9.5%', '100.0%', '-3.0%', '25.0%']
    // As text these would read -3.0%, 100.0%, 25.0%, 62.0%, 9.5%.
    expect(sortedBy(shares, compareSentFigures)).toEqual(['-3.0%', '9.5%', '25.0%', '62.0%', '100.0%'])
    const changes = ['-620', '30', '-70', '-1500', '5']
    expect(sortedBy(changes, compareSentFigures)).toEqual(['-1500', '-620', '-70', '5', '30'])
  })

  it('aCellWithNoFigure_sortsBelowEveryFigure_asAnEmptyGridCellDoes', () => {
    expect(sortedBy(['5', null, '-70', 'n/a'], compareSentFigures)).toEqual([null, 'n/a', '-70', '5'])
    expect(compareSentFigures(null, 'n/a')).toBe(0)
    expect(compareSentFigures('7.0%', '7%')).toBe(0)
  })
})

describe("the table form's columns", () => {
  it('aSentColumn_isShownAsSent_andSortedByNumber', () => {
    const share = defOf('share')
    // No formatter: the grid shows the cell's own text.
    expect(share.valueFormatter).toBeUndefined()
    expect(share.comparator).toBe(compareSentFigures)
    expect(share.cellRenderer).toBe(CellBar)
    expect(share.field).toBe('share')
    expect(share.headerName).toContain('Share of the change')
  })

  it('aSentCell_isDrawnWithItsTextUntouched_isolated_withNoBar', () => {
    const share = defOf('share')
    const html = renderToStaticMarkup(createElement(CellBar, { value: '62.0%', valueFormatted: null, ...(share.cellRendererParams as object) } as unknown as ICellRendererParams & { max: number }))
    expect(html).toContain('<bdi dir="ltr">62.0%</bdi>')
    expect(html).toContain('data-cell-bar="0"')
  })

  it('anOrdinaryMeasureColumn_isAsBefore_formattedByItsUnit_sortedByItsNumber', () => {
    const deliveries = defOf('deliveries', { key: 'deliveries', direction: 'desc' })
    const format = deliveries.valueFormatter as (p: ValueFormatterParams<TableRow>) => string
    expect(format({ value: 1204 } as ValueFormatterParams<TableRow>)).toBe('1,204')
    expect(format({ value: null } as ValueFormatterParams<TableRow>)).toBe('')
    expect(deliveries.comparator).toBeUndefined()
    expect(deliveries.cellRenderer).toBe(CellBar)
    expect(deliveries.cellRendererParams).toEqual({ max: 1204 })
    expect(deliveries.sort).toBe('desc')
    expect(deliveries.headerTooltip).toContain('By delivery date')
    expect(defOf('share', { key: 'deliveries', direction: 'desc' }).sort).toBeNull()
  })

  it('aDimensionColumn_isAsBefore', () => {
    const city = defOf('city')
    expect(city.valueFormatter).toBeUndefined()
    expect(city.comparator).toBeUndefined()
    expect(city.cellRenderer).toBeUndefined()
    expect(city).toMatchObject({ colId: 'city', field: 'city', flex: 1, minWidth: 140, sort: null })
  })
})
