/**
 * The console's spatial contract, rendered from the server's own projection.
 *
 * 135's ruling (variant A, "three fixed columns"): the customer rail at the
 * start edge and the live receipt at the end edge **never move**, and the centre
 * column is the only region that grows — chip row → item search → basket →
 * offer strip, in that vertical order. The furniture is at the same pixels at
 * hour nine as at hour one, which is the one property a twelve-hour shift
 * rewards.
 *
 * Slice 0 renders what an empty order actually has, and nothing it does not:
 * every value below comes off `SessionState`. There is no client-computed total
 * (law 1 / §2.1 — the console never sums lines), no hand-made placeholder, and
 * no control enabled by a client-side predicate: *Place order* is disabled
 * because `capabilities.canSubmit` said so, and the reason under it is
 * `submitBlockers`, the server's own list.
 *
 * The interactive halves — attaching a caller, item search, the basket's own
 * verbs, the guidance strip — arrive with tickets 165–172. What is here is the
 * furniture they land in.
 */
import { useTranslation } from 'react-i18next'
import type { SessionState } from '@/core/models/callcenter'
import { formatMoney } from '@/core/util/number-format'
import { headerChips, type HeaderChip } from './header-chips'

export default function ConsoleShell({ state }: { state: SessionState }) {
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground" data-cc-console>
      <TopBar state={state} />
      {/* 1440×900 by design, degrading to 1280; below that is out of scope —
          it is a desktop console (135's density budget). */}
      <div className="grid min-h-0 flex-1 grid-cols-[260px_minmax(0,1fr)_320px]">
        <CustomerRail state={state} />
        <main className="flex min-h-0 min-w-0 flex-col border-x border-border">
          <ChipRow state={state} />
          <Basket state={state} />
        </main>
        <Receipt state={state} />
      </div>
    </div>
  )
}

function TopBar({ state }: { state: SessionState }) {
  const { t } = useTranslation('callcenter')
  return (
    <header className="flex h-11 shrink-0 items-center justify-between border-b border-border-strong bg-card px-4">
      <div className="flex items-center gap-3">
        <span className="text-sm font-semibold">{t('console.title')}</span>
        {/* Server-supplied, passed through as data: the document type is the
            engine's word for this order, not a label the console chooses. */}
        <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground" data-cc-doctype>
          {state.header.documentType}
        </span>
      </div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>{t('console.store', { store: state.header.entryStore })}</span>
        <span aria-hidden>·</span>
        <span data-cc-operator>{state.header.operatorId}</span>
      </div>
    </header>
  )
}

/** Six fields maximum (135 — Salesforce compact-layout discipline). An empty
 *  order has none of them, so the rail is the phone field and nothing else. */
function CustomerRail({ state }: { state: SessionState }) {
  const { t } = useTranslation('callcenter')
  const customer = state.header.customer
  return (
    <aside className="flex min-h-0 flex-col gap-3 overflow-auto bg-sidebar p-4" data-cc-rail>
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {t('rail.caller')}
      </div>
      {customer ? (
        <div>
          <div className="text-sm font-semibold leading-tight">{customer.name}</div>
          <div data-numeric className="text-xs text-muted-foreground">
            {customer.mobile}
          </div>
        </div>
      ) : (
        <>
          <label className="text-xs text-muted-foreground" htmlFor="cc-phone">
            {t('rail.mobile')}
          </label>
          {/* The field US9's caret lands in the moment the console opens — but
              looking up a caller is ticket 165's, so slice 0 draws it inert
              rather than focusing an input that would swallow what the agent
              types. The caret ruling ships with the lookup that answers it. */}
          <input
            id="cc-phone"
            disabled
            placeholder={t('rail.mobilePlaceholder')}
            className="rounded-md border border-input bg-card px-3 py-2 text-sm outline-none disabled:opacity-70"
          />
          <p className="text-[11px] text-muted-foreground">{t('rail.emptyHint')}</p>
        </>
      )}

      <div className="mt-2 border-t border-border pt-3">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t('rail.address')}
        </div>
        {state.header.address ? (
          <div className="rounded-md border border-border bg-card p-2 text-xs">
            <div className="font-medium">{state.header.address.label}</div>
            <div className="text-muted-foreground">{state.header.address.line}</div>
          </div>
        ) : (
          // US12 — the empty slot states the next step without a message to read.
          // Its action is gated on `capabilities.canOpenAddressBook`, which is
          // false until a caller is attached (§6.3), never on a client rule.
          <div className="rounded-md border border-dashed border-input p-3 text-center text-xs text-muted-foreground">
            {t('rail.noAddress')}
          </div>
        )}
      </div>
    </aside>
  )
}

function ChipRow({ state }: { state: SessionState }) {
  const chips = headerChips(state.header, state.capabilities)
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-divider bg-card px-4 py-2" data-cc-chips>
      {chips.map((chip) => (
        <Chip key={chip.id} chip={chip} />
      ))}
    </div>
  )
}

