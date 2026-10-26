---
type: wayfinder-ticket
wayfinder: prototype
map: 580
status: done
blocked-by: 585
---

# 586 — How dark mode is derived without a dark design

## Question

The Figma file has no dark mode; the app ships one (screen-only, F19). **What does the DMSCO theme
look like in dark?**

Derive the dark table from 585's light mapping under the four rules that still stand (082 / 380):
R1 neutrals hold a lightness ladder at one temperature; R2 chromatics lift and flip their ink; R3
interaction moves toward contrast; R4 `-050`/`-800` are roles. Prototype the same two screens as
[584](584-how-much-of-the-hr-sites-scale-reaches-the-working-screens.md) in dark for the owner to
judge.

Also decide whether the login stays identical in both themes (as built) once the rest of the app
has a dark twin.

## Prototype

Built 2026-10-26 on `prototype/dmsco-density` (commit `95400ce1`, worktree
`C:\Playground\oms-react-proto-dmsco`, :5251 against staging), with 587's shell. The floating
bar's ← / → switches Light / Dark A / Dark B on the real Deliveries list and Delivery details.

Both candidates share 586's derived interactive family (R2: the light navy `#172031`, OKLCH H 262.6,
lifted to L .76 C .06): `--primary` `#9db2d8`, `-050` `#232e42`, `-border` `#3e4d69`, `-800`
`#c3d2ec`, dark ink on fills. `--ring` and `--cursor` take 585's one gold, `#fec33b`. The rail stays
the deep-navy gradient in both themes, and status families keep palette B's dark values.

- **Dark A, graphite.** Hueless neutrals, the same temperature as 585's light (R1). Palette B's
  dark lightness ladder is kept with the chroma set to 0: `#111111` page, `#1a1a1a` card, `#202020`
  card-2, `#252525` muted, `#2e2e2e` accent, `#eaeaea` ink, `#aeaeae` secondary ink, `#848484` ink-3,
  `#707070` field edge. Written into `global.css`'s `.dark`; **gate 184/184**.
- **Dark B, navy night.** Today's navy-tinted ladder (`#0a111d` page, `#111a28` card, …) with the
  same lifted navy. It's the prototype CSS override, and it breaks 585's hueless rule in dark only.

Recommended: **A**. It is the only one R1 allows once light is hueless, and the navy rail stands
apart from a graphite page where it merges into a navy one. The login stays identical in both
themes, as built (its ground is a dark photograph either way).

## Answer

Resolved 2026-10-26 by the owner, by eye on the prototype: **Dark B, navy night**. The
recommendation was A.

- **Neutrals in dark keep palette B's navy-tinted ladder:** `--background` `#0a111d`, `--card`
  `#111a28`, `--card-2` `#162131`, `--muted` `#1b2536`, `--accent` `#222e41`, `--foreground`
  `#e6ebf2`, `--muted-foreground` `#a3afc0`, `--ink-3` `#788599`, `--border` `#212c3d`,
  `--border-strong` `#2e3b4f`, `--divider` `#1a2433`, `--input` `#5a6780`, `--secondary`
  `#8794a8` / `-press` `#98a4b6`, `--grid-head` `#162131` / `-foreground` `#a3afc0`, and dark
  fill ink `#0a111d`.
- **So the two themes differ in temperature on purpose:** light is hueless (585) and dark is
  navy. R1 still holds within each theme, with one temperature per theme. The spec states this
  so nobody "fixes" one theme to match the other.
- **Interactive family:** 586's lift of the navy (R2, H 262.6 held): `--primary` `#9db2d8`,
  `-050` `#232e42`, `-border` `#3e4d69`, `-800` `#c3d2ec`. It replaces palette B's `#79a7ec`.
  Links are underlined (585).
- **`--ring` and `--cursor`** are 585's one gold, `#fec33b`, which replaces `#fdc801`.
- **Unchanged:** the rail keeps its deep-navy gradient in both themes (587), the status and
  command families keep palette B's dark values, and the login stays identical in both themes.
- **Measured:** with these values in `.dark` on the prototype branch (`a9755710`), the gate
  passes all 184 pairs in both themes.
