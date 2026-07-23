import type {
  ColDef,
  ColGroupDef,
  ICellRendererParams,
  ValueFormatterParams,
} from 'ag-grid-community'
import type { TFunction } from 'i18next'
import { useTranslation } from 'react-i18next'
import { ChevronRight } from 'lucide-react'
import type { BbyInquiryRow } from '@/core/models/bonus-buy-inquiry'
import { codeLabelKey, type CodeSet } from './codeLabels'
import {
  formatBbyDate,
  formatBbyTime,
  formatBool,
  formatIsoDate,
  formatNumber,
} from './formatters'

// The FULL 28-field BBY inquiry grid (spec 061, ticket 063) — the operator's
// scan/filter/export surface. All formatting/label logic lives in the pure
// `formatters` + `codeLabels` modules (testable in-memory); the column defs only
// wire those pure fns to `valueFormatter`s and small presentational renderers.
//
// Raw row values are NEVER mutated — every formatter is display-only — so CSV export
// (065) still dumps the raw `yyyyMMdd` dates, `HHMMSS` times and single-letter codes.
//
// 28 columns: the pinned identity column (bbyNumber) + 27 columns across six groups —
// Identity & offer · Validity · Buy/Get rules · Stacking · Loyalty · Audit.

/** Default per-column behaviour. `floatingFilter` (the WPF `ShowAutoFilterRow`) is
 *  toggled by the page — `buildDefaultColDef(showFilters)` rebuilds this so the filter
 *  row appears/hides on demand. `cellDataType:false` stops AG Grid rendering booleans
 *  as its built-in checkbox so our ✓/– formatter wins. */
export function buildDefaultColDef(showFilters: boolean): ColDef<BbyInquiryRow> {
  return {
    sortable: true,
    resizable: true,
    filter: 'agTextColumnFilter',
    floatingFilter: showFilters,
    cellDataType: false,
  }
}

/** Resolve a raw code to its readable label via the pure `codeLabelKey` +
 *  `t(key, { defaultValue: raw })` — an unknown code renders raw. The single seam every
 *  chip/badge in this grid shares (namespace-qualified so it's `t`-source-independent). */
function codeText(t: TFunction, set: CodeSet, raw: string): string {
  return raw === '' ? '' : t(`bonus-buy-inquiry:${codeLabelKey(set, raw)}`, { defaultValue: raw })
}

/** Status label — the one code set rendered as a colour-coded badge (not a plain chip). */
const statusLabel = (t: TFunction, code: string) => codeText(t, 'status', code)

/** A neutral code→label pill (story 22: raw codes render as readable chips). Used for
 *  the And/Or link and the condition-target codes; a cellRenderer (not a valueFormatter)
 *  so CSV export (065) still sees the raw code, not the label. */
function CodeChip({ label }: { label: string }) {
  if (!label) return null
  return (
    <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs text-foreground/80">
      {label}
    </span>
  )
}

const codeChip =
  (t: TFunction, set: CodeSet) => (p: ICellRendererParams<BbyInquiryRow, string>) => (
    <CodeChip label={codeText(t, set, p.value ?? '')} />
  )

/** Status A/I/D/X as a labelled, colour-coded badge — colour is redundant to the
 *  text, so it never carries meaning alone (WCAG). Rendered both here and in the
 *  pinned identity cell: this Status column is the sortable/filterable/exportable
 *  handle, the identity badge is the at-a-glance marker. */
const STATUS_TONE: Record<string, string> = {
  A: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  I: 'bg-muted text-muted-foreground',
  D: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  X: 'bg-rose-500/15 text-rose-700 dark:text-rose-300',
}

