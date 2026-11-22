/**
 * A store's SAP movements and an item's ledger lines (oms 945, BackOffice spec 4157 stories 43–48, 60–61) — pure.
 *
 * Both are read by their own button and never on opening the tab: SAP is asked only when a person asks, and the ledger
 * is the largest table. The window is two local days, both included — at most 5 SAP entry days (the last 2 by default),
 * at most 7 ledger days (the last 7). A window over its limit, reversed, or not a day is stopped here, before any call,
 * with its sentence; the server's `WindowTooLong` is only the backstop.
 *
 * The state is the address's (`from`, `to`, `ran=1`, a page; the SAP tab adds the opened row `sapDay`/`sapType`), so a
 * shared link reads the same window. Boxes left at their defaults stay out of the address and read as the default.
 */
import { SAP_LINE_MARKS, type SapLineMark, type StockConsoleLedgerLine } from '@/core/models/stock-console'
import type { Severity } from '@/core/ui/severity'
import { formatParts } from '@/core/util/bidi'
import { formatFigure } from '@/core/util/number-format'
import { addDays, windowProblem, type LocalDate, type WindowProblem } from '@/core/util/date-window'
import { refusalOf, type Refusal } from './refusals'

/** SAP's window: entry days (BackOffice `StockConsole:SapMovementDays`, default 5). */
export const SAP_MOVEMENT_DAYS = 5
/** The ledger's window: local days (BackOffice `StockConsole:ItemMovementDays`, default 7). */
export const ITEM_MOVEMENT_DAYS = 7

export interface WindowSpec {
  /** The longest window, both ends counted. */
  maxDays: number
  /** The window the boxes start on, ending today. */
  defaultDays: number
}

export const SAP_WINDOW: WindowSpec = { maxDays: SAP_MOVEMENT_DAYS, defaultDays: 2 }
export const LEDGER_WINDOW: WindowSpec = { maxDays: ITEM_MOVEMENT_DAYS, defaultDays: 7 }

/** What the address says. `from`/`to` are '' when left at the default. */
export interface MovementsState {
  from: string
  to: string
  /** The button was pressed (`ran=1`): the window is read. */
  ran: boolean
  /** The ledger's page; on the SAP tab, the opened row's lines' page. */
  page: number
  /** The SAP summary row opened to its lines: its entry day and movement type ('' when none). */
  sapDay: string
  sapType: string
}

export const emptyMovements = (): MovementsState => ({ from: '', to: '', ran: false, page: 1, sapDay: '', sapType: '' })

export interface DayWindow {
  from: LocalDate
  to: LocalDate
}

/** The window the boxes start on: the last `defaultDays` days, today included. */
export const defaultWindow = (spec: WindowSpec, today: LocalDate): DayWindow => ({
  from: addDays(today, -(spec.defaultDays - 1)),
  to: today,
})

/** The window the state names: its days, or the default for a box left empty. */
export function windowOf(state: Pick<MovementsState, 'from' | 'to'>, spec: WindowSpec, today: LocalDate): DayWindow {
  const fallback = defaultWindow(spec, today)
  return { from: state.from || fallback.from, to: state.to || fallback.to }
}

export type WindowRead =
  | { kind: 'nothing' }
  | { kind: 'stopped'; problem: WindowProblem }
  | ({ kind: 'read' } & DayWindow)

/** Whether the tab reads: not before its button; not a window over its limit, reversed, or not a day. */
export function windowRead(state: MovementsState, spec: WindowSpec, today: LocalDate): WindowRead {
  if (!state.ran) return { kind: 'nothing' }
  const window = windowOf(state, spec, today)
  const problem = windowProblem(window.from, window.to, { maxDays: spec.maxDays })
  return problem ? { kind: 'stopped', problem } : { kind: 'read', ...window }
}

/**
 * The button: the boxes' window is written as asked (so a shared link reads the same days, not the reader's today),
 * read from page 1, and any opened SAP row closed — it belonged to the window before.
 */
export const pressRead = (state: MovementsState, boxes: DayWindow): MovementsState => ({
  ...state,
  from: boxes.from.trim(),
  to: boxes.to.trim(),
  ran: true,
  page: 1,
  sapDay: '',
  sapType: '',
})

