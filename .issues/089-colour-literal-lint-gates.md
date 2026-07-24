---
status: done
spec: 082
blocked-by: 085, 087, 088
---

# 089 — lintFailsOnAReintroducedColourLiteral

## What to build

The completion criterion for spec 082, and the thing that stops the sweep unravelling one commit at
a time: `npm run lint` fails if anyone writes a colour anywhere except `global.css`.

The severity layer wasn't untokenised by oversight — it was untokenised because there was nowhere to
put it. There is now, and this gate is what stops it re-forming.

Two more plain node scripts in the shape `tools/check-boundaries.mjs` already establishes:
dependency-free, walking `src/`, reporting `file:line` hits, exiting non-zero. (The third gate, the
contrast check, already shipped with ticket 084.)

1. **Palette gate** —
   `\b(bg|text|border|from|to|via)-(red|rose|amber|orange|emerald|green|blue|sky|violet|slate)-`
   over `src/`. Zero hits.
2. **Literal gate** — `text-white` and `-\[#`. Zero hits each. (`text-white` reaches zero only once
   ticket 087 has landed: it converts the login panel's two sites to `--brand-panel-foreground` and
   deletes the home hero's two with the brand ground.)

**Deliberately excluded, and the exclusions belong in the script rather than in a reviewer's head:**
the three `bg-black/50` modal scrims (a scrim is black in both themes by intent) and the login QR
code's `bg-white` quiet zone (a QR needs a white module ground to scan). Each exclusion carries the
reason inline, so a later reader does not delete it as noise or widen it by precedent.

## Spine reach

`tools/check-palette.mjs` (new) · `package.json` lint script · no `src/` change of its own.

## Proof (→ `tdd` red-green cycles)

- [x] `paletteGateFailsOnAReintroducedRawClass` — `bg-emerald-500/15` injected into
      `core/ui/StatusBadge.tsx`; the gate exits 1 naming `src/core/ui/StatusBadge.tsx:1` and the
      matched class; removed, green again · pure (node script)
- [x] `literalGateFailsOnAnArbitraryColourValue` — same run also caught `text-[#FDC801]`,
      `text-white` and the bare `'#c62828'` string (the widened hex gate), 4 hits in one pass · pure
- [x] `theExcludedScrimsAndQrGroundDoNotTripTheGate` — the four sites are in the tree and the gate is
      green over it; a `bg-black/50` injected into a *non*-excluded file still fails, so the
      exclusions are file-scoped rather than a blanket pattern hole · pure
- [x] `npm run lint` green on the tree as it stands after tickets 085 / 087 / 088 — all three gates:
      boundaries (145 files), contrast (117 pairs), palette (147 files, 4 exclusions); `npm run
      build` green · compiler

## Boundaries

No `src/` change, no API, no i18n. The gate joins the two already wired to `npm run lint`
(`check-boundaries.mjs` and 084's `check-contrast.mjs`), so lint runs three scripts.

**This ticket will fail until 085, 087 and 088 are all complete — that is the point.** It is the
contract step of the expand–contract sequence, not an independent piece of work.

## Done when

`npm run lint` runs all three gates green, and reintroducing any raw palette class, arbitrary colour
value or stray `text-white` fails it.

## Blocked by

- [085](085-grid-theme-reads-tokens.md) — the two `cellStyle` hexes.
- [087](087-brand-colour-lives-in-the-mark.md) — the two gold kickers and the four brand `text-white`
  sites.
- [088](088-raw-palette-sweep.md) — everything else.

## Open questions

**Gate 3's scope has to be decided before the script is written, because as specified it does not
catch what the spec claims it catches.**

Spec 082 D-12 states that after these gates `src/` "contains no colour literal of any kind outside
`global.css` and the logo SVG". But the pattern it gives is `-\[#`, which matches only **Tailwind
arbitrary values**. A raw hex in a TypeScript string — exactly the form of the two `'#c62828'`
`cellStyle` values ticket 085 removes — would pass all three gates untouched. The claim and the regex
disagree.

Two ways to close it:

1. **Widen the gate** to `#[0-9a-fA-F]{3,8}\b` over `src/`, excluding `global.css` and the al-dawaa
   SVG. This makes the spec's claim true and would have caught the `cellStyle` values on their own.
   Cost: it needs an exclusion for any non-colour hex-looking literal, so the script must be run
   against the tree once to see what it flags before the pattern is fixed.
2. **Narrow the claim** to "no colour literal in a class attribute", and accept that a hex in a `.ts`
   string is caught by review rather than by lint.

Recommend (1) — the whole value of this ticket is that the rule stops depending on review, and the
one place the app has ever hidden a colour literal was a `.ts` string, not a class.

**Resolved: (1), widened.** Run against the tree first, as the option required: `#[0-9a-fA-F]{3,8}\b`
over `src/` flags nothing outside `global.css` and the al-dawaa SVG, so it needed no non-colour
exclusion — both files are excluded whole (each *is* the colour), and the pattern ships as written.

Two smaller decisions the build made, both to keep the exclusion paragraph operative rather than
decorative:

- The literal gate also matches `white`/`black` colour utilities (`bg-white`, `bg-black`, …), not
  just `text-white`. As specified, none of the four deliberate sites could ever have tripped the
  gate, so "the exclusions belong in the script" had nothing to exclude. Now they do, and the
  allowlist is keyed by file + class rather than by line number so ordinary edits don't rot it.
- All three patterns live in one script, `tools/check-palette.mjs`, not two. They share the walk and
  the report; the palette/literal split is a `[gate]` tag on each hit, which is what a reader needs.
  `npm run lint` therefore runs three scripts as the Boundaries section says, counting 084's
  contrast gate.
