# Rule: isolate by kind, and isolate the whole value

The app renders right-to-left under Arabic. A value from data that is not isolated can read
backwards there and look perfect in English. Spec 380 F24/F26 (measured in ticket 378 §2–§3)
replaced 095's "digits and a space" shape rule with this one.

## Isolate by kind, not by shape

Every value that comes from data is rendered isolated wherever the surrounding text can be RTL.
There is no "safe shape" list: 095's list was right about its own shapes and still let ranges,
signs and counts through (`15:00–18:00` → `18:00–15:00`, `-5.00` → `5.00-`, `40 / 200` →
`200 / 40`, `+966…` → `…966+`).

| Kind | Examples | Isolate with |
|---|---|---|
| **Machine value** | number, money, code, date, time, range, phone, count, key chord | `Ltr` (`@/core/ui/Ltr`, a `<bdi dir="ltr">`) |
| **Free text in either script** | name, address, note, server message | `<bdi>` (dir auto) |
| **A pair led by a machine value** | `code · name`, `date · time`, `phone · city` | `Ltr`, once, around the whole pair |

## Isolate the whole value, never its parts

A range, a `code · name` pair or `n / m` is **formatted to one string and isolated once**.
Isolating each end separately reverses it: the two isolates are laid out right-to-left.

- Build them with `formatRange`, `formatPair` and `formatCount` from `@/core/util/bidi`. Never
  `` `${from}–${to}` ``, never `{{a}} / {{b}}` in a locale template.
- A range **written with words** ("from {{from}} to {{to}}") needs each value isolated and
  nothing more, because the words carry the order.

## String-only sinks take `fsi`

A sink that takes only a string cannot hold a `<bdi>`: `title`, `placeholder`, a native
`<option>`, a toast, `document.title`, an AG Grid header name, and a value interpolated into a
`t()` sentence. Wrap the **whole** value in `fsi()` (`@/core/util/bidi`, FSI…PDI). Or isolate an
interpolated value through a `<Trans>` slot.

`fsi` is **never** used in a grid value, a `valueFormatter`, a cell renderer's text or an export:
its invisible characters reach Ctrl+C and the CSV/xlsx. An export that writes a header name strips
isolates (`stripIsolates`; the core xlsx writer already does).

## Grid cells

Grid cells are isolated by the core base `defaultColDef` every grid spreads
(`@/core/theme/grid-base`, F25, gated by `npm run lint`). A column with its own renderer isolates
its own whole values. `Ltr` is not a cell renderer: it would drop the column's `valueFormatter`.

## The tell

- A template literal or `.join()` that glues two data values with `–`, `-`, `/` or `·`.
- A locale template whose only content is `{{a}} <separator> {{b}}`.
- A `<Ltr>` around one end of a range.
- A data value in JSX, a `title` or a `t()` interpolation with no isolate.
- `fsi(` in a `valueFormatter`, a column file or an export.