/** A SAP summary row opens its lines, from their first page. */
export const openLines = (state: MovementsState, row: { day: string; movementType: string }): MovementsState => ({
  ...state,
  sapDay: row.day,
  sapType: row.movementType,
  page: 1,
})

export const closeLines = (state: MovementsState): MovementsState => ({ ...state, sapDay: '', sapType: '', page: 1 })

export const goToMovementsPage = (state: MovementsState, page: number): MovementsState => ({ ...state, page })

/** The address's reading of one tab: its name, the window, ran, the page under the tab's own name. */
export interface MovementsUrl {
  fromParams: (params: URLSearchParams) => MovementsState
  toParams: (state: MovementsState) => URLSearchParams
}

function movementsUrl(tab: 'sap' | 'movements'): MovementsUrl {
  const sap = tab === 'sap'
  const pageParam = sap ? 'sapPage' : 'page'
  return {
    fromParams(params) {
      const page = Number.parseInt(params.get(pageParam) ?? '', 10)
      return {
        from: (params.get('from') ?? '').trim(),
        to: (params.get('to') ?? '').trim(),
        ran: params.get('ran') === '1',
        page: Number.isFinite(page) && page >= 1 ? page : 1,
        sapDay: sap ? (params.get('sapDay') ?? '').trim() : '',
        sapType: sap ? (params.get('sapType') ?? '').trim() : '',
      }
    },
    toParams(state) {
      const out = new URLSearchParams({ tab })
      if (state.from) out.set('from', state.from)
      if (state.to) out.set('to', state.to)
      if (state.ran) out.set('ran', '1')
      const opened = sap && state.sapDay !== '' && state.sapType !== ''
      if (opened) {
        out.set('sapDay', state.sapDay)
        out.set('sapType', state.sapType)
      }
      if ((opened || !sap) && state.page > 1) out.set(pageParam, String(state.page))
      return out
    },
  }
}

/** A tab's read as the view needs it (a TanStack Query result, with its row count). */
export interface MovementsRead {
  isPending: boolean
  isError: boolean
  error: unknown
  /** The answer's rows (SAP: summary rows; ledger: the whole match), undefined before one. */
  rows: number | undefined
}

export type MovementsView =
  | { kind: 'nothing' }
  | { kind: 'stopped'; problem: WindowProblem }
  | { kind: 'loading' }
  | { kind: 'refused'; refusal: Refusal }
  | { kind: 'empty' }
  | { kind: 'rows' }

/**
 * What a movements tab draws. A refusal outranks a kept answer, so "SAP is not connected on this host" and "SAP could not
 * be reached" are their own sentences (`./refusals`), never an empty list or the last window's rows.
 */
export function movementsView(decision: WindowRead, read: MovementsRead): MovementsView {
  if (decision.kind === 'nothing') return { kind: 'nothing' }
  if (decision.kind === 'stopped') return { kind: 'stopped', problem: decision.problem }
  if (read.isError) return { kind: 'refused', refusal: refusalOf(read.error) }
  if (read.rows === undefined) return { kind: 'loading' }
  return read.rows === 0 ? { kind: 'empty' } : { kind: 'rows' }
}

/** The sentence key of a window stopped in the browser (`window.<problem>`). */
export const WINDOW_PROBLEMS = ['invalid', 'reversed', 'tooLong'] as const
export const windowProblemKey = (problem: WindowProblem): string =>
  `window.${(WINDOW_PROBLEMS as readonly string[]).includes(problem) ? problem : 'invalid'}`

const MARK_SEV: Record<SapLineMark, Severity> = { Applied: 'ok', ReceivedNotApplied: 'warn', NotReceived: 'bad' }

export type MarkCell = { key: string; sev: Severity } | { raw: string; sev: Severity }

/** A SAP line's mark: applied, received not applied, not received by us. One the screen does not know is drawn raw. */
export function markCell(mark: string): MarkCell {
  return (SAP_LINE_MARKS as readonly string[]).includes(mark)
    ? { key: `sap.mark.${mark}`, sev: MARK_SEV[mark as SapLineMark] }
    : { raw: mark, sev: 'warn' }
}

