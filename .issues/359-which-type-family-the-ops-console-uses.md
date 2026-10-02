---
type: wayfinder-ticket
wayfinder: grilling
map: 358
status: done
blocked-by: —
---

# 359 — Which type family the Ops Console uses

## Question

Does the Ops Console use **IBM Plex Sans + IBM Plex Mono**, as prototyped? Or does it keep
BackOffice 464's ruling, **Inter everywhere with Readex Pro declared for Arabic** (today's
`global.css`, self-hosted, ~94 KB)?

Weigh these:

- **The Arabic pairing.** IBM Plex Sans Arabic exists. Readex Pro is already shipped.
- **Whether a mono face earns its place** for delivery numbers, codes and money, or whether
  `tabular-nums` on the sans face is enough.
- **The added payload and weights** (self-hosted woff2, no Google Fonts at runtime).
- **Legibility at 12px** in 28px grid rows.

If the answer overturns 464, record why in an ADR (`docs/adr/`).

## Answer

**The answer is all IBM Plex, which overturns 464.** The owner decided it by grilling on
2026-10-02. The reasons are in [ADR 0003](../docs/adr/0003-the-ops-console-sets-type-in-ibm-plex.md).

| Role | Face | Files (self-hosted woff2) |
|---|---|---|
| UI text and grids | **IBM Plex Sans**, variable | 1 Latin file, ~44 KB. Replaces Inter (~73 KB) |
| Identifiers and codes | **IBM Plex Mono**, 400 and 600 | 2 Latin files. Becomes `--font-mono` |
| Arabic | **IBM Plex Sans Arabic**, 400, 500, 600 and 700 | 4 static files, ~170 KB, gated by `unicode-range`. Replaces Readex Pro |

The three choices:

1. **Sans: Plex Sans, not Inter.** Inter was the stand-in for claude.ai's Styrene, and that
   identity was retired at 068. Only inertia kept it after that. Plex is what Far was prototyped
   and approved in. Plex Sans figures align by default, so today's `tabular-nums` rule on grids and
   `[data-numeric]` becomes a no-op. Keep `[data-numeric]` as a marker.
2. **Mono is for IDs and codes only.** This covers delivery and document numbers, SAP, material and
   store codes, and device ids. **Money and quantities stay in Plex Sans**: its figures already
   align and are narrower, so mono keeps meaning "a key". This departs from the prototype, which set
   amounts in mono. Pointing `--font-mono` at Plex Mono changes the 111 existing `font-mono` sites
   from the OS's Consolas with no call-site edits.
3. **Arabic: Plex Sans Arabic, not Readex Pro.** It is drawn in the same design program as Plex
   Sans, so mixed lines match. The app uses all four weights (548 `font-medium`, 339
   `font-semibold`, 61 `font-bold`, and grid headers at 600), which makes four static files. The
   owner accepted ~170 KB, paid only when Arabic renders. 465's caveat that Readex Pro has no
   tabular figures turned out not to matter: Western digits render in the Latin faces under
   `unicode-range`.

**Passed on to [362](362-ops-console-colours-density-and-grid-look.md):** the owner chose without a
side-by-side comparison, so **legibility at 12px in 28px rows** is checked on screen in the
colours/density prototype.
