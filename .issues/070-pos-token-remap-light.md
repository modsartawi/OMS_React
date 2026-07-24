---
type: wayfinder-ticket
wayfinder: prototype
map: 068
status: done
blocked-by: 069
---

# 070 — The POS token remap (light)

## Question

What is the exact light-mode value for every one of our semantic tokens, once the PosTheme scale is
the standard? This is the ticket the whole map hangs off — 071, 073 and 074 all build on its table.

Decide and prove:

- **The mapping.** POS value → our semantic name, one row per token. E.g. `--background` ← `--surface`
  `#F4F7FA`; `--card` ← `--panel` `#FFFFFF`; `--foreground` ← `--ink` `#19232E`;
  `--muted-foreground` ← `--ink-3` `#8593A1`; `--border` ← `--border` `#E3E9F0`;
  `--primary` ← ? (the POS `--key` `#586674` for neutral commands, or `--accent` `#2F63A6`) —
  that one is a genuine choice, not a lookup, because our `--primary` currently means "warm black,
  the default button" and POS splits that role between `--key` and `--accent`.
- **The additions.** Which POS-only tokens we adopt as new names (`--ink-3` / `--border-strong` /
  `--divider` / `--panel-2` / `--attention` / `--on-sub` / the five `--fam-*`) and what their
  Tailwind utility names become via `@theme inline`.
- **The orphans.** What happens to `--sidebar`, `--sidebar-accent`, `--sidebar-active`, `--ring`
  and `--secondary`, which PosTheme has no answer for. The sidebar is a back-office surface the till
  simply doesn't have — its values have to be *derived* from the POS scale, not copied.
- **Colour space.** Our file is `oklch`, PosTheme is hex. Pick one and say why (converting to oklch
  keeps the file coherent and makes deriving the dark twin in 071 tractable; keeping hex keeps the
  values verifiably identical to `PosTheme.xaml`).

Deliver a prototype asset (`070-pos-token-remap.PROTOTYPE.html`) showing: the full swatch board with
every token named and valued, and at least **two existing screens re-tinted** — Deliveries (grid-heavy)
and Document Details as it stands today — so the owner can see what the swap actually does before it
is real. The hardcoded-colour hit list from 069 must appear as a visible "will not re-tint" callout.

Do **not** edit `global.css` — this ticket produces the approved table, `/to-spec` carries it into
the spec and `/implement` applies it.

## Comments

**From [072 — The command-family taxonomy](072-command-family-taxonomy.md) (done):** the `--fam-*`
question in "The additions" above is now settled — do **not** port all five. Adopt exactly two family
tokens, both POS values under our names:

- `--fam-fulfilment: #2E7D5B` (POS `--fam-fulfil`)
- `--fam-cancel-request: #5D5A93` (POS `--fam-admin`)

Not ported: `--fam-sales`, `--fam-loyalty`, `--fam-admin` — a back office sells nothing, runs no
loyalty tier, and "admin" names a nav area rather than a command family. `--fam-insurance`'s *value*
survives only as the prescription / e-Rx accent, under a name 073 gives it.

Two further additions 072 surfaced:

- `--danger-800: #8E2A2F` — text colour for the danger-**outlined** override button (Force Cancel).
- A **fifth pill severity**, `bad`, on `--danger` / `--danger-050` / `--danger-border`. PosTheme has
  four (ok / go / warn / mute) because a till has no cancelled state; our document does.

Note also that `--success` earns **no button** on the Document Details screen — nothing there is a
positive outcome. It appears in the status rail only. Don't map `--primary` to it.

**From [071 — The derived dark twin](071-pos-token-dark-twin.md) (done):** one constraint lands back on
this table. **`--attention` `#B4791F` must never be a filled-button ground in light** — white measures
3.69:1 on it, `--foreground` 4.31, `--attention-800` 1.82; the hue sits at the luminance where no ink
clears AA. It stays a pill / border / icon colour (the pill form measures 5.91:1) and 072 gives it no
button, so nothing changes today. A future attention-filled button needs a darker fill token of its own
(`#8E6318`, white at 5.32:1), not a re-use of `--attention`. Dark is unaffected.

## Answer

Approved by the owner, 2026-07-24, against
[assets/070-pos-token-remap.PROTOTYPE.html](assets/070-pos-token-remap.PROTOTYPE.html) — swatch board
plus Deliveries and today's Document Details rendered twice (warm neutrals vs POS steel), with the
069 hit list as a visible "will not re-tint" callout. `global.css` was not touched.