function Chip({ chip }: { chip: HeaderChip }) {
  const { t } = useTranslation('callcenter')
  const tone =
    chip.state === 'needsAttention'
      ? 'border-attention-border bg-attention-050 text-attention-800'
      : chip.state === 'settled'
        ? 'border-border bg-muted text-foreground'
        : 'border-dashed border-input bg-card text-muted-foreground'
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs ${tone}`}
      data-cc-chip={chip.id}
      data-cc-chip-state={chip.state}
    >
      <span className="text-[10px] uppercase tracking-wide opacity-70">{t(`chips.${chip.id}`)}</span>
      <span className="font-medium">{chip.value ?? t('chips.notSet')}</span>
      {chip.derived && <span className="text-[10px] opacity-60">({t('chips.derived')})</span>}
    </span>
  )
}

function Basket({ state }: { state: SessionState }) {
  const { t } = useTranslation('callcenter')
  return (
    <div className="min-h-0 flex-1 overflow-auto" data-cc-basket>
      <div className="flex items-center justify-between border-b border-divider px-4 py-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
        <span>{t('basket.heading')}</span>
        <span data-numeric>{t('basket.lineCount', { count: state.lines.length })}</span>
      </div>
      {state.lines.length === 0 ? (
        <div className="p-10 text-center text-sm text-muted-foreground" data-cc-basket-empty>
          {t('basket.empty')}
        </div>
      ) : (
        state.lines.map((line) => (
          <div key={line.lineId} className="border-b border-divider px-4 py-2.5" data-cc-line={line.lineId}>
            <div className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm">{line.description}</div>
                <div data-numeric className="text-xs text-muted-foreground">
                  {line.itemNumber}
                </div>
              </div>
              <span data-numeric className="text-xs text-muted-foreground">
                {line.qty} {line.uom}
              </span>
              <Money value={line.lineTotal.gross} />
            </div>
          </div>
        ))
      )}
    </div>
  )
}

/** Engine money — VAT-inclusive, tabular, currency named. `SAR` is reserved for
 *  this register: an estimate never carries a currency word (135 amendment 1). */
function Money({ value, size = 'md' }: { value: number; size?: 'md' | 'lg' }) {
  const { t } = useTranslation('callcenter')
  return (
    <span data-numeric className={size === 'lg' ? 'text-xl font-semibold' : 'text-sm font-medium'}>
      {formatMoney(value)}
      <span className="ms-1 text-[0.7em] font-normal text-ink-3">{t('money.currency')}</span>
    </span>
  )
}

/** The live receipt — never goes below the fold, with *Place order* pinned to
 *  its foot where it never scrolls away (US53). */
function Receipt({ state }: { state: SessionState }) {
  const { t } = useTranslation('callcenter')
  const { totals, capabilities } = state
  return (
    <aside className="flex min-h-0 flex-col bg-card" data-cc-receipt>
      <div className="border-b border-divider px-4 py-2 text-[11px] uppercase tracking-wide text-muted-foreground">
        {t('receipt.heading')}
      </div>
      <div className="min-h-0 flex-1 overflow-auto px-4 py-3">
        <dl className="space-y-1.5 text-sm">
          <Row label={t('receipt.items')} value={<Money value={totals.net} />} />
          <Row label={t('receipt.vat')} value={<Money value={totals.vat} />} />
          <Row
            label={t('receipt.delivery')}
            value={
              totals.deliveryFee.waived ? (
                // `waived` is an outcome shown, never a control (156).
                <span className="text-xs text-success-800">{t('receipt.waived')}</span>
              ) : (
                <Money value={totals.deliveryFee.amount} />
              )
            }
          />
          <div className="mt-3 flex items-baseline justify-between border-t border-border-strong pt-3">
            <span className="text-sm font-semibold">{t('receipt.total')}</span>
            <span data-cc-payable>
              <Money value={totals.payable} size="lg" />
            </span>
          </div>
        </dl>
      </div>
      <div className="space-y-2 border-t border-divider p-4">
        {capabilities.submitBlockers.length > 0 && (
          // US54 — the reason is named while something is missing, so the agent
          // fixes it rather than guessing. Each code is a key: these are machine
          // codes, and an unknown one falls back to the code itself rather than
          // rendering a blank.
          <div className="text-xs text-attention-800" data-cc-blockers>
            {t('receipt.needed', {
              list: capabilities.submitBlockers
                .map((code) => t(`blockers.${code}`, { defaultValue: code }))
                .join(' · '),
            })}
          </div>
        )}
        <button
          type="button"
          disabled={!capabilities.canSubmit}
          data-cc-submit
          className="w-full rounded-md bg-primary px-3 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-40"
        >
          {t('receipt.placeOrder')}
        </button>
      </div>
    </aside>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}
