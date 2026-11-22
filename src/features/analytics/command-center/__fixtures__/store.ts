/**
 * Test-only: a store profile answer in the shape `src/core/models/command-center.ts` proposes for BO 4177 (unbuilt).
 * The server writes the words in the asked language and the figures for the asked period; the fixture does the same,
 * so a test can see that a period change brings the other period's figures.
 */
import type { CcLang, CcPeriod, CcPeriodKind, CcProfileSection, CcStoreProfile } from '@/core/models/command-center'

const words = {
  en: {
    title: 'P166 · Jeddah',
    periods: { rolling4: 'Last 4 weeks, with the same weeks last year', ytd: 'Year to date', dates: 'Chosen dates' },
    titles: {
      headline: 'Headline and peers',
      mixCategory: 'Mix by category',
      mixPayer: 'Mix by payer type',
      mixPrivateLabel: 'Mix by private label',
      byMonth: 'By month',
      basket: 'Basket shape',
      payers: 'Sales by insurer and credit customer',
      products: 'Products',
      observations: 'Observations',
    },
    privateLabelReason: 'The item dimension does not carry the private label flag yet.',
    skin: 'Skin care',
    hair: 'Hair care',
    cash: 'Cash',
    insurance: 'Insurance',
    cols: { measure: 'Measure', own: 'This pharmacy', peers: 'Peer median', category: 'Category', sales: 'Sales', share: 'Share', item: 'Item' },
    salesMeasure: 'Sales',
    observation: ['Insurance is a far larger share of sales here than at its peers.'],
  },
  ar: {
    title: 'P166 · جدة',
    periods: { rolling4: 'آخر 4 أسابيع مع الأسابيع نفسها من العام الماضي', ytd: 'منذ بداية العام', dates: 'تواريخ مختارة' },
    titles: {
      headline: 'الملخص والأقران',
      mixCategory: 'المزيج حسب الفئة',
      mixPayer: 'المزيج حسب نوع الدافع',
      mixPrivateLabel: 'المزيج حسب العلامة الخاصة',
      byMonth: 'حسب الشهر',
      basket: 'شكل السلة',
      payers: 'المبيعات حسب شركة التأمين وعميل الائتمان',
      products: 'المنتجات',
      observations: 'ملاحظات',
    },
    privateLabelReason: 'بُعد الأصناف لا يحمل علامة العلامة الخاصة بعد.',
    skin: 'العناية بالبشرة',
    hair: 'العناية بالشعر',
    cash: 'نقدي',
    insurance: 'تأمين',
    cols: { measure: 'المقياس', own: 'هذه الصيدلية', peers: 'وسيط الأقران', category: 'الفئة', sales: 'المبيعات', share: 'الحصة', item: 'الصنف' },
    salesMeasure: 'المبيعات',
    observation: ['حصة التأمين من المبيعات هنا أكبر بكثير منها لدى أقرانها.'],
  },
} as const

/** The period's own figures: the server reads them live for the asked period. */
const figures = (kind: CcPeriodKind) =>
  kind === 'ytd'
    ? { sales: 'SAR 4.9 m', peers: 'SAR 4.1 m', skin: 'SAR 610,000' }
    : kind === 'dates'
      ? { sales: 'SAR 233,000', peers: 'SAR 198,000', skin: 'SAR 29,100' }
      : { sales: 'SAR 412,000', peers: 'SAR 355,000', skin: 'SAR 51,800' }

const periods: Record<CcPeriodKind, Omit<CcPeriod, 'label'>> = {
  rolling4: { kind: 'rolling4', from: '2026-10-25', to: '2026-11-21', compareFrom: '2025-10-26', compareTo: '2025-11-22' },
  ytd: { kind: 'ytd', from: '2026-01-01', to: '2026-11-21', compareFrom: '2025-01-01', compareTo: '2025-11-21' },
  dates: { kind: 'dates', from: '2026-10-01', to: '2026-10-14', compareFrom: '2025-10-01', compareTo: '2025-10-14' },
}

export function storeFixture({ lang = 'en', period = 'rolling4' }: { lang?: CcLang; period?: CcPeriodKind } = {}): CcStoreProfile {
  const w = words[lang]
  const f = figures(period)
  const sections: CcProfileSection[] = [
    {
      key: 'headline',
      title: w.titles.headline,
      state: 'ok',
      tables: [
        {
          columns: [
            { key: 'measure', label: w.cols.measure, kind: 'text' },
            { key: 'own', label: w.cols.own, kind: 'money' },
            { key: 'peers', label: w.cols.peers, kind: 'money' },
          ],
          rows: [{ measure: { text: w.salesMeasure }, own: { text: f.sales }, peers: { text: f.peers } }],
          moneyInclVat: true,
        },
      ],
    },
    {
      key: 'mixCategory',
      title: w.titles.mixCategory,
      state: 'ok',
      tables: [
        {
          columns: [
            { key: 'category', label: w.cols.category, kind: 'text' },
            { key: 'sales', label: w.cols.sales, kind: 'money' },
            { key: 'share', label: w.cols.share, kind: 'percent' },
          ],
          rows: [
            { category: { text: w.skin, target: { kind: 'category', level: 'top', code: 'C07' } }, sales: { text: f.skin }, share: { text: '12.6%' } },
            { category: { text: w.hair, target: { kind: 'category', level: 'top', code: 'C09' } }, sales: { text: 'SAR 30,200' }, share: { text: '7.3%' } },
          ],
          moneyInclVat: true,
        },
      ],
    },
    {
      key: 'mixPayer',
      title: w.titles.mixPayer,
      state: 'ok',
      tables: [
        {
          columns: [
            { key: 'payer', label: w.cols.category, kind: 'text' },
            { key: 'share', label: w.cols.share, kind: 'percent' },
          ],
          rows: [
            { payer: { text: w.cash }, share: { text: '38%' } },
            { payer: { text: w.insurance }, share: { text: '62%' } },
          ],
        },
      ],
    },
    { key: 'mixPrivateLabel', title: w.titles.mixPrivateLabel, state: 'not-available-yet', reason: w.privateLabelReason, tables: [] },
    {
      key: 'products',
      title: w.titles.products,
      state: 'ok',
      tables: [
        {
          columns: [
            { key: 'item', label: w.cols.item, kind: 'code' },
            { key: 'sales', label: w.cols.sales, kind: 'money' },
          ],
          rows: [
            { item: { text: '100234' }, sales: { text: 'SAR 9,800' } },
            { item: { text: '100877' }, sales: { text: 'SAR 1,200' } },
          ],
          moneyInclVat: true,
          cut80: 1,
        },
      ],
    },
    { key: 'observations', title: w.titles.observations, state: 'ok', tables: [], sentences: [[{ text: w.observation[0] }]] },
  ]
  return { lang, storeCode: 'P166', title: w.title, period: { ...periods[period], label: w.periods[period] }, sections }
}
