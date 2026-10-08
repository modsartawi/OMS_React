/**
 * The pure half of **Resend** on the Invoices tab (ticket 428, spec 2443) — when a
 * receipt offers it, what the answer says, and the command with its invalidation.
 *
 * 🚩 **The command carries its invalidation** (303's idiom): a requeue that does not
 * refresh the Invoices tab looks like it did not happen, and one that does not
 * refresh Actions hides the trail row it wrote. Both keys, always, and neither
 * awaited — a slow re-read never holds the dialog open over a write that committed.
 */
import type { QueryClient } from '@tanstack/react-query'

import { apiErrorKind } from '@/core/api'
import type { LoyInvoiceRequeueResult, LoyInvoiceRow } from '@/core/models/loy'
import { invoicesKey, loyCommandApi, memberActionsScopeKey } from './api'

/**
 * Whether a receipt offers Resend: the server says it is **resendable** AND the
 * session holds the member **edit** grant. Nothing looser.
 *
 * 🚩 `resendable` is the server's verdict from the rail's own recipient rule. The
 * client adds only a fence: a receipt **waiting in the queue** or **never queued**
 * offers nothing whatever the flag says, because a requeue of the first is a no-op
 * and of the second is refused (Insurance, Credit, `B001` are never emailed).
 */
export function resendOffered(row: LoyInvoiceRow, mayEdit: boolean): boolean {
  if (!mayEdit || row.resendable !== true) return false
  if (row.status === 'Queued' || row.status === 'NotQueued') return false
  const reason = row.notResendableReason?.trim().toUpperCase()
  return reason !== 'QUEUED' && reason !== 'NOT_QUEUED'
}

/**
 * What a successful requeue says. 🚩 **Already waiting is not "queued"**: the server
 * reset nothing and wrote no trail row (a double click, or a colleague first), and
 * telling the agent it queued would promise the customer a second email.
 *
 * 🚩 A queued answer names **the address the server queued to** — its answer, not the
 * row the dialog showed, which may be a stale read — so what the agent tells the
 * customer is what the rail will use. The address is returned raw; the caller isolates
 * it (`fsi`, a toast being a string-only sink).
 */
export function requeueOutcome(answer: LoyInvoiceRequeueResult): {
  key: string
  recipient: string | null
} {
  if (answer.result === 'AlreadyQueued')
    return { key: 'tabs.invoices.resend.alreadyQueued', recipient: null }
  const recipient = answer.recipient?.trim() || null
  return recipient
    ? { key: 'tabs.invoices.resend.queuedTo', recipient }
    : { key: 'tabs.invoices.resend.queued', recipient: null }
}

/**
 * Requeue one receipt, then invalidate the Invoices and Actions tabs.
 *
 * 🚩 **A business refusal re-reads the Invoices tab, and only that.** The server
 * refuses on the same rule the row's verdict came from, so a refusal means the row was
 * stale — a colleague queued it, the window rolled over, the address went bad — and
 * leaving it armed would have every later press refused too. Nothing was written, so
 * the Actions trail is not re-read. A 403, an outage or a network failure says nothing
 * about the row and re-reads nothing.
 */
export async function requeueInvoice(
  client: QueryClient,
  loyId: string,
  receipt: Pick<LoyInvoiceRow, 'storeCode' | 'trxNumber'>,
): Promise<LoyInvoiceRequeueResult> {
  let answer: LoyInvoiceRequeueResult
  try {
    answer = await loyCommandApi.requeueInvoice(loyId, receipt.storeCode, receipt.trxNumber)
  } catch (err) {
    if (apiErrorKind(err) === 'business')
      void client.invalidateQueries({ queryKey: invoicesKey(loyId) })
    throw err
  }
  void client.invalidateQueries({ queryKey: invoicesKey(loyId) })
  void client.invalidateQueries({ queryKey: memberActionsScopeKey(loyId) })
  return answer
}
