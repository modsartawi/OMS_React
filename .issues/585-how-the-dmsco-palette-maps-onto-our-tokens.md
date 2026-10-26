---
type: wayfinder-ticket
wayfinder: grilling
map: 580
status: done
blocked-by: 581
---

# 585 — How the DMSCO palette maps onto our tokens

## Question

Our token table (palette B, spec 380) has named roles — `--primary`, the neutral ladder,
`--rail`, `--gold`, the four status families, `--ring`, `--cursor`. The design brings its own
variables (`primary-blue` #172031, `primary-blue-light` #182F4A, `primary-yellow` #FEC33B, a
`neutrals-10…80` grey ramp, plus whatever 581 finds). **Which design colour fills which of our
roles, in light?**

To settle:

- **The interactive colour.** Does `--primary` become the near-black navy #172031 (the login's
  button), or stay a lifted blue so links and selected rows still read as interactive?
- **The neutrals.** The design's greys are neutral (no hue); ours take the navy's temperature
  (R1). Which wins?
- **Gold.** #FEC33B (design) vs our #FDC801 — one gold or two? Where may it appear (it fails AA as
  text on light surfaces either way)?
- **Status families** (success, attention, danger, post, prescription): kept as they are, or
  re-tuned to sit with the new palette?
- **The login's `--login-*` block**: folds into the main table once roles are mapped, or stays a
  separate fixed brand surface?

Every mapped pair must pass `tools/check-contrast.mjs`. Dark is [586](586-how-dark-mode-is-derived-without-a-dark-design.md).

## Answer

Resolved 2026-10-26 with the owner. Starting point: the compact skin the owner approved on 584's
prototype ("crazy awesome"), refined with [581](581-capture-the-remaining-figma-frames.md)'s
variables. **Measured:** applied to the light table on `prototype/dmsco-density`, the contrast gate
passes all 184 pairs in both themes with no exception.

**Pivotal ruling (owner):** **the interactive colour is the design's navy, and links are
underlined.** `--primary` is `#172031` everywhere (buttons, rail, links, focus); because that is
nearly the body ink, clickable text carries an underline, as the design's links do. Selected rows
stay marked by their tint and the cursor bar.

**The light mapping** (design variable → our role):

| Role | Value | From |
|---|---|---|
| `--background` | `#f4f4f4` | approved prototype (the design's page is `#E5E5E6` under a photo; a flat lighter ground suits dense screens) |
| `--foreground`, `--card-foreground`, `--accent-foreground` | `#1f1f1f` | `black` |
| `--card` / `--card-2` / `--muted` | `#ffffff` / `#f7f7f7` / `#efefef` | neutral ladder |
| `--muted-foreground` | `#4c4c4c` | `neutrals-80` (7.81:1 on the page) |
| `--ink-3` | `#747983` | `primary-blue-60` (4.37:1 on card; UI floor) |
| `--accent` | `#e9e9e9` | `neutrals-10` |
| `--border` / `--border-strong` / `--divider` | `#e2e2e2` / `#bcbcbc` / `#ededed` | `neutrals-30` for the strong rule |
| `--input` | `#8f8f8f` | `neutrals-50` (3.23:1 on card) |
| `--ring`, `--primary`, `--cursor` | `#172031` | `primary-blue` |
| `--primary-050` / `-border` / `-800` | `#e8ebf0` / `#c3cad6` / `#182f4a` | tints of the navy; `-800` is `primary-blue-light` |
| `--secondary` / `-press` | `#4c4c4c` / `#3d3d3d` | neutrals |
| `--rail` | `#172031` | the header bar's navy |
| `--rail-foreground` | `#d1d2d6` | `primary-blue-20` (inactive nav text; 10.80:1) |
| `--rail-accent` | `#26324a` | lifted navy for hover/active ground |
| `--rail-muted` | `#8d96a8` | group labels (5.48:1) |
| `--rail-active`, `--gold` | `#fec33b` | `primary-yellow` (10.16:1 on the rail; still fails on white, as the gate requires) |
| `--gold-foreground` | `#172031` | navy on gold |
| `--grid-head` / `-foreground` | `#f4f4f4` / `#4c4c4c` | page ground + secondary ink |

**Settled alongside (recommendations, overrulable):**
- **Neutrals are hueless**, as the design's are; palette B's navy-tinted greys retire in light.
- **One gold, `#FEC33B`**, for every UI signal. The al-dawaa mark file keeps its own artwork colour.
- **Status families are unchanged** (success, attention, danger, post, prescription, the two
  command families). They are semantic and AA-gated; the design's green and red appear only as
  decoration (avatar, alert dot) and don't replace them.
- **The login keeps its own fixed `--login-*` block.** Folding it into the main table would make it
  follow dark mode, which it deliberately doesn't; its values already equal the navy above.
- **Grid** sizes are unchanged (584); its colours come from the roles above. The wrapper radius
  stays 8px, as on the approved prototype.

Dark is [586](586-how-dark-mode-is-derived-without-a-dark-design.md)'s, from this table.
