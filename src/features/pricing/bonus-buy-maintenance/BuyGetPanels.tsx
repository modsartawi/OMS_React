import type { Dispatch, ReactNode, SetStateAction } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, TicketPlus, Trash2 } from 'lucide-react'
import Button from '@/core/ui/Button'
import Ltr from '@/core/ui/Ltr'
import { fsi } from '@/core/util/bidi'
import type { BbyGroupingWire } from '@/core/models/bonus-buy-maintenance'
import { INPUT } from './fields'
import {
  type BuyLine,
  buyPanelLayout,
  currPe,
  DEFAULT_UOM,
  DISCOUNT_TYPES,
  type DiscountType,
  type EditorState,
  emptyBuyLine,
  emptyGetLine,
  type GetColumn,
  type GetLine,
  getPanelLayout,
  LINK_CATEGORIES,
  type LineItemType,
  type LinkCategory,
  SCALE_TYPES,
  type ScaleType,
} from './editor'

/**
 * SAP's Bonus Buy Details: the Buy and Get panels (2330 §3–§4). The grids are plain tables of
 * inputs — editable rows, not a read grid — so the page's one disabled `<fieldset>` reaches every
 * cell in display. Buy-side discount columns, Requirement and Arb. Comb. are not offered.
 */

type SetState = Dispatch<SetStateAction<EditorState>>

const CELL = `${INPUT} h-7 w-full min-w-0`

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-2 rounded-md border border-border/60 p-3">
      <h3 className="text-sm font-semibold">{title}</h3>
      {children}
    </div>
  )
}

function LinkSelect({ label, value, onChange }: { label: string; value: LinkCategory; onChange: (v: LinkCategory) => void }) {
  const { t } = useTranslation('bonus-buy-maintenance')
  return (
    <label className="flex w-fit flex-col gap-1 text-xs font-medium text-muted-foreground">
      {label}
      <select className={`${INPUT} w-44`} value={value} onChange={(e) => onChange(e.target.value as LinkCategory)}>
        {LINK_CATEGORIES.map((c) => (
          <option key={c} value={c}>
            {t(`editor.link.${c}`)}
          </option>
        ))}
      </select>
    </label>
  )
}

/** Line Item Type decides how the identifier is picked: a typed material, or one of the bonus
 *  buy's own groupings (SAP's F4). */
function IdentifierCell({
  type,
  value,
  groupings,
  onChange,
  label,
}: {
  type: LineItemType
  value: string
  groupings: BbyGroupingWire[]
  onChange: (v: string) => void
  label: string
}) {
  const { t } = useTranslation('bonus-buy-maintenance')
  if (type === 'grouping')
    return (
      <select aria-label={label} className={CELL} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{t('editor.line.pickGrouping')}</option>
        {/* A grouping the read named but the list lacks still shows, so nothing is silently re-pointed. */}
        {value && !groupings.some((g) => g.id === value) && <option value={value}>{fsi(value)}</option>}
        {groupings.map((g) => (
          <option key={g.id} value={g.id}>
            {fsi(g.id)}
          </option>
        ))}
      </select>
    )
  return (
    <input
      aria-label={label}
      dir="ltr"
      className={`${CELL} font-mono`}
      value={value}
      onChange={(e) => onChange(e.target.value.trim())}
    />
  )
}

/**
 * The description beside an identifier. A grouping shows its member count. ⚠️ A material's
 * description has no door yet: `BbyMaintainWeb` offers no item lookup, so the cell stays empty
 * and the server's `BBY-MATERIAL-UNKNOWN` (on Check and Save) is what catches a mistyped one.
 */
function DescriptionCell({ type, identifier, groupings }: { type: LineItemType; identifier: string; groupings: BbyGroupingWire[] }) {
  const { t } = useTranslation('bonus-buy-maintenance')
  if (type !== 'grouping' || !identifier) return <span className="text-muted-foreground">{t('editor.line.noDescription')}</span>
  const g = groupings.find((x) => x.id === identifier)
  if (!g) return <span className="text-xs text-danger-800">{t('editor.line.groupingMissing')}</span>
  return (
    <span className="text-xs text-muted-foreground">
      {t('editor.line.members', { count: g.materials.length, n: fsi(String(g.materials.length)) })}
    </span>
  )
}

