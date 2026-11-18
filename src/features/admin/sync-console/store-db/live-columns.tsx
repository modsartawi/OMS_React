import type { ColDef, ValueFormatterParams } from 'ag-grid-community'
import type { TFunction } from 'i18next'
import type {
  StoreDbHeadBlocker,
  StoreDbLongTransaction,
  StoreDbRunningRequest,
  StoreDbWorkerSession,
} from '@/core/models/store-database'
import { MONO, formatTime } from '../console-columns'
import { figure } from '../helpers'
import type { LiveSectionKey } from './live-helpers'

/**
 * The Live activity panel's four column sets (oms 917, BO 4032), in ONE file: if BO answers the four result sets in a
 * generic `{ columns, rows }` shape instead of the GUESSED typed one, this is the one file that changes. Every value
 * is a plain grid value, isolated by the base col def (bidi rule); never `fsi()` here.
 */

const count = (p: ValueFormatterParams) => (p.value == null ? '' : figure(p.value as number))
/** `0` blocked-by means "not blocked": blank, so a blocked row stands out. */
const blocker = (p: ValueFormatterParams) => (p.value == null || p.value === 0 ? '' : String(p.value))

const col = (t: TFunction, key: string) => t(`storeDb.live.columns.${key}`)

const session = <T,>(t: TFunction): ColDef<T> => ({
  headerName: col(t, 'sessionId'),
  field: 'sessionId' as ColDef<T>['field'],
  width: 80,
  type: 'rightAligned',
})
const num = <T,>(t: TFunction, field: string, width = 100): ColDef<T> => ({
  headerName: col(t, field),
  field: field as ColDef<T>['field'],
  width,
  type: 'rightAligned',
  valueFormatter: count,
})
const text = <T,>(t: TFunction, field: string, width = 130, mono = false): ColDef<T> => ({
  headerName: col(t, field),
  field: field as ColDef<T>['field'],
  width,
  ...(mono ? { cellClass: MONO } : {}),
})
const time = <T,>(t: TFunction, field: string): ColDef<T> => ({
  headerName: col(t, field),
  field: field as ColDef<T>['field'],
  width: 160,
  valueFormatter: formatTime,
})
/** A SQL text: one line in the cell, the whole text on hover. */
const sql = <T,>(t: TFunction, field: string): ColDef<T> => ({
  headerName: col(t, field),
  field: field as ColDef<T>['field'],
  flex: 1,
  minWidth: 320,
  cellClass: MONO,
  tooltipField: field as ColDef<T>['tooltipField'],
})

function running(t: TFunction): ColDef<StoreDbRunningRequest>[] {
  return [
    session(t),
    { ...num(t, 'blockedBy', 90), valueFormatter: blocker },
    num(t, 'secs', 80),
    text(t, 'status', 100),
    text(t, 'command', 110),
    text(t, 'waitType', 140, true),
    num(t, 'waitSecs', 90),
    text(t, 'waitResource', 200, true),
    text(t, 'hostName'),
    text(t, 'programName'),
    text(t, 'loginName', 110),
    num(t, 'openTran', 90),
    num(t, 'cpuTime', 100),
    num(t, 'logicalReads', 120),
    sql(t, 'statementText'),
    sql(t, 'batchText'),
  ]
}

function headBlockers(t: TFunction): ColDef<StoreDbHeadBlocker>[] {
  return [
    session(t),
    num(t, 'blocksCount', 100),
    text(t, 'status', 100),
    text(t, 'hostName'),
    text(t, 'programName'),
    text(t, 'loginName', 110),
    time(t, 'lastRequestStartTime'),
    time(t, 'lastRequestEndTime'),
    num(t, 'idleSecs', 90),
    num(t, 'openTran', 90),
    sql(t, 'lastSql'),
  ]
}

function workerSessions(t: TFunction): ColDef<StoreDbWorkerSession>[] {
  return [
    session(t),
    text(t, 'status', 100),
    time(t, 'loginTime'),
    time(t, 'lastRequestStartTime'),
    text(t, 'command', 110),
    text(t, 'waitType', 140, true),
    { ...num(t, 'blockedBy', 90), valueFormatter: blocker },
    num(t, 'runningSecs', 100),
    num(t, 'openTran', 90),
    sql(t, 'sqlText'),
  ]
}

function longTransactions(t: TFunction): ColDef<StoreDbLongTransaction>[] {
  return [
    session(t),
    num(t, 'tranSecs', 100),
    time(t, 'transactionBeginTime'),
    text(t, 'status', 100),
    text(t, 'hostName'),
    text(t, 'programName'),
    sql(t, 'lastSql'),
  ]
}

/** Each result set's columns, by section. */
export function buildLiveColumns(t: TFunction): { [K in LiveSectionKey]: ColDef[] } {
  return {
    running: running(t) as ColDef[],
    headBlockers: headBlockers(t) as ColDef[],
    workerSessions: workerSessions(t) as ColDef[],
    longTransactions: longTransactions(t) as ColDef[],
  }
}
