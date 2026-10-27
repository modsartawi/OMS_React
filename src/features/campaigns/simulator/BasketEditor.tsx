import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Plus, Upload, X } from 'lucide-react'
import { apiErrorMessage } from '@/core/api'
import { RULE_MATERIAL_SEARCH_MIN } from '@/core/models/rule-campaign'
import { ruleLookupQuery } from '@/core/rules/api'
import { lookupName } from '@/core/rules/lookups'
import Button from '@/core/ui/Button'
import Field from '@/core/ui/Field'
import IconButton from '@/core/ui/IconButton'
import Input from '@/core/ui/Input'
import Ltr from '@/core/ui/Ltr'
import { formatPair, fsi } from '@/core/util/bidi'
import { formatMoneyIn } from '@/core/money'
import { formatNumber } from '@/core/util/number-format'
import { useDebounced } from '@/core/util/use-debounced'
import {
  MAX_BASKET_LINES,
  MAX_QTY,
  addToBasket,
  categoryOf,
  parsePrice,
  parseQty,
  priceFits,
  readBasketFile,
  removeLine,
  setPrice,
  setQty,
  type BasketLine,
} from './basket'
import BasketCsv from './BasketCsv'

/**
 * The basket (tickets 514, 525): typed — a line per SKU found on HQ's materials lookup by SKU or
 * name, with its quantity and the unit price the author gives it (HQ prices nothing in a dry run) —
 * or a CSV file, which HQ reads itself. Adding a SKU already in the basket adds to its line.
 */