/** The columns of each grid, in the prototype's order (`sap.column.*`, `sap.lines.column.*`, `movements.column.*`). */
export const SAP_DAY_COLUMNS = ['day', 'movementType', 'documents', 'lines', 'quantityIn', 'quantityOut'] as const
export const SAP_LINE_COLUMNS = [
  'document',
  'line',
  'item',
  'name',
  'batch',
  'quantity',
  'postingDay',
  'entryTime',
  'mark',
] as const
export const LEDGER_COLUMNS = ['at', 'feed', 'movementType', 'quantity', 'batch', 'document', 'onSap', 'onTill'] as const

/** A line's effect on one counter: none (drawn as a quiet dash), or the signed figure. */
export type EffectCell = { kind: 'none' } | { kind: 'moves'; text: string }

const effectCell = (n: number | null | undefined): EffectCell =>
  typeof n !== 'number' || !Number.isFinite(n) || n === 0
    ? { kind: 'none' }
    : { kind: 'moves', text: n > 0 ? `+${formatFigure(n)}` : formatFigure(n) }

/**
 * A ledger line's effect on each counter, as the server worked it out by the ledger writer's own rule (SV 079): a SAP
 * sale moves the SAP counter only, a till sale the till-side counter only, a receipt both. The web draws the numbers it
 * is sent; zero is "no effect".
 */
export const ledgerEffects = (line: Pick<StockConsoleLedgerLine, 'onSap' | 'onTill'>): { onSap: EffectCell; onTill: EffectCell } => ({
  onSap: effectCell(line.onSap),
  onTill: effectCell(line.onTill),
})

export const LEDGER_FEEDS = ['Sap', 'Pos'] as const

/** The feed a line came by: SAP, or the till (`Pos`). One the screen does not know is drawn raw. */
export const feedCell = (feed: string): { key: string } | { raw: string } =>
  (LEDGER_FEEDS as readonly string[]).includes(feed) ? { key: `movements.feed.${feed}` } : { raw: feed }

/** The document a line came from, one value: SAP's document · year · line, or the till's store · transaction · line. */
export function ledgerDocument(line: StockConsoleLedgerLine): string {
  if (line.materialDocument) return formatParts([line.materialDocument, line.materialYear ?? '', line.materialLine ?? ''])
  if (line.tillStore || line.tillTrx) return formatParts([line.tillStore ?? '', line.tillTrx ?? '', line.tillLine ?? ''])
  return ''
}

/** A ledger line as it may arrive: the contract's names, or Stock Visibility's as built (SV 079 Comments). */
export type LedgerLineWire = Partial<StockConsoleLedgerLine> & {
  time?: string
  sapDocument?: { materialDocument?: string | null; year?: string | number | null; item?: string | number | null } | null
  tillDocument?: { store?: string | null; transaction?: string | null; line?: string | number | null } | null
}

/**
 * A ledger line as drawn. SIS.Api passes Stock Visibility's line through [guess: unrenamed], and SV 079 was built with
 * `time` and a nested `sapDocument`/`tillDocument`; the contract (wire.md) names them flat. Both read the same here —
 * the one place the reconcile happens. An absent effect reads as 0 (no effect), never a guess.
 */
export function toLedgerLine(d: LedgerLineWire): StockConsoleLedgerLine {
  const sap = d.sapDocument ?? null
  const till = d.tillDocument ?? null
  return {
    id: d.id ?? '',
    at: d.at ?? d.time ?? '',
    feed: d.feed ?? '',
    movementType: d.movementType ?? '',
    quantity: d.quantity ?? 0,
    batch: d.batch ?? null,
    storageLocation: d.storageLocation ?? null,
    materialDocument: d.materialDocument ?? sap?.materialDocument ?? null,
    materialYear: d.materialYear ?? sap?.year ?? null,
    materialLine: d.materialLine ?? sap?.item ?? null,
    tillStore: d.tillStore ?? till?.store ?? null,
    tillTrx: d.tillTrx ?? till?.transaction ?? null,
    tillLine: d.tillLine ?? till?.line ?? null,
    postingDay: d.postingDay ?? null,
    applied: typeof d.applied === 'boolean' ? d.applied : null,
    onSap: d.onSap ?? 0,
    onTill: d.onTill ?? 0,
  }
}

/** A store's SAP movements tab in the address (module-level: `useUrlQuery` reads it once). */
export const SAP_URL = movementsUrl('sap')
/** An item's Movements tab in the address. */
export const LEDGER_URL = movementsUrl('movements')
