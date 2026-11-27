/**
 * The agent's default source, applied when an order opens (ticket 993, spec 983 D14).
 *
 * An order that names no source, opened by an agent whose `myDocumentSources` flags one
 * row `isDefault`, gets that source through `setDocumentSource` — the operator's usual
 * channel is configured for them, and keying it on every call is work nobody asked for.
 *
 * Three properties live here rather than in the page, because they are rules:
 *
 * 1. 🚩 **What the order already holds always wins.** A settled source is never
 *    overwritten, so a resumed order the agent already set is untouched.
 * 2. 🚩 **Once per order, not once per render.** The caller keeps the set of
 *    transaction ids it has already TRIED (success or refusal alike) and adds to it
 *    before it sends — so a StrictMode double effect, a re-render while the verb is in
 *    flight, or the same order re-opened in this tab never sends it twice, and an agent
 *    who clears or changes the source afterwards is not overruled.
 * 3. **No default, nothing happens** — the owner's own login has none.
 */
import type { AgentDocumentSource } from '@/core/models/callcenter'

export interface DefaultSourceInput {
  /** The order on screen, or `null` before one is open. */
  transactionId: string | null
  /** The order's `status`; only an `'open'` order takes a header change. */
  status: string | null
  /** `header.documentSource` as the order holds it. */
  currentSource: string | null
  /** The agent's own list, or `undefined` while it is still being read (or failed). */
  sources: readonly AgentDocumentSource[] | undefined
  /** Orders this tab has already tried the default on. */
  tried: ReadonlySet<string>
}

/** The source code to send, or `null` when there is nothing to do. */
export function defaultSourceToApply(input: DefaultSourceInput): string | null {
  const { transactionId, status, currentSource, sources, tried } = input
  if (transactionId === null || status !== 'open') return null
  if (currentSource) return null
  if (tried.has(transactionId)) return null
  return sources?.find((option) => option.isDefault)?.documentSource ?? null
}

/** What the console does when the default's `setDocumentSource` is refused. */
export type DefaultRefusal =
  /** Open the Source section on this source, reference focused, the refusal worded. */
  | { kind: 'askReference'; documentSource: string }
  /** Leave it: the source chip is still unset and still the agent's to fill. */
  | { kind: 'quiet' }

/**
 * 🚩 Which sources need a reference is the SERVER's rule (173), so the default is sent
 * bare and `SOURCE_REFERENCE_REQUIRED` is how the console learns it needs one — the
 * agent is then put straight into the reference box on the same source. Any other
 * failure is not worth interrupting a caller for: nothing was set, the chip reads
 * unset as it always did, and `submitBlockers` still names it if the order needs it.
 */
export function afterDefaultRefused(documentSource: string, code: string | null | undefined): DefaultRefusal {
  return code === 'SOURCE_REFERENCE_REQUIRED' ? { kind: 'askReference', documentSource } : { kind: 'quiet' }
}