export default function BasketEditor({
  basket,
  onChange,
  file,
  onFile,
  currency,
  decimals,
}: {
  basket: BasketLine[]
  onChange: (b: BasketLine[]) => void
  /** The CSV that is the basket; null = the typed basket. */
  file: string | null
  onFile: (text: string | null) => void
  currency: string | null
  decimals: number
}) {
  const { t } = useTranslation('rule-simulator')
  const [csv, setCsv] = useState(false)
  const full = basket.length >= MAX_BASKET_LINES

  if (file !== null) return <FileBasket text={file} currency={currency} onTyped={() => onFile(null)} />

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4" data-sim-basket="">
      <h2 className="text-sm font-semibold">{t('basket.title')}</h2>
      {basket.length === 0 ? (
        <p className="text-xs text-muted-foreground" data-basket-empty="">
          {t('basket.empty')}
        </p>
      ) : (
        <>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground">
                <th className="w-8 py-1 text-start font-medium">{t('basket.columns.line')}</th>
                <th className="py-1 text-start font-medium">{t('basket.columns.item')}</th>
                <th className="w-20 py-1 text-start font-medium">{t('basket.columns.qty')}</th>
                <th className="w-28 py-1 text-start font-medium">{t('basket.columns.price', { currency: fsi(currency ?? '') })}</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {basket.map((l, i) => (
                <tr key={l.sku} className="border-b border-border/60" data-basket-line={l.sku}>
                  <td className="py-1 text-muted-foreground">
                    <Ltr>{i + 1}</Ltr>
                  </td>
                  <td className="py-1">
                    <code className="me-2 font-mono text-xs">
                      <Ltr>{l.category ? formatPair(l.sku, l.category) : l.sku}</Ltr>
                    </code>
                    <bdi>{l.name}</bdi>
                  </td>
                  <td className="py-1">
                    <QtyInput line={l} onCommit={(n) => onChange(setQty(basket, l.sku, n))} />
                  </td>
                  <td className="py-1">
                    <PriceInput line={l} decimals={decimals} onCommit={(p) => onChange(setPrice(basket, l.sku, p))} />
                  </td>
                  <td className="py-1 text-end">
                    <IconButton
                      variant="danger"
                      size="compact"
                      label={t('basket.remove', { sku: fsi(l.sku) })}
                      onClick={() => onChange(removeLine(basket, l.sku))}
                      data-basket-remove={l.sku}
                    >
                      <X className="size-3.5" aria-hidden />
                    </IconButton>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-[11px] text-muted-foreground">{t('basket.priceHint')}</p>
        </>
      )}

      {full ? (
        <p className="text-xs text-muted-foreground" data-basket-full="">
          {t('basket.full', { max: fsi(String(MAX_BASKET_LINES)) })}
        </p>
      ) : (
        <ItemSearch onPick={(sku, name, category) => onChange(addToBasket(basket, { sku, name, category, qty: 1, price: null }))} />
      )}

      {csv ? (
        <BasketCsv
          onUse={(text) => {
            onFile(text)
            setCsv(false)
          }}
          onCancel={() => setCsv(false)}
        />
      ) : (
        <div>
          <Button variant="ghost" onClick={() => setCsv(true)} data-basket-upload="">
            <Upload className="size-3.5" aria-hidden />
            {t('basket.upload')}
          </Button>
        </div>
      )}
    </section>
  )
}

/** The file that is the basket: its lines as read, and the way back to a typed basket. */
function FileBasket({ text, currency, onTyped }: { text: string; currency: string | null; onTyped: () => void }) {
  const { t } = useTranslation('rule-simulator')
  const rows = useMemo(() => readBasketFile(text).rows, [text])
  // A file has no cap of its own at HQ: the page lists its first lines only.
  const shown = rows.slice(0, MAX_BASKET_LINES)
  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4" data-sim-basket="" data-basket-file={rows.length}>
      <h2 className="text-sm font-semibold">{t('basket.title')}</h2>
      <p className="text-xs text-muted-foreground">{t('basket.file.title', { count: rows.length, n: fsi(formatNumber(rows.length)) })}</p>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-xs text-muted-foreground">
            <th className="w-12 py-1 text-start font-medium">{t('csv.columns.line')}</th>
            <th className="py-1 text-start font-medium">{t('csv.columns.article')}</th>
            <th className="w-16 py-1 text-end font-medium">{t('csv.columns.qty')}</th>
            <th className="w-24 py-1 text-end font-medium">{t('csv.columns.net')}</th>
          </tr>
        </thead>
        <tbody>
          {shown.map((r) => (
            <tr key={r.line} className="border-b border-border/60" data-basket-file-line={r.line}>
              <td className="py-1 text-muted-foreground">
                <Ltr>{r.line}</Ltr>
              </td>
              <td className="py-1">
                <code className="font-mono text-xs">
                  <Ltr>{r.category ? formatPair(r.article, r.category) : r.article}</Ltr>
                </code>
              </td>
              <td className="py-1 text-end">
                <Ltr>{formatNumber(r.quantity ?? 0)}</Ltr>
              </td>
              <td className="py-1 text-end">
                <Ltr>{currency ? formatMoneyIn(r.net ?? 0, currency) : formatNumber(r.net ?? 0)}</Ltr>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > shown.length && (
        <p className="text-xs text-muted-foreground" data-basket-file-more="">
          {t('basket.file.more', { count: rows.length - shown.length, n: fsi(formatNumber(rows.length - shown.length)) })}
        </p>
      )}
      <div>
        <Button variant="ghost" onClick={onTyped} data-basket-typed="">
          {t('basket.file.typed')}
        </Button>
      </div>
    </section>
  )
}

/** A line's quantity: typed freely, kept when it reads as a whole number from 1, put back when not. */
function QtyInput({ line, onCommit }: { line: BasketLine; onCommit: (n: number) => void }) {
  const { t } = useTranslation('rule-simulator')
  const [text, setText] = useState<string | null>(null)
  const commit = () => {
    if (text === null) return
    const n = parseQty(text)
    if (n !== null) onCommit(n)
    setText(null)
  }
  return (
    <Input
      type="number"
      min={1}
      max={MAX_QTY}
      step={1}
      dir="ltr"
      className="w-16"
      aria-label={t('basket.qtyLabel', { sku: fsi(line.sku) })}
      value={text ?? String(line.qty)}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === 'Enter' && commit()}
      data-basket-qty={line.sku}
    />
  )
}

/** A line's unit price: kept when it reads as a figure at the currency's decimals, cleared when
 *  emptied, put back when not. A line with no price holds the run back. */
function PriceInput({ line, decimals, onCommit }: { line: BasketLine; decimals: number; onCommit: (p: number | null) => void }) {
  const { t } = useTranslation('rule-simulator')
  const [text, setText] = useState<string | null>(null)
  const commit = () => {
    if (text === null) return
    if (text.trim() === '') onCommit(null)
    else {
      const p = parsePrice(text, decimals)
      if (p !== null) onCommit(p)
    }
    setText(null)
  }
  return (
    <Input
      inputMode="decimal"
      dir="ltr"
      className="w-24"
      aria-label={t('basket.priceLabel', { sku: fsi(line.sku) })}
      aria-invalid={!priceFits(line.price, decimals)}
      placeholder={t('basket.pricePlaceholder')}
      value={text ?? (line.price === null ? '' : String(line.price))}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === 'Enter' && commit()}
      data-basket-price={line.sku}
    />
  )
}

/** "Add an item": HQ's materials lookup by SKU or name (three characters at least); a hit adds one
 *  unit, with the category HQ's `detail` names. */
function ItemSearch({ onPick }: { onPick: (sku: string, name: string, category: string) => void }) {
  const { t, i18n } = useTranslation('rule-simulator')
  const [find, setFind] = useState('')
  const q = useDebounced(find.trim(), 250)
  const searchable = q.length >= RULE_MATERIAL_SEARCH_MIN
  const hits = useQuery({ ...ruleLookupQuery('materials', q), enabled: searchable })
  const settled = searchable && q === find.trim()
  const found = (hits.data ?? []).map((m) => ({ code: m.code, name: lookupName(m, i18n.language), category: categoryOf(m.detail) }))
  const pick = (m: (typeof found)[number]) => {
    onPick(m.code, m.name, m.category)
    setFind('')
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Field label={t('basket.find')}>
        <Input
          type="search"
          wrapperClassName="w-full"
          placeholder={t('basket.findPlaceholder')}
          value={find}
          onChange={(e) => setFind(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && settled && found[0]) {
              e.preventDefault()
              pick(found[0])
            }
          }}
          data-basket-find=""
        />
      </Field>
      {settled && (
        <div className="flex flex-col gap-1" data-basket-hits="">
          {hits.isPending ? (
            <span className="text-xs text-muted-foreground">{t('basket.searching')}</span>
          ) : hits.isError ? (
            <span className="text-xs text-danger-800">
              <bdi>{apiErrorMessage(hits.error, t('basket.searchFailed'))}</bdi>
            </span>
          ) : found.length === 0 ? (
            <span className="text-xs text-muted-foreground">{t('basket.noHits')}</span>
          ) : (
            <ul className="flex flex-wrap gap-1.5">
              {found.map((m) => (
                <li key={m.code}>
                  <Button
                    variant="outlined"
                    aria-label={t('basket.add', { item: fsi(formatPair(m.code, m.name)) })}
                    onClick={() => pick(m)}
                    data-basket-hit={m.code}
                  >
                    <Plus className="size-3" aria-hidden />
                    <Ltr>{formatPair(m.code, m.name)}</Ltr>
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
