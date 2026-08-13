/**
 * The Settlement Account feature's server calls (spec 267).
 *
 * Every one goes through `@/core/api` (`.claude/rules/api-envelope.md`): the
 * envelope, the error taxonomy and 401 are that module's, and 401 in particular is
 * never caught here.
 *
 * 268 landed the surface — the screen's reading of its grant. **269 adds the first
 * door that reads the ledger: one branch's account.** The fleet, post, cancel,
 * close-out, repair and the two bulk doors (spec 267 D8) arrive with 270–273; the
 * joining ticket 274 settles every route string against a live SIS.Api.
 *
 * ⚠️ **There is no `Settlement/Access` probe and there must not be one.** The
 * settlement account is a **fifth grant on the Collections probe** (spec 267 D1),
 * not an area of its own — same nav group, same `/collection/*` prefix, same one
 * `CollectionWeb/Access` call. The key, the options and the call live in
 * `@/core/collection/api`, where ticket 268 graduated them the moment this feature
 * became their second consumer: a feature may not import another feature's api
 * (`.claude/rules/feature-structure.md`).
 */
import { api } from '@/core/api'
import type { CollectionAccessResult } from '@/core/models/collection'
import type { SettlementAccount } from '@/core/models/settlement'
import { ACCOUNT_LIMIT } from './cap'

/**
 * The settlement account's predicate — this screen's own reading of the fifth flag.
 *
 * `=== true` and nothing looser, so a malformed answer (`{}`, `null`, a string
 * `"true"`) is a denial and not an accident of truthiness. That strictness is doing
 * real work today rather than guarding a hypothetical: the server does not answer
 * `canOpenSettlement` yet (BackOffice spec 1173), so every live probe currently
 * arrives with the field **absent** — and absent must read as no.
 *
 * Exported because the nav leaf and the screen's own gate must read the SAME
 * predicate rather than two spellings of it, which is what stops the menu and the
 * screen disagreeing about whether the session is allowed in.
 */
export const canOpenSettlement = (r: CollectionAccessResult | null | undefined): boolean =>
  r?.canOpenSettlement === true

export const settlementApi = {
  /**
   * `GET Settlement/Account?storeId=…` → one branch's whole position: every entry,
   * open and closed, and the flat array of consumptions behind them (spec 267 D8).
   *
   * 🚩 **One call, two arrays, no second round trip per entry.** The journal
   * drilldown is a re-render and never a request — the same shape `CollectionWeb/
   * Deposits` uses for its lines and slips (256), and for the same reason: an
   * accountant on a phone call opening four entries in a row must not be paying four
   * latencies to answer *"was my 500 used?"*.
   *
   * ⚠️ `Limit` is the cap the banner is measured against (`cap.ts`), asked for
   * rather than assumed — the door applies a 500-row `TOP` (D3) and a client that
   * did not name it would be inferring a number the server chose.
   *
   * ⚠️ The route string and the param casing are **274's to confirm** against a live
   * SIS.Api; D8 says as much in as many words. Until then 269's screens are driven
   * against `settlement-fixture.ts` served over this same door
   * (`tools/settlement-drive.mjs`), which is what makes 274 a joining event rather
   * than a rewiring.
   *
   * 401 is not caught here and must not be — `@/core/api` owns it
   * (`.claude/rules/api-envelope.md`).
   */
  account(storeId: string): Promise<SettlementAccount> {
    return api.get<SettlementAccount>('Settlement/Account', { storeId, limit: ACCOUNT_LIMIT })
  },
}