### The four decisions

**1. `--primary` ← POS `--accent` `#2F63A6`, not `--key`.** The decisive fact: POS `--key` `#586674`
is *the same value* as `--ink-2`, which becomes our 358-use `--muted-foreground`. Mapping `--primary`
there would paint every default button the exact colour of dim body text. And all 126 `--primary`
call sites are actions or accents — filled buttons (17 + 9 `/85` hovers), `text-primary` on active
tabs / badges / bullets (33), `border-primary` on selected rows (26), `bg-primary/10` tints (15) —
**not one is body ink**, so the steel blue lands as an improvement on every one of them. POS `--key`
still gets a home: our dead `--secondary`.

**2. Colour space: hex**, replacing `oklch()`. Values stay byte-verifiable against `PosTheme.xaml`;
`core/theme/ag-grid-theme.ts` is already a hand-mirrored *hex* copy (069 §4), so one notation covers
both files and 074 becomes copy-paste; Tailwind 4 resolves `bg-primary/10` through `color-mix`
identically for hex and oklch, so no utility changes behaviour. 071 still *derives* the dark twin in
oklch space — it just emits hex.

**3. Additions: 21 tokens → 43.** Nineteen originals keep name and role and only change value;
`--secondary` / `--secondary-foreground` (both dead, 0 uses) flip role to carry POS `--key` / `--on`.

**4. Orphans:** `--ring` ← `--primary`; `--input` ← POS `--border-strong`; `--secondary` ← POS `--key`;
the four `--sidebar*` **derived** — owner picked the **light rail** (option A).

### The table — light mode, final

