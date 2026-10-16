import { useId, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Plus, Search, Upload, X } from 'lucide-react'
import { apiErrorMessage } from '@/core/api'
import { ruleLookupQuery } from '@/core/rules/api'
import { RULE_INPUT } from '@/core/rules/LookupPicks'
import Button from '@/core/ui/Button'
import Ltr from '@/core/ui/Ltr'
import { formatPair, fsi } from '@/core/util/bidi'
import { useDebounced } from '@/core/util/use-debounced'
import { MAX_BASKET_LINES, MAX_QTY, addToBasket, parseQty, removeLine, setQty, type BasketLine } from './basket'
import BasketCsv from './BasketCsv'

/**
 * The typed basket (ticket 514): a line per SKU with its quantity, found on HQ's materials lookup
 * by SKU or name, and the way to a CSV basket. Adding a SKU already in the basket adds to its line.
 */
export default function BasketEditor({ basket, onChange }: { basket: BasketLine[]; onChange: (b: BasketLine[]) => void }) {
  const { t } = useTranslation('rule-simulator')
  const [csv, setCsv] = useState(false)
  const full = basket.length >= MAX_BASKET_LINES

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4" data-sim-basket="">
      <h2 className="text-sm font-semibold">{t('basket.title')}</h2>
      {basket.length === 0 ? (
        <p className="text-xs text-muted-foreground" data-basket-empty="">
          {t('basket.empty')}
        </p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-xs text-muted-foreground">
              <th className="w-8 py-1 text-start font-medium">{t('basket.columns.line')}</th>
              <th className="py-1 text-start font-medium">{t('basket.columns.item')}</th>
              <th className="w-24 py-1 text-start font-medium">{t('basket.columns.qty')}</th>
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
                    <Ltr>{l.sku}</Ltr>
                  </code>
                  <bdi>{l.name}</bdi>
                </td>
                <td className="py-1">
                  <QtyInput line={l} onCommit={(n) => onChange(setQty(basket, l.sku, n))} />
                </td>
                <td className="py-1 text-end">
                  <button
                    type="button"
                    className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-danger-800"
                    aria-label={t('basket.remove', { sku: fsi(l.sku) })}
                    onClick={() => onChange(removeLine(basket, l.sku))}
                    data-basket-remove={l.sku}
                  >
                    <X className="size-3.5" aria-hidden />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {full ? (
        <p className="text-xs text-muted-foreground" data-basket-full="">
          {t('basket.full', { max: fsi(String(MAX_BASKET_LINES)) })}
        </p>
      ) : (
        <ItemSearch onPick={(sku, name) => onChange(addToBasket(basket, { sku, name, qty: 1 }))} />
      )}

      {csv ? (
        <BasketCsv
          basket={basket}
          onUse={(b) => {
            onChange(b)
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
    <input
      type="number"
      min={1}
      max={MAX_QTY}
      step={1}
      dir="ltr"
      className={`${RULE_INPUT} w-20`}
      aria-label={t('basket.qtyLabel', { sku: fsi(line.sku) })}
      value={text ?? String(line.qty)}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === 'Enter' && commit()}
      data-basket-qty={line.sku}
    />
  )
}

/** "Add an item": HQ's materials lookup by SKU or name; a hit adds one unit. */
function ItemSearch({ onPick }: { onPick: (sku: string, name: string) => void }) {
  const { t } = useTranslation('rule-simulator')
  const [find, setFind] = useState('')
  const q = useDebounced(find.trim(), 250)
  const hits = useQuery({ ...ruleLookupQuery('materials', q), enabled: q !== '' })
  const id = useId()
  const settled = q !== '' && q === find.trim()
  const found = hits.data ?? []
  const pick = (sku: string, name: string) => {
    onPick(sku, name)
    setFind('')
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-xs font-medium text-muted-foreground">
        {t('basket.find')}
      </label>
      <span className="relative flex items-center">
        <Search className="pointer-events-none absolute start-2 size-3.5 text-muted-foreground" aria-hidden />
        <input
          id={id}
          type="search"
          className={`${RULE_INPUT} w-full ps-7`}
          placeholder={t('basket.findPlaceholder')}
          value={find}
          onChange={(e) => setFind(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && settled && found[0]) {
              e.preventDefault()
              pick(found[0].code, found[0].name)
            }
          }}
          data-basket-find=""
        />
      </span>
      {settled && (
        <div className="flex flex-col gap-1" data-basket-hits="">
          {hits.isPending ? (
            <span className="text-xs text-muted-foreground">{t('basket.searching')}</span>
          ) : hits.isError ? (
            <span className="text-xs text-danger-800">{apiErrorMessage(hits.error, t('basket.noHits'))}</span>
          ) : found.length === 0 ? (
            <span className="text-xs text-muted-foreground">{t('basket.noHits')}</span>
          ) : (
            <ul className="flex flex-wrap gap-1.5">
              {found.map((m) => (
                <li key={m.code}>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-card px-2 py-0.5 text-xs hover:bg-accent"
                    aria-label={t('basket.add', { item: fsi(formatPair(m.code, m.name)) })}
                    onClick={() => pick(m.code, m.name)}
                    data-basket-hit={m.code}
                  >
                    <Plus className="size-3" aria-hidden />
                    <Ltr>{formatPair(m.code, m.name)}</Ltr>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
