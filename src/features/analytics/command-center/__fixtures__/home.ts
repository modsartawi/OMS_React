/**
 * Test-only: one home answer per language, in the shape `src/core/models/command-center.ts` proposes for BO 4176
 * (unbuilt). The words differ by language because the server writes them; the figures and colours are the server's too.
 * Later tickets' tests (947-950) reuse it.
 */
import type { CcLang, CcSection, CommandCenterHome } from '@/core/models/command-center'

const words = {
  en: {
    headline: 'Yesterday the chain sold above its 4-week pace; ',
    headlineTail: ' slipped against its peers.',
    figures: ["Yesterday's sales", "Yesterday's receipts", '4-week basket', "Yesterday's orders"],
    changed: 'is newly flagged: sales growth is 9 points under its peers.',
    changedCat: 'Skin care moved share: ',
    risks: 'holds dead stock at cost.',
    opp: 'can rebalance stock to its region.',
    slipped: '3 pharmacies slipped, 2 improved.',
    products: 'Product health needs 180 days of item sales.',
    categories: '2 categories moved share by 0.4 points or more.',
    omni: 'Delivery orders rose 6% on last week.',
    runs: ['Scorecards', 'Product health', 'Brief published'],
    category: 'Skin care',
  },
  ar: {
    headline: 'باعت السلسلة أمس فوق وتيرتها لأربعة أسابيع؛ ',
    headlineTail: ' تراجعت أمام نظيراتها.',
    figures: ['مبيعات الأمس', 'فواتير الأمس', 'سلة 4 أسابيع', 'طلبات الأمس'],
    changed: 'أُشّرت حديثًا: نمو المبيعات أقل من نظيراتها بـ 9 نقاط.',
    changedCat: 'تغيّرت حصة العناية بالبشرة: ',
    risks: 'لديها مخزون راكد بالتكلفة.',
    opp: 'يمكنها إعادة توزيع المخزون في منطقتها.',
    slipped: 'تراجعت 3 صيدليات وتحسنت 2.',
    products: 'تحتاج صحة المنتجات إلى 180 يومًا من مبيعات الأصناف.',
    categories: 'تغيرت حصة فئتين بـ 0.4 نقطة أو أكثر.',
    omni: 'ارتفعت طلبات التوصيل 6% عن الأسبوع الماضي.',
    runs: ['بطاقات الأداء', 'صحة المنتجات', 'نُشر الموجز'],
    category: 'العناية بالبشرة',
  },
} as const

export function homeFixture(lang: CcLang): CommandCenterHome {
  const w = words[lang]
  const open = (key: CcSection['key'], lines: CcSection['lines'], extra: Partial<CcSection> = {}): CcSection => ({
    key,
    folded: false,
    state: 'ok',
    dataAsOf: '2026-11-21',
    lastGoodDate: null,
    lines,
    ...extra,
  })
  const folded = (key: CcSection['key'], summary: string, extra: Partial<CcSection> = {}): CcSection => ({
    ...open(key, [], extra),
    folded: true,
    summary,
    ...extra,
  })
  return {
    lang,
    night: '2026-11-21',
    isLatest: true,
    dataAsOf: '2026-11-20',
    runs: [
      { agent: 'scorecard', label: w.runs[0], state: 'done', finishedAt: '2026-11-22T02:14:00', dot: 'green' },
      { agent: 'product-health', label: w.runs[1], state: 'failed', finishedAt: '2026-11-22T03:05:00', dot: 'red' },
      { agent: 'brief', label: w.runs[2], state: 'done', finishedAt: '2026-11-22T05:40:00', dot: 'green' },
    ],
    brief: {
      modelWrote: true,
      sections: [
        open('headline', [], {
          headline: {
            parts: [{ text: w.headline }, { text: 'P210', target: { kind: 'store', storeCode: 'P210' } }, { text: w.headlineTail }],
            figures: [
              { label: w.figures[0], value: 'SAR 12.4 m' },
              { label: w.figures[1], value: '182,340' },
              { label: w.figures[2], value: 'SAR 68.10' },
              { label: w.figures[3], value: '9,812' },
            ],
          },
        }),
        open('changed', [
          {
            findingId: 'f-changed-1',
            parts: [{ text: 'P166', target: { kind: 'store', storeCode: 'P166' } }, { text: ` ${w.changed}` }],
            money: 'SAR 1.2 m',
            tone: 'red',
            ask: { question: 'Why is P166 flagged?', findingId: 'f-changed-1' },
          },
          {
            findingId: 'f-changed-2',
            parts: [{ text: w.changedCat }, { text: w.category, target: { kind: 'category', level: 'top', code: 'C07' } }],
            money: 'SAR 310 k',
            tone: 'amber',
          },
        ]),
        open('risks', [
          {
            findingId: 'f-risk-1',
            parts: [{ text: 'P031', target: { kind: 'store', storeCode: 'P031' } }, { text: ` ${w.risks}` }],
            money: 'SAR 840 k',
            tone: 'red',
          },
        ]),
        open('opportunities', [
          {
            findingId: 'f-opp-1',
            parts: [{ text: 'P402', target: { kind: 'store', storeCode: 'P402' } }, { text: ` ${w.opp}` }],
            money: 'SAR 220 k',
            tone: 'green',
          },
        ]),
        folded('slipped', w.slipped),
        folded('products', w.products, {
          state: 'not-available',
          dataAsOf: null,
          lastGoodDate: '2026-11-19',
          reason: w.products,
          summary: undefined,
        }),
        folded('categories', w.categories),
        folded('omni', w.omni),
      ],
    },
    regions: [],
    points: [],
    notOnMap: 0,
  }
}