function StatusBadge({ code, label }: { code: string; label: string }) {
  if (!code) return null
  const tone = STATUS_TONE[code] ?? 'bg-muted text-muted-foreground'
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${tone}`}
    >
      {label}
    </span>
  )
}

/** The pinned-start identity cell: status badge + "valid today" marker + BBY number +
 *  a Details ▸ action. The row stays readable while the operator scrolls the 27 other
 *  columns (story 21). The Details button renders + is clickable here; slice 066 wires
 *  it to the modal. Colour is never the only channel — title/aria carry the marker. */
function IdentityCell(
  p: ICellRendererParams<BbyInquiryRow>,
  onDetails: (row: BbyInquiryRow) => void,
) {
  const { t } = useTranslation('bonus-buy-inquiry')
  const row = p.data
  if (!row) return null
  return (
    <span className="flex items-center gap-2">
      <StatusBadge code={row.bbyStatus} label={statusLabel(t, row.bbyStatus)} />
      {row.isActive && (
        <span
          className="inline-block h-2 w-2 shrink-0 rounded-full bg-emerald-500"
          title={t('activeMarker.label')}
          aria-label={t('activeMarker.label')}
        />
      )}
      <span className="font-mono tabular-nums">{row.bbyNumber}</span>
      <button
        type="button"
        onClick={() => onDetails(row)}
        className="ms-auto inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium text-primary hover:bg-primary/10"
      >
        {t('actions.details')}
        <ChevronRight className="h-3 w-3" aria-hidden />
      </button>
    </span>
  )
}

/** Build the grouped column defs. `onDetails` is invoked by each row's Details
 *  button; `t` supplies every header/label/badge (zero-literal). */
export function buildInquiryColumns(
  t: TFunction,
  onDetails: (row: BbyInquiryRow) => void,
): (ColDef<BbyInquiryRow> | ColGroupDef<BbyInquiryRow>)[] {
  const dateCol = (field: keyof BbyInquiryRow): ColDef<BbyInquiryRow> => ({
    headerName: t(`columns.${field}`),
    field,
    width: 120,
    valueFormatter: (p: ValueFormatterParams<BbyInquiryRow, string>) => formatBbyDate(p.value),
  })
  const timeCol = (field: keyof BbyInquiryRow): ColDef<BbyInquiryRow> => ({
    headerName: t(`columns.${field}`),
    field,
    width: 100,
    valueFormatter: (p: ValueFormatterParams<BbyInquiryRow, string>) => formatBbyTime(p.value),
  })
  const codeCol = (
    field: keyof BbyInquiryRow,
    set: CodeSet,
    width = 130,
  ): ColDef<BbyInquiryRow> => ({
    headerName: t(`columns.${field}`),
    field,
    width,
    cellRenderer: codeChip(t, set),
  })
  const boolCol = (field: keyof BbyInquiryRow): ColDef<BbyInquiryRow> => ({
    headerName: t(`columns.${field}`),
    field,
    width: 110,
    valueFormatter: (p: ValueFormatterParams<BbyInquiryRow, boolean>) => formatBool(p.value),
  })
  const numCol = (field: keyof BbyInquiryRow, width = 110): ColDef<BbyInquiryRow> => ({
    headerName: t(`columns.${field}`),
    field,
    width,
    filter: 'agNumberColumnFilter',
    valueFormatter: (p: ValueFormatterParams<BbyInquiryRow, number>) => formatNumber(p.value),
  })
  const textCol = (field: keyof BbyInquiryRow, width = 150): ColDef<BbyInquiryRow> => ({
    headerName: t(`columns.${field}`),
    field,
    width,
  })

  return [
    // Sticky identity — pinned to the start (`'left'` is flipped to the visual end
    // under RTL by AG Grid's `enableRtl`). Text-filterable on the BBY number.
    {
      headerName: t('columns.identity'),
      field: 'bbyNumber',
      pinned: 'left',
      width: 260,
      filter: 'agTextColumnFilter',
      cellRenderer: (p: ICellRendererParams<BbyInquiryRow>) => IdentityCell(p, onDetails),
    },
    {
      headerName: t('groups.identity'),
      children: [
        {
          headerName: t('columns.bbyStatus'),
          field: 'bbyStatus',
          width: 130,
          cellRenderer: (p: ICellRendererParams<BbyInquiryRow, string>) => (
            <StatusBadge code={p.value ?? ''} label={statusLabel(t, p.value ?? '')} />
          ),
        },
        textCol('description', 260),
        textCol('bbyProfile', 110),
        textCol('promoNumber', 120),
        textCol('offerId', 110),
      ],
    },
    {
      headerName: t('groups.validity'),
      children: [
        dateCol('validFrom'),
        dateCol('validTo'),
        timeCol('validFromTime'),
        timeCol('validToTime'),
      ],
    },
    {
      headerName: t('groups.buyGet'),
      children: [
        codeCol('condTargetType', 'condTarget', 140),
        codeCol('linkCategoryBuy', 'link', 120),
        codeCol('linkCategoryGet', 'link', 120),
        numCol('limitNumber'),
        numCol('minValue'),
        numCol('maxValue'),
        textCol('includes', 160),
        textCol('excludes', 160),
      ],
    },
    {
      headerName: t('groups.stacking'),
      children: [
        boolCol('isStackable'),
        boolCol('allowNestedStacking'),
        textCol('stackingExcludes', 160),
        numCol('score'),
        textCol('originFilter', 130),
        textCol('priceListType', 120),
      ],
    },
    {
      headerName: t('groups.loyalty'),
      children: [textCol('loyGroups', 140), textCol('loyTiers', 140)],
    },
    {
      headerName: t('groups.audit'),
      children: [
        {
          headerName: t('columns.createdAt'),
          field: 'createdAt',
          width: 170,
          valueFormatter: (p: ValueFormatterParams<BbyInquiryRow, string>) =>
            formatIsoDate(p.value),
        },
        textCol('createdBy', 130),
      ],
    },
  ]
}
