/**
 * Test-only: a category profile answer in the shape `src/core/models/command-center.ts` proposes for BO 4178 (unbuilt).
 * The server writes the words in the asked language and the figures for the asked narrowing; the fixture does the same,
 * so a test can see that every section carries the narrowing's figures.
 */
import type { CcCategoryLevel, CcCategoryProfile, CcLang, CcProfileSection, CcScope } from '@/core/models/command-center'

const words = {
  en: {
    skin: 'Skin care',
    face: 'Face care',
    sun: 'Sun care',
    hair: 'Hair care',
    chain: 'The chain',
    west: 'West',
    central: 'Central',
    store: 'P166 · Jeddah',
    period: 'Last 4 weeks',
    titles: ['Sales and share', 'Product health', 'Promotion', 'Pharmacies over and under', 'Regions over and under'],
    missing: ['Margin', 'Availability', 'Price index', 'Private label'],
    reasons: [
      'Cost is not in the warehouse yet.',
      'Stock-outs by day are not captured yet.',
      'The price survey is not loaded yet.',
      'The item dimension does not carry the private label flag yet.',
    ],
    cols: ['Category', 'Sales', 'Units', 'Growth', 'Share'],
  },
  ar: {
    skin: 'العناية بالبشرة',
    face: 'العناية بالوجه',
    sun: 'الحماية من الشمس',
    hair: 'العناية بالشعر',
    chain: 'السلسلة',
    west: 'الغربية',
    central: 'الوسطى',
    store: 'P166 · جدة',
    period: 'آخر 4 أسابيع',
    titles: ['المبيعات والحصة', 'صحة المنتجات', 'العروض', 'الصيدليات فوق ودون', 'المناطق فوق ودون'],
    missing: ['الهامش', 'التوفر', 'مؤشر السعر', 'العلامة الخاصة'],
    reasons: [
      'التكلفة ليست في المستودع بعد.',
      'نفاد المخزون باليوم غير مسجّل بعد.',
      'مسح الأسعار غير محمّل بعد.',
      'بُعد الأصناف لا يحمل علامة العلامة الخاصة بعد.',
    ],
    cols: ['الفئة', 'المبيعات', 'الوحدات', 'النمو', 'الحصة'],
  },
} as const

/** The narrowing's own figures: the server reads them live for the asked chain, region or pharmacy. */
const figures = (scope: CcScope) =>
  scope.kind === 'store'
    ? { sales: 'SAR 38,400', units: '1,210', stock: 'SAR 61,000', promo: '22%' }
    : scope.kind === 'region'
      ? { sales: 'SAR 1.1 m', units: '35,800', stock: 'SAR 1.9 m', promo: '27%' }
      : { sales: 'SAR 4.2 m', units: '131,500', stock: 'SAR 7.6 m', promo: '25%' }

export function categoryFixture({
  lang = 'en',
  level = 'top',
  scope = { kind: 'chain' },
}: { lang?: CcLang; level?: CcCategoryLevel; scope?: CcScope } = {}): CcCategoryProfile {
  const w = words[lang]
  const f = figures(scope)
  const col = (key: string, i: number, kind: 'text' | 'money' | 'count' | 'percent' | 'code') => ({ key, label: w.cols[i], kind })
  const label = scope.kind === 'store' ? w.store : scope.kind === 'region' ? w.west : w.chain
  const sections: CcProfileSection[] = [
    {
      key: 'share',
      title: w.titles[0],
      state: 'ok',
      tables: [
        {
          columns: [col('category', 0, 'text'), col('sales', 1, 'money'), col('units', 2, 'count'), col('growth', 3, 'percent'), col('share', 4, 'percent')],
          rows: [
            { category: { text: level === 'top' ? w.skin : w.face }, sales: { text: f.sales }, units: { text: f.units }, growth: { text: '+4.1%' }, share: { text: '11.2%' } },
            {
              category: { text: w.hair, target: { kind: 'category', level: 'top', code: 'C09', scope } },
              sales: { text: 'SAR 3.0 m' },
              units: { text: '98,000' },
              growth: { text: '-1.3%' },
              share: { text: '8.0%' },
            },
          ],
          moneyInclVat: true,
        },
      ],
    },
    {
      key: 'health',
      title: w.titles[1],
      state: 'ok',
      tables: [
        {
          columns: [
            { key: 'class', label: w.cols[0], kind: 'text' },
            { key: 'count', label: w.cols[2], kind: 'count' },
            { key: 'stock', label: w.cols[1], kind: 'money' },
          ],
          rows: [{ class: { text: 'Star' }, count: { text: '214' }, stock: { text: f.stock } }],
          moneyInclVat: true,
        },
      ],
    },
    {
      key: 'promotion',
      title: w.titles[2],
      state: 'ok',
      tables: [
        {
          columns: [
            { key: 'share', label: w.cols[4], kind: 'percent' },
            { key: 'discount', label: w.cols[1], kind: 'money' },
          ],
          rows: [{ share: { text: f.promo }, discount: { text: 'SAR 96,000' } }],
          moneyInclVat: true,
        },
      ],
    },
    {
      key: 'overUnderStores',
      title: w.titles[3],
      state: 'ok',
      tables: [
        {
          columns: [
            { key: 'store', label: 'Pharmacy', kind: 'code' },
            { key: 'gap', label: w.cols[4], kind: 'percent' },
          ],
          rows: [
            { store: { text: 'P166', target: { kind: 'store', storeCode: 'P166' } }, gap: { text: '+3.4 pts' } },
            { store: { text: 'P412', target: { kind: 'store', storeCode: 'P412' } }, gap: { text: '-2.9 pts' } },
          ],
        },
      ],
    },
    {
      key: 'overUnderRegions',
      title: w.titles[4],
      state: 'ok',
      tables: [
        {
          columns: [
            { key: 'region', label: w.cols[0], kind: 'text' },
            { key: 'gap', label: w.cols[4], kind: 'percent' },
          ],
          rows: [{ region: { text: w.west }, gap: { text: '+1.1 pts' } }],
        },
      ],
    },
    ...(['margin', 'availability', 'priceIndex', 'privateLabel'] as const).map(
      (key, i): CcProfileSection => ({ key, title: w.missing[i], state: 'not-available-yet', reason: w.reasons[i], tables: [] }),
    ),
  ]
  return {
    lang,
    level,
    category: level === 'top' ? { code: 'C07', name: w.skin } : { code: 'C0701', name: w.face },
    parent: level === 'second' ? { code: 'C07', name: w.skin } : undefined,
    unclassified: false,
    scope: { ...scope, label },
    period: { kind: 'rolling4', label: w.period, from: '2026-10-25', to: '2026-11-21', compareFrom: '2025-10-26', compareTo: '2025-11-22' },
    children:
      level === 'top'
        ? [
            { code: 'C0701', name: w.face },
            { code: 'C0702', name: w.sun },
          ]
        : undefined,
    regions: [
      { region: 'WEST', name: w.west },
      { region: 'CENTRAL', name: w.central },
    ],
    sections,
  }
}
