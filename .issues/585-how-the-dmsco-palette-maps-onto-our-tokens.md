---
type: wayfinder-ticket
wayfinder: grilling
map: 580
status: open
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
