---
type: wayfinder-ticket
wayfinder: grilling
map: 793
status: done
blocked-by: 795
---

# 797 — What parameters may an author declare, and how do they bind to panels?

## Question

Using the research on run-time parameters, settle:
- **The parameter types** v2 offers, each with its default, whether it is required, and whether it
  takes several values.
- **Where a parameter lives:** on a view, on a board, or both, and what happens when a board shows
  a view that declares its own.
- **Binding:** how the author maps a parameter onto each panel's filters or measures, and how
  that sits beside v1's per-panel filter opt-out.
- **Board filters:** confirm or overrule the charting assumption that v1's six board filters become
  the built-in parameters, so there is one strip.
- **Permalinks and the AI:** how parameter values travel in the URL, and whether `create_view` may
  declare a parameter.
- **Validation:** what the server refuses (an unknown member, a threshold on the wrong unit), and
  the new refusal codes.

## Answer

Done 2026-11-06 (grilling). The owner chose the kinds and confirmed the other rulings as a list.
The research is [793-run-time-parameters.md](../docs/research/793-run-time-parameters.md).

1. **Seven kinds (owner: every researched kind).** Only `members` takes several values; the
   others take one.

   | Kind | What it is | Default |
   |---|---|---|
   | `period` | a relative token or a fixed range | a token, e.g. `yesterday` |
   | `members` | values of any category dimension in the model; open search, or a list the author pins; one or several values, as the author sets | a list, empty meaning "all" |
   | `grain` | day, week or month, from a subset the author allows | one grain |
   | `threshold` | one named measure, an operator (`gt/gte/lt/lte`) and a number in the measure's display unit; the server turns it into the stored unit (5% is stored as 0.05) | "off" |
   | `topN` | 1 to 100 rows | N |
   | `measure` | one measure from the author's list | one option |
   | `breakdown` | one dimension from the author's list | one option |

2. **Every parameter has a default.** "Required" only means a viewer cannot clear it. This
   follows Metabase, not Lightdash, so a scheduled run (801) never meets an empty value.
3. **Parameters live on the container (board or report, as 801 decides), never on a view.** A
   view keeps its own saved period, filters and grain. A bound parameter overrides them, the way
   v1's board period does, so a view never brings a clashing declaration. `create_view` is
   unchanged. Declaring parameters belongs to the report-composing tool (802).
4. **Binding is explicit, saved, and pre-filled to match.**
   - Adding a parameter binds it to every panel that can take it.
   - The author may unbind a panel, or point a `members` parameter at another dimension on that
     panel (for 799's cross-area case).
   - The binding list replaces v1's `optOut` for parameters. The cross-filter keeps its opt-out.
   - **No silent drop.** A binding that cannot apply is refused when the item is saved. A panel
     that a parameter does not reach says so on screen. This settles 795's flag that v1 drops such
     a filter silently (`AnalyticsQueryCompiler.cs:166-171`).
5. **What each kind may bind to:**
   - **`threshold`:** a panel that has that measure and a category breakdown. A KPI tile cannot
     filter itself to empty.
   - **`topN`:** a panel with one category dimension and no time dimension. Top N per series over
     time is out of scope, because it needs Cube's preview `rank` or two queries.
   - **`measure` / `breakdown`:** a panel where **every** allowed option passes the one-view rule,
     the shape table and the 92-day percentile cap, checked when the item is saved. The colour-slot
     map is saved for every allowed breakdown.
6. **One strip. The charting assumption is confirmed.**
   - v1's six board filters become six ready-made parameters. A new board or report starts with
     them, and the author can delete any of them.
   - On read, the server converts a v1 board:
     - its saved `filters` become the defaults;
     - v1's implicit rule (the dimension breaks down the panel's measures, minus `optOut`) is
       computed once into explicit bindings.
7. **The URL.**
   - Each parameter's author-set `name` is its query key. The name must be a slug, unique within
     the item.
   - The six ready-made parameters keep v1's names (`period`, `city`, `region`, `store`,
     `channel`, `country`), so every v1 permalink still opens.
   - How values are written:
     - several members repeat the key;
     - `name=` means cleared;
     - a threshold is written `name=gt:5`.
   - `tv`, `refresh`, `cross` and `crossFrom` are reserved, and a parameter named with one is
     refused at save.
   - A URL value outside a declared list falls back to the default and the viewer is told. The
     server is the authority.
8. **SIS.Api resolves the parameters.** A panel query carries the item, its revision, the panel
   and the parameter values. The server applies the bindings, so the web, schedules and the AI
   take one path. The exact wire shape stays in the map's "How the analytics store changes" fog.
9. **Two new refusal codes.** 406 and 407 keep their v1 meanings.
   - **`ANALYTICS-411`, an invalid declaration at save:** an unknown dimension, a binding that
     doesn't fit, an option that breaks a shape rule, a reserved or duplicate name, or a bad
     default. It names the parameter and the panel.
   - **`ANALYTICS-412`, an invalid value at run:** a value outside the type or the list, an
     unknown member, a non-number threshold, or N out of range. It names the parameter.
10. **Out of scope:** linked filters (picking a city narrows the store list), and top N per series
    over time.

New terms in `CONTEXT.md`: **Parameter** and **Binding**.
