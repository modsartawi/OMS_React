// A side sheet's plain-table cell classes (`./SideSheet`) — one place, so every drawer's tables
// (logs, lines, material history, status history, on every rail) stay drawn alike.

export const TH = 'px-2 py-1.5 text-start font-medium whitespace-nowrap'
export const TD = 'px-2 py-1.5 align-top whitespace-nowrap'

/** A side sheet's scrolling body, under its header (`./SideSheetHeader`). */
export const SHEET_BODY = 'flex min-h-0 flex-1 flex-col gap-3 overflow-auto p-4'
