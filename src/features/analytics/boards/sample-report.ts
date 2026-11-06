import type { AnalyticsLabel, AnalyticsReportBlock, AnalyticsReportDefinition, AnalyticsSeries, AnalyticsViewDefinition } from '@/core/models/analytics'

/**
 * The finished report the tutorial builds (spec 819's acceptance case; 798's `sampleReport`, ticket 831) — pure, in
 * the real model's keys. It is product code: "Load the finished report" puts it in the designer as one undoable step.
 *
 * Sales by channel (net sales by channel as bars, and a sentence with the total), HungerStation against QC (their
 * net sales — the acceptance case's "for value" (834) — and their cancellation rates, as two named series each,
 * with a sentence of their four figures), the stores, and the AI summary. The period is a parameter that defaults
 * to yesterday and reaches every panel.
 *
 * Keys the tutorial's checks look for (`./tutorial`) are named here once.
 */
export const NET_SALES = 'till_value'
export const CHANNEL = 'channel_group'
export const DELIVERY_TYPE = 'delivery_type'
export const HUNGERSTATION = 'hungerstation'
export const QC = 'QC'
export const CANCELLATION_RATE = 'cancellation_rate'

/** What "Load the finished report" sets: the report's words and its definition (the designer's draft). */
export interface SampleReport {
  title: AnalyticsLabel
  subtitle: AnalyticsLabel
  definition: AnalyticsReportDefinition
}

const label = (en: string, ar: string): AnalyticsLabel => ({ en, ar })

const SERIES: AnalyticsSeries[] = [
  { id: 'hs', label: label('HungerStation', 'هنقرستيشن'), filters: [{ dimension: CHANNEL, values: [HUNGERSTATION] }] },
  { id: 'qc', label: label('QC', 'التوصيل السريع'), filters: [{ dimension: DELIVERY_TYPE, values: [QC] }] },
]

const view = (type: AnalyticsViewDefinition['chart']['type'], measures: string[], dimensions: string[], extra: Partial<AnalyticsViewDefinition> = {}): AnalyticsViewDefinition => ({
  chart: { type, ...(type === 'bar' ? { orientation: 'vertical' } : {}) },
  query: { measures, dimensions, filters: [], period: 'yesterday' },
  ...extra,
})

const panel = (id: string, title: AnalyticsLabel, definition: AnalyticsViewDefinition): AnalyticsReportBlock => ({ id, kind: 'panel', title, definition })

export function sampleReport(): SampleReport {
  return {
    title: label('Channel sales: HungerStation against QC', 'مبيعات القنوات: هنقرستيشن مقابل QC'),
    subtitle: label('', ''),
    definition: {
      params: [
        { name: 'period', kind: 'period', label: label('Period', 'الفترة'), required: true, default: { kind: 'period', token: 'yesterday' } },
        { name: 'city', kind: 'members', label: label('City', 'المدينة'), required: false, dimension: 'city', pinned: null, multi: true, default: { kind: 'members', values: [] } },
        { name: 'grain', kind: 'grain', label: label('By', 'حسب'), required: true, grains: ['day', 'week'], default: { kind: 'grain', grain: 'day' } },
      ],
      bindings: {
        period: { p1: true, p2: true, p3: true, p4: true },
        city: { p1: 'city', p2: 'city', p4: 'city' },
        grain: { p2: true, p3: true },
      },
      sections: [
        {
          id: 's1',
          heading: label('Sales by channel', 'المبيعات حسب القناة'),
          blocks: [
            panel('p1', label('Net sales by channel', 'صافي المبيعات حسب القناة'), view('bar', [NET_SALES], [CHANNEL])),
            { id: 't1', kind: 'text', text: label('Across every channel the tills took {p1:total} in the period.', 'حصّلت نقاط البيع {p1:total} عبر جميع القنوات خلال الفترة.') },
          ],
        },
        {
          id: 's2',
          heading: label('HungerStation against QC', 'هنقرستيشن مقابل QC'),
          blocks: [
            panel('p2', label('Net sales: HungerStation against QC', 'صافي المبيعات: هنقرستيشن مقابل QC'), view('bar', [NET_SALES], ['day'], { series: SERIES })),
            panel('p3', label('Cancellation rate: HungerStation against QC', 'نسبة الإلغاء: هنقرستيشن مقابل QC'), view('line', [CANCELLATION_RATE], ['day'], { series: SERIES })),
            {
              id: 't2',
              kind: 'text',
              text: label(
                'HungerStation sold {p2:hs} against QC’s {p2:qc}. Their cancellation rates were {p3:hs} and {p3:qc}.',
                'باعت هنقرستيشن بقيمة {p2:hs} مقابل {p2:qc} لـ QC. وكانت نسبتا الإلغاء {p3:hs} و{p3:qc}.',
              ),
            },
          ],
        },
        { id: 's3', heading: label('Stores', 'الصيدليات'), blocks: [panel('p4', label('', ''), view('table', ['orders', NET_SALES], ['store']))] },
        { id: 's4', heading: label('Summary', 'الملخص'), blocks: [{ id: 'sum', kind: 'summary' }] },
      ],
    },
  }
}
