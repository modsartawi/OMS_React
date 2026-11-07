/**
 * The render ticket (ADR 0125, amended in ticket 835): a scheduled report's PDF is headless Chromium printing the
 * print route `/analytics/print/report/:id?…&lang=…&ticket=…`, with no session. While the print page holds a ticket,
 * `./api` reads the four ticket doors (`Render/Report/{id}`, `Render/Model`, `Render/Query`, `Render/Report/{id}/Words`)
 * with the ticket in the `X-Analytics-Render-Ticket` header, and `./access` asks no session door.
 *
 * 🔒 The ticket is a credential for one report's run: never logged, never put in a door's query string.
 * Kept apart from `./api` so the eagerly imported probe (`./access`) costs only this.
 */

/** The header the ticket doors read (SIS.Api `AnalyticsWebEndpoints.RenderTicketHeader`). */
export const RENDER_TICKET_HEADER = 'X-Analytics-Render-Ticket'

export interface RenderTicket {
  ticket: string
  /** The run's language, which the Words are asked in. */
  lang: 'en' | 'ar'
}

let held: RenderTicket | null = null

/** The ticket the print page holds, or `null` (every other page, and the print page opened by a person). */
export const renderTicket = (): RenderTicket | null => held

/** Set by the print page from its URL before its first read; `null` clears it. */
export function setRenderTicket(next: RenderTicket | null) {
  held = next
}

/** The print route's ticket from its URL: trimmed, or `null` when there is none. */
export function ticketOf(search: URLSearchParams): string | null {
  return (search.get('ticket') ?? '').trim() || null
}

/** The header a ticket door is called with. */
export const ticketHeaders = (t: RenderTicket): Record<string, string> => ({ [RENDER_TICKET_HEADER]: t.ticket })