| Token | Value | Source | Note |
|---|---|---|---|
| `--background` | `#F4F7FA` | POS `--surface` | 46 uses. The ground finally stops being paper. |
| `--foreground` | `#19232E` | POS `--ink` | 26 uses. |
| `--card` | `#FFFFFF` | POS `--panel` | 59 uses. Value unchanged; only its *contrast* changes. |
| `--card-foreground` | `#19232E` | POS `--ink` | Dead (0) but declared; tracks `--foreground`. |
| `--card-2` | `#FAFBFC` | POS `--panel-2` | **New name.** Second panel tier — 073's rail ground, grid zebra. |
| `--muted` | `#EEF2F6` | POS (reference's neutral ground) | 75 uses. |
| `--muted-foreground` | `#586674` | POS `--ink-2` | **358 uses — the most-felt swap in the app.** |
| `--ink-3` | `#8593A1` | POS `--ink-3` | **New name.** Replaces the `text-muted-foreground/60` idiom. |
| `--accent` | `#E4EAF1` | **derived** | 34 uses, a *hover ground*. **Do not carry POS `--accent`'s name across** — theirs is the primary action. Derived one step below `--muted` so hover reads over a muted chip. |
| `--accent-foreground` | `#19232E` | = `--foreground` | Dead (0); kept as `bg-accent`'s declared partner. |
| `--border` | `#E3E9F0` | POS `--border` | **218 uses.** |
| `--border-strong` | `#CBD6E2` | POS `--border-strong` | **New name.** Table-head rule, action-bar rule, ghost edge. |
| `--divider` | `#EDF1F5` | POS `--divider` | **New name.** Lighter than border — row rules inside a table. |
| `--input` | `#CBD6E2` | POS `--border-strong` | 45 uses. Fields read stronger than card edges, as POS draws them. |
| `--ring` | `#2F63A6` | **derived** = `--primary` | 15 uses + the repo's one `var()` read. Terracotta retired; `outline-offset:2px` keeps a white gap so it still reads on a primary button. |
| `--primary` | `#2F63A6` | POS `--accent` | **126 uses.** |
| `--primary-050` | `#E9EFF7` | POS `--accent-050` | **New.** Selection ground, tint badges, info. |
| `--primary-border` | `#C6D6EC` | POS `.pill.go` inline | **New.** Completes the fourth severity family. |
| `--primary-800` | `#27538C` | POS `--accent-700` | **New.** Press state *and* ink on `-050` (today's `hover:bg-primary/85` lightens — wrong direction on blue). |
| `--primary-foreground` | `#FFFFFF` | POS `--on` | 15 uses. |
| `--secondary` | `#586674` | POS `--key` | Dead (0) → revived as the neutral filled button. |
| `--secondary-press` | `#495562` | POS `--key-press` | **New.** |
| `--secondary-foreground` | `#FFFFFF` | POS `--on` | Dead (0); flips meaning with `--secondary`. |
| `--success` / `-050` / `-border` / `-800` | `#1E874B` · `#E7F3EC` · `#BFE0CD` · `#155F36` | POS + `.pill.ok` inline | **New family.** No token exists today — 55 raw `emerald-*` sites. |
| `--attention` / `-050` / `-border` / `-800` | `#B4791F` · `#F8F0DE` · `#E7D3A3` · `#7C5410` | POS + `.pill.warn` inline | **New family.** 75 raw `amber-*` sites. |
| `--danger` / `-050` / `-border` / `-800` | `#C23B41` · `#FBECEC` · `#E7BFC1` · `#8E2A2F` | POS + `.pill.warn` peer | **New family.** `-800` is 072's Force-Cancel ink. 87 raw `red/rose-*` sites. |
| `--destructive` | `var(--danger)` | alias | **Compatibility alias** — 14 call sites keep working untouched. |
| `--destructive-foreground` | `#FFFFFF` | POS `--on` | Dead (0). |
| `--sidebar` | `#E9EEF4` | **derived** | Option A, light rail. |
| `--sidebar-foreground` | `#19232E` | **derived** = `--foreground` | |
| `--sidebar-accent` | `#DCE5EF` | **derived** | 3 uses (active/hover ground). |
| `--sidebar-active` | `#2F63A6` | **derived** = `--primary` | 3 uses. Was terracotta. |
| `--fam-fulfilment` | `#2E7D5B` | POS `--fam-fulfil` | From 072. Reschedule · Change Store. |
| `--fam-cancel-request` | `#5D5A93` | POS `--fam-admin` | From 072. Request Cancellation · Withdraw Request. |
| `--radius` | `0.625rem` | **unchanged** | POS declares no radius token; 185 `rounded-lg/md` keep their geometry. |
| `--font-sans` | Inter / Readex Pro | **unchanged** | POS is WPF — no web font contract. |

### The rulings that shaped it

1. **There is no `--info` token.** POS declares no info hue, and now that `--primary` *is* steel blue,
   an info token would be a second blue three shades from the first — two tokens the eye can't tell
   apart and the reader can't choose between. Informational states use `--primary` / `--primary-050`.
   **This is a constraint handed to 077: four severity families, not five.** The 15 raw `blue/sky-*`
   sites sweep into primary.
2. **Severity naming reconciled with our vocabulary.** 072 wrote `--danger-800`; our existing token is
   `--destructive`. Rather than run two spellings, the family is `--success` / `--attention` /
   `--danger`, each with `-050` ground, `-border` and `-800` ink, and `--destructive: var(--danger)`
   stays as a compatibility alias. `--primary` takes the same four tiers, which is what makes 073's
   pill rail (ok / go / warn / bad) mechanical rather than bespoke.
3. **Three POS tokens deliberately not adopted.** `--disabled` / `-ink` / `-border` (we express
   disabled as `disabled:opacity-45`; adopting them means rewriting every disabled control for no
   gain), and `--on-sub` (= `text-primary-foreground/80`, two sites).
4. **`#0B7C8C` reserved, unnamed.** POS `--fam-insurance` survives only as the prescription / e-Rx
   accent per 072; **073 names it**, this ticket does not declare it.
5. **Sidebar = light rail.** The dark steel band (option B) was rejected because it competes with
   073's document identity header — the POS reference puts its one dark band on the *document*, and
   two dark bands meeting at a corner stops either being special.

### Zero call-site churn holds

069 §1 proved every token is consumed as a Tailwind utility with exactly one `var()` read
(`:focus-visible`, which needs no change). **This table requires zero `.tsx` edits.** What it does
*not* fix, unchanged from 069: the 249 raw palette occurrences in 41 files (→ 077, which now has four
families × four tiers to sweep into), `ag-grid-theme.ts`'s 9 params × 2 modes (→ 074; the prototype's
`--grid-*` values are a suggestion, not a decision), the two `#c62828` `cellStyle` overrides, the two
brand surfaces (→ 075 — navy `#002554` against steel `#2F63A6` is the collision), and all of dark mode
(→ 071).
