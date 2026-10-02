---
type: wayfinder-ticket
wayfinder: prototype
map: 358
status: done
blocked-by: 362
---

# 372 — The Simulation price waterfall

## Question

The prototype explains a line's price as a **waterfall**: list price, then each condition, then
net. It is built from the pricing trace.

- **Does it replace or sit beside the chip-led arrangement** from
  [The POS Simulation screen rework](097-simulation-screen-rework.md)'s spec?
- **Where does it live:** line detail, results, or a panel?
- **How does it read** for a many-line basket and for buy→get promotions?

Prototype it in the live app on the new tokens.

## Answer

**No waterfall, and Simulation is a retheme only.** The owner decided both on 2026-10-02, after
seeing the waterfall in three placements on the live app, on the navy tokens.

**Assets:**

- The prototype is branch `prototype/372-sim-waterfall` (`d2ed834`, off 362's tokens, never
  merges), worktree `C:\Playground\oms-react-372`.
- To run it: `npx vite --port 5372` in the worktree, then open
  `/pricing/simulation?stub=1&palette=navy&wf=ledger&cap=06`. Type any material and press
  Ctrl+Enter. The dev bar switches the placement (`ledger` · `beside` · `pane` · `off`), the scale
  and the basket.
- The 14 captures are in [372-shots/](assets/372-shots/), made with `tools/proto-372-shots.mjs`.

### 1. The rulings

- **No waterfall.** The line expansion stays exactly as ticket 116 shipped it: the money foot
  (`net + tax = net total`), the rule cards, then the elements trace. The Ops Console only
  **restyles** it, through the foundation's tokens, Plex and density. The owner turned down all
  three placements:
  - **A:** the waterfall as the expansion body, replacing the foot and the cards.
  - **B:** the waterfall above the cards, which kept every figure twice.
  - **C:** Far's single-select list with a detail pane, which also broke 103/116's rules that any
    number of lines may be open and nothing auto-opens.
- **Simulation leaves the full-redesign set.** Spec 110's shipped arrangement stays whole:
  - the collapsing chip strip
  - Items, never collapsed
  - the 66/34 results | promotions split
  - lines that expand in place
  - the rail, with its buy→get blocks and near-misses

  Far's other Simulation changes are **not adopted**: the permanent inputs pane, the single-select
  results list and the three-pane layout. So the Simulation step in
  [How the Ops Console reaches main](361-how-the-ops-console-reaches-main.md) is a **retheme**:
  - the foundation (tokens, Plex, 26px/12px density, 6px controls)
  - the Ctrl+Enter dialog guard and refusal toast that
    [Keyboard shortcuts that work for everyone](365-keyboard-shortcuts-that-work-for-everyone.md)
    gave Simulation
  - the shared palette, through `useCommands` ([364](364-what-the-command-palette-holds.md))
- **The buy role stays on the rail card only** ("omit it"). This is moot without a waterfall,
  but it is recorded because it is the same ruling: a row that moves no money on its own line
  gets no step there.

### 2. What the prototype found, kept for whoever reopens this

None of this is a decision. These are facts, measured on the corpus, so that a later effort does
not re-derive them.

- **A waterfall would not need the trace.** The raw `conditions` rows that every run returns
  foot exactly on all **17 priced lines** of the nine 098 captures (`waterfall.test.ts` on the
  branch, 17/17). Net is the smallest split where the rows before it sum to `netValue`, the rows
  after it sum to `taxValue`, and no promotion or manual row comes after it. That is read off the
  engine's arithmetic, not off the `MWST` type code.
- **Far's subtotal label is a trap.** SAP's step-130 subtotal is labelled "Gross Value", but it
  equals **net** (118.64), while the shipped line's `was` column is the pre-discount gross
  (182.52). Far copied the SAP label.
- **A basket-wide axis fails.** One big-ticket line, the fictional 1,249 SAR monitor, crushes
  every other line's bars to slivers. Only a per-line scale reads.
- **RTL:** the bars mirror correctly on `inset-inline-start`, but signed amounts and "−35% of
  91.26" reorder ("5.00−"). They need 106's whole-value isolation, like every other digit run.
- **Accessibility:** a ledger `<table>` with `aria-hidden` bars needs no separate chart
  description. This answers the risk Far's adoption notes raised.

### 3. Observed, outside this map

In capture 06, line 10 sent a manual `ZB01` as **rate 5, unit `%`**. The engine moved it by
**−5.00**, where 5% of 62.52 would be −3.13. That is consistent with `ZB01` being an
amount-type condition that ignores the unit, but the shipped rule card echoes "Rate: −5.000 %"
beside −5.00. It is a pricing-engine and screen question for whoever owns manual conditions, not
an Ops Console one, so no ticket is raised here.
