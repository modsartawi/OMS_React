import { useSearchParams } from 'react-router'
import BranchAccount from './BranchAccount'
import { readEntryNumber, readStore } from './addresses'
import { SCOPE_PARAM, readScope } from './scope'
import SettlementDoor from './SettlementDoor'

/**
 * The **Overview** — `/collection/settlement`, the screen an accountant arrives on
 * (spec 282 D3, ticket 283). The door: the search box, the triaged worklist, the
 * estate's figures, and the two posting forms beside them.
 *
 * 🚩 **…and one branch's account, which is a PARAMETER on this path and not a screen
 * of its own.** `?store=0142` is where you *land* — from a search hit, a worklist
 * row, a ledger row or a phone call quoting an entry number — rather than a nav
 * destination somebody chooses from a menu. Which is why every 269-era address kept
 * working, untouched, when the other three views became paths.
 *
 * The chrome above (the scope control, the way back) belongs to `SettlementPage`,
 * because three of the four screens share it.
 */
export default function SettlementOverview() {
  const [searchParams] = useSearchParams()
  const storeId = readStore(searchParams)

  return storeId ? (
    <BranchAccount storeId={storeId} entryNumber={readEntryNumber(searchParams)} />
  ) : (
    <SettlementDoor scope={readScope(searchParams.get(SCOPE_PARAM))} />
  )
}