function TypeCell({ value, onChange, label }: { value: LineItemType; onChange: (v: LineItemType) => void; label: string }) {
  const { t } = useTranslation('bonus-buy-maintenance')
  return (
    <select aria-label={label} className={CELL} value={value} onChange={(e) => onChange(e.target.value as LineItemType)}>
      <option value="material">{t('editor.line.type.material')}</option>
      <option value="grouping">{t('editor.line.type.grouping')}</option>
    </select>
  )
}

function QuantityCell({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  return (
    <input
      aria-label={label}
      type="number"
      min={1}
      step={1}
      className={`${CELL} text-end`}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}

function UnitCell({ uom }: { uom: string }) {
  return (
    <span className="font-mono text-xs text-muted-foreground">
      <Ltr>{uom || DEFAULT_UOM}</Ltr>
    </span>
  )
}

function RemoveCell({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="rounded p-1 text-muted-foreground hover:text-danger-800 disabled:hidden"
    >
      <Trash2 className="h-3.5 w-3.5" aria-hidden />
    </button>
  )
}

/**
 * New coupon material beside a Buy line's identifier (ticket 422). The page decides where it is
 * offered (`couponMaterialOffered`) and runs the prompt; this only draws the button.
 */
function CouponMaterialButton({ onClick, disabled }: { onClick: () => void; disabled: boolean }) {
  const { t } = useTranslation('bonus-buy-maintenance')
  return (
    <button
      type="button"
      aria-label={t('couponMaterial.action')}
      title={t('couponMaterial.action')}
      data-testid="bby-coupon-material"
      disabled={disabled}
      onClick={onClick}
      className="shrink-0 rounded p-1 text-muted-foreground hover:text-primary disabled:opacity-50"
    >
      <TicketPlus className="h-3.5 w-3.5" aria-hidden />
    </button>
  )
}

/** What the Buy panel needs to offer New coupon material: where, the press, and a busy page. */
export interface CouponMaterialAction {
  offered: (line: BuyLine) => boolean
  onPress: (key: string) => void
  busy: boolean
}

const TH = 'px-1 pb-1 text-start text-xs font-medium text-muted-foreground'
const TD = 'px-1 py-0.5 align-middle'

export function BuyPanel({
  state,
  setState,
  readOnly,
  currency,
  couponMaterial,
}: {
  state: EditorState
  setState: SetState
  readOnly: boolean
  currency: string
  couponMaterial: CouponMaterialAction
}) {
  const { t } = useTranslation('bonus-buy-maintenance')
  const { minAmountEnabled } = buyPanelLayout(state, readOnly)
  const setLine = (key: string, patch: Partial<BuyLine>) =>
    setState((s) => ({ ...s, buy: s.buy.map((l) => (l.key === key ? { ...l, ...patch } : l)) }))

  return (
    <Panel title={t('editor.buy.title')}>
      <div className="flex flex-wrap items-end gap-4">
        <LinkSelect
          label={t('editor.link.label')}
          value={state.linkBuy}
          onChange={(linkBuy) => setState((s) => ({ ...s, linkBuy }))}
        />
        <label className="flex h-8 items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={state.minValueOn}
            onChange={(e) => setState((s) => ({ ...s, minValueOn: e.target.checked }))}
          />
          {t('editor.buy.minValue')}
        </label>
        <div className="flex items-center gap-2">
          <input
            aria-label={t('editor.buy.minAmount')}
            type="number"
            min={0}
            step="0.001"
            disabled={!minAmountEnabled}
            className={`${INPUT} w-32 text-end`}
            value={state.minValue}
            onChange={(e) => setState((s) => ({ ...s, minValue: e.target.value }))}
          />
          <span className="font-mono text-xs text-muted-foreground">
            <Ltr>{currency}</Ltr>
          </span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm" data-grid="buy">
          <thead>
            <tr>
              <th className={TH}>{t('editor.col.type')}</th>
              <th className={TH}>{t('editor.col.identifier')}</th>
              <th className={TH}>{t('editor.col.description')}</th>
              <th className={TH}>{t('editor.col.prereqQuantity')}</th>
              <th className={TH}>{t('editor.col.unit')}</th>
              <th className={TH}>{t('editor.col.scaleType')}</th>
              <th className={TH} />
            </tr>
          </thead>
          <tbody>
            {state.buy.map((l, i) => (
              <tr key={l.key}>
                <td className={`${TD} w-36`}>
                  <TypeCell
                    label={t('editor.col.type')}
                    value={l.type}
                    onChange={(type) => setLine(l.key, { type, identifier: '' })}
                  />
                </td>
                <td className={`${TD} w-44`}>
                  <div className="flex items-center gap-1">
                    <IdentifierCell
                      label={t('editor.col.identifier')}
                      type={l.type}
                      value={l.identifier}
                      groupings={state.groupings}
                      onChange={(identifier) => setLine(l.key, { identifier })}
                    />
                    {couponMaterial.offered(l) && (
                      <CouponMaterialButton disabled={couponMaterial.busy} onClick={() => couponMaterial.onPress(l.key)} />
                    )}
                  </div>
                </td>
                <td className={TD}>
                  <DescriptionCell type={l.type} identifier={l.identifier} groupings={state.groupings} />
                </td>
                <td className={`${TD} w-20`}>
                  <QuantityCell
                    label={t('editor.col.prereqQuantity')}
                    value={l.quantity}
                    onChange={(quantity) => setLine(l.key, { quantity })}
                  />
                </td>
                <td className={TD}>
                  <UnitCell uom={l.uom} />
                </td>
                <td className={`${TD} w-28`}>
                  {/* SAP defaults the buy side to Equal; the engine reads no buy-side scale. */}
                  <select aria-label={t('editor.col.scaleType')} className={CELL} value="C" disabled>
                    <option value="C">{t('editor.scale.C')}</option>
                  </select>
                </td>
                <td className={TD}>
                  <RemoveCell
                    label={t('editor.line.remove', { n: fsi(String(i + 1)) })}
                    onClick={() => setState((s) => ({ ...s, buy: s.buy.filter((x) => x.key !== l.key) }))}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!readOnly && (
        <Button
          variant="text"
          className="w-fit"
          onClick={() => setState((s) => ({ ...s, buy: [...s.buy, emptyBuyLine()] }))}
        >
          <Plus className="h-3.5 w-3.5" aria-hidden />
          {t('editor.line.add')}
        </Button>
      )}
    </Panel>
  )
}

function CurrPeCell({ discountType, currency }: { discountType: DiscountType; currency: string }) {
  const { t } = useTranslation('bonus-buy-maintenance')
  const { unit, exVat } = currPe(discountType, currency)
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap">
      <span className="font-mono text-xs">
        <Ltr>{unit}</Ltr>
      </span>
      {exVat && (
        <span className="rounded border border-border/60 px-1 text-[10px] text-muted-foreground">
          {t('editor.exVat')}
        </span>
      )}
    </span>
  )
}

export function GetPanel({
  state,
  setState,
  readOnly,
  currency,
}: {
  state: EditorState
  setState: SetState
  readOnly: boolean
  currency: string
}) {
  const { t } = useTranslation('bonus-buy-maintenance')
  const { columns, sidePanel } = getPanelLayout(state.totalDiscountOn)
  const setLine = (key: string, patch: Partial<GetLine>) =>
    setState((s) => ({ ...s, get: s.get.map((l) => (l.key === key ? { ...l, ...patch } : l)) }))

  const cell = (l: GetLine, c: GetColumn) => {
    switch (c) {
      case 'type':
        return (
          <TypeCell label={t('editor.col.type')} value={l.type} onChange={(type) => setLine(l.key, { type, identifier: '' })} />
        )
      case 'identifier':
        return (
          <IdentifierCell
            label={t('editor.col.identifier')}
            type={l.type}
            value={l.identifier}
            groupings={state.groupings}
            onChange={(identifier) => setLine(l.key, { identifier })}
          />
        )
      case 'description':
        return <DescriptionCell type={l.type} identifier={l.identifier} groupings={state.groupings} />
      case 'scaleType':
        return (
          <select
            aria-label={t('editor.col.scaleType')}
            className={CELL}
            value={l.scaleType}
            onChange={(e) => setLine(l.key, { scaleType: e.target.value as ScaleType })}
          >
            {SCALE_TYPES.map((s) => (
              <option key={s} value={s}>
                {t(`editor.scale.${s}`)}
              </option>
            ))}
          </select>
        )
      case 'quantity':
        return (
          <QuantityCell label={t('editor.col.quantity')} value={l.quantity} onChange={(quantity) => setLine(l.key, { quantity })} />
        )
      case 'unit':
        return <UnitCell uom={l.uom} />
      case 'discountType':
        return (
          <DiscountTypeSelect
            label={t('editor.col.discountType')}
            value={l.discountType}
            onChange={(discountType) => setLine(l.key, { discountType })}
          />
        )
      case 'value':
        return (
          <input
            aria-label={t('editor.col.value')}
            type="number"
            min={0}
            step="0.001"
            className={`${CELL} text-end`}
            value={l.value}
            onChange={(e) => setLine(l.key, { value: e.target.value })}
          />
        )
      case 'currPe':
        return <CurrPeCell discountType={l.discountType} currency={currency} />
    }
  }

  return (
    <Panel title={t('editor.get.title')}>
      <div className="flex flex-wrap items-end gap-4">
        <LinkSelect
          label={t('editor.link.label')}
          value={state.linkGet}
          onChange={(linkGet) => setState((s) => ({ ...s, linkGet }))}
        />
        <label className="flex h-8 items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={state.totalDiscountOn}
            onChange={(e) => setState((s) => ({ ...s, totalDiscountOn: e.target.checked }))}
          />
          {t('editor.get.totalDiscount')}
        </label>
      </div>

      <div className="flex flex-col gap-3 xl:flex-row">
        <div className="min-w-0 flex-1 overflow-x-auto">
          <table className="w-full text-sm" data-grid="get">
            <thead>
              <tr>
                {columns.map((c) => (
                  <th key={c} className={TH} data-col={c}>
                    {t(`editor.col.${c}`)}
                  </th>
                ))}
                <th className={TH} />
              </tr>
            </thead>
            <tbody>
              {state.get.map((l, i) => (
                <tr key={l.key}>
                  {columns.map((c) => (
                    <td
                      key={c}
                      className={`${TD} ${c === 'type' ? 'w-36' : c === 'identifier' ? 'w-36' : c === 'scaleType' || c === 'discountType' ? 'w-36' : c === 'quantity' || c === 'value' ? 'w-24' : ''}`}
                    >
                      {cell(l, c)}
                    </td>
                  ))}
                  <td className={TD}>
                    <RemoveCell
                      label={t('editor.line.remove', { n: fsi(String(i + 1)) })}
                      onClick={() => setState((s) => ({ ...s, get: s.get.filter((x) => x.key !== l.key) }))}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!readOnly && <AddGetLine setState={setState} />}
        </div>

        {sidePanel && (
          <aside
            data-panel="total-discount"
            className="flex w-full flex-col gap-2 rounded-md border border-border/60 bg-muted/30 p-3 xl:w-72"
          >
            <h4 className="text-sm font-semibold">{t('editor.total.title')}</h4>
            <DiscountTypeSelect
              label={t('editor.total.discountType')}
              value={state.total.discountType}
              onChange={(discountType) => setState((s) => ({ ...s, total: { ...s.total, discountType } }))}
              withLabel
            />
            <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
              {t('editor.total.value')}
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  step="0.001"
                  className={`${INPUT} w-32 text-end`}
                  value={state.total.value}
                  onChange={(e) => setState((s) => ({ ...s, total: { ...s.total, value: e.target.value } }))}
                />
                <CurrPeCell discountType={state.total.discountType} currency={currency} />
              </div>
            </label>
            <p className="text-xs text-muted-foreground">{t('editor.total.hint')}</p>
          </aside>
        )}
      </div>
    </Panel>
  )
}

function AddGetLine({ setState }: { setState: SetState }) {
  const { t } = useTranslation('bonus-buy-maintenance')
  return (
    <Button
      variant="text"
      className="mt-1 w-fit"
      onClick={() => setState((s) => ({ ...s, get: [...s.get, emptyGetLine()] }))}
    >
      <Plus className="h-3.5 w-3.5" aria-hidden />
      {t('editor.line.add')}
    </Button>
  )
}

function DiscountTypeSelect({
  label,
  value,
  onChange,
  withLabel,
}: {
  label: string
  value: DiscountType
  onChange: (v: DiscountType) => void
  withLabel?: boolean
}) {
  const { t } = useTranslation('bonus-buy-maintenance')
  const select = (
    <select
      aria-label={withLabel ? undefined : label}
      className={withLabel ? `${INPUT} w-full` : CELL}
      value={value}
      onChange={(e) => onChange(e.target.value as DiscountType)}
    >
      {DISCOUNT_TYPES.map((d) => (
        <option key={d} value={d}>
          {t(`editor.discount.${d === '%' ? 'percent' : d}`)}
        </option>
      ))}
    </select>
  )
  return withLabel ? (
    <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
      {label}
      {select}
    </label>
  ) : (
    select
  )
}
