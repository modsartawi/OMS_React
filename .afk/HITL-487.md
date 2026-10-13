# HITL — ticket 487 (per-store table)

## Q: Where does the per-store table's store column sit when the 14 columns overflow a narrow window?
**Decision taken:** Pinned to the reading start (`pinStart`: left in LTR, right in RTL), as the BBY inquiry pins its identity column; figure columns `minWidth: 88` so all 14 fit a 1600px viewport without scrolling.
**Why:** a sideways-scrolled ranking that loses the store code cannot be read; the repo already has the pinStart idiom.
**Revisit if:** the owner prefers no pinning on a read-only dashboard table.

## Q: Header tooltips on the store table?
**Decision taken:** None — headers wrap in full (`wrapHeaderText` + `autoHeaderHeight`), so a tooltip would only repeat the caption.
**Why:** code-review flagged the duplicate; nothing is truncated.
**Revisit if:** a longer Arabic caption ever truncates.

## Q: What if the door sends two `stores[]` entries with the same storeCode?
**Decision taken:** Not guarded; `getRowId` keys on storeCode. The brief's contract is one entry per store.
**Why:** the page derives/merges nothing ("show what the door sends"); merging would be inventing a figure.
**Revisit if:** ticket 488's live door returns duplicate codes (e.g. profit-center splits).

## Q: Header captions for Trips and Avg hand-over in the table
**Decision taken:** "Trips" and "Avg hand-over (min)" (the unit in the header since the cells carry bare numbers); the rest reuse the bands' `flow.*`/`misses.*` captions so tile and column name a figure alike.
**Why:** parity with the bands; a grid cell holds no unit.
**Revisit if:** the till's per-store grid captions differ.
