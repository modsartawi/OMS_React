/**
 * **Open settlements** — `/collection/settlement/open` (spec 282), the accountant's
 * follow-up surface: *who has not sent the money, how long has it been, and who do I
 * ring?* Three tabs — Owing · Owed · Cash waiting — oldest first, the estate ranked
 * but never narrowed away.
 *
 * ⚠️ **An empty shell in ticket 283, deliberately.** This slice moved the screen's
 * four views onto paths, and the address had to exist before the nav could point at
 * it (284) or the lane could be drawn on it (285) — building the view first would
 * have meant addressing it twice. There is no copy here yet for the same reason:
 * every string this screen will hold arrives with the slice that draws it, so no key
 * is minted ahead of the sentence it belongs to.
 *
 * The container is named so the drive can assert *this* screen rendered rather than
 * the Overview — which, the whole point of this slice being paths, it now can.
 */
export default function OpenSettlements() {
  return <div data-region="settlement-open" />
}
