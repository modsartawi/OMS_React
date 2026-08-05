---
type: wayfinder-ticket
wayfinder: prototype
map: 222
status: done
blocked-by: 223, 225, 226
---

# 227 — The shape of the member screen

## Question

Build a throwaway prototype (`/prototype`, under `features/loy/__prototype__/`, mock data — no
server) and put concrete layouts in front of the user to react to. What is being decided:

- **The search-to-result transition.** The screen starts as one field on an otherwise empty page and
  ends as a dense member view. Does the field stay put and the member appear beneath it, does it
  collapse into a compact bar (the call-centre prototypes' chip-bar move), or does the result take
  over the page with the search as a way back? What does looking up a *second* member look like.
- **The member header.** 223 will have produced more general-information fields than a header can
  carry. Which are always visible above the tabs — identity, tier, points balance, status — and
  which live in a fuller panel below or behind a disclosure. This is the pane the user described as
  "general information"; it is not a tab, it sits above them.
- **Tabs.** Three tabs, or is one of the three actually the default view with the others secondary?
  Where the counts and the "last N" heading sit. How the header behaves as a long grid scrolls.
- **Density and palette.** The steel-blue POS palette is the app standard; this is a dense
  lookup-and-scan screen, closer to the call-centre console than to a form.

**Do not prototype the WPF screen.** The user's ruling on this map is that divergence is the point —
IC is where the data comes from, not the layout. A variant that reads as a ported XAML grid stack
has failed before it is shown. Design as though this screen were being invented for this portal,
because it is; consult `/frontend-design` if a variant needs an aesthetic direction rather than a
rearrangement.

Two or three variants, not one — a variant the user rejects is as informative as the one they take.
Link the prototype from this ticket; the decision is what gets recorded, the code is disposable.

## Answer

Prototype: [227-member-screen.PROTOTYPE.html](assets/227-member-screen.PROTOTYPE.html) — three
variants, light and dark, drawn in the shipped POS palette lifted verbatim from `src/app/global.css`.
Served over `npx vite --port 5199` and reviewed with the user in the browser. Mock data throughout;
**nothing driven against a live SIS.Api**, per this map's verification standard.

**The shape is B — the field collapses into an identity bar.** Empty page is a hero field and
nothing else; once a member resolves the field collapses to a slim bar and the member view owns the
screen. Rejected: **A** (search card as permanent furniture — one mental model and no transition to
design, but ~86 px of chrome above a screen whose whole job is scanning grids, and the member's name
is never first on the page) and **C** (a lookup rail with session recents — the only variant where
comparing two members is cheap, but ~250 px of width against an eight-column Sales tab and a
"this session" concept nobody asked for; furthest from this map's read-only-and-simple preference).

Eight decisions, in the order they bind:

1. **Two states, not one screen.** `/loy/members` is a centred hero field with a label, a submit
   button and one hint line — no grid furniture, no empty card, nothing else competing. A resolved
   member replaces it entirely.
2. **The bar carries the searched key, not the member.** `[Searched 0555000111] … [Change] [New
   lookup]` — **the name appears in exactly one place, the 19 px header line below.** The bar's own
   name was drawn and cut: it read as "who this is" when its only job is "what I searched".
   `Change` reopens the field in place, pre-filled; `New lookup` goes back to the empty field.
3. 🚩 **The member is in the URL: `/loy/members/:loyId`, open tab as `?tab=…`.** This **resolves and
   clears the map's *URL shape and deep-linking* fog item.** A lookup navigates, a refresh re-reads,
   a link works for a colleague, `/loy/members` bare is state 1. **The consequence, named because it
   is a behaviour not a detail:** the URL holds the **LoyId**, never what was typed, so a refresh
   after a *mobile* lookup re-reads by key and does **not** replay 225's two-call cascade — the
   `MemberByMobile` → `Member` sequence runs on submit only. The bar shows the typed key from
   navigation state and falls back to the LoyId on a cold load of the URL.
4. **The header is not a tab, and it is not sticky.** Identity line (name at 19 px), a key row
   (Loy ID · Mobile · Joined · Updated) and the chips sit above the tab strip; the whole thing
   scrolls away and the **grid's own header is what sticks**. A long grid gets the viewport.
5. **One headline number.** `PointsBalance` is the only 27 px figure on the screen, with
   `PointsBalanceAmount` as a subline (`≈ 561 SAR`); Pending, Expiring (+ "within 30 days") and Tier
   points sit beside it at label size. Expiring is the only one tinted — `--attention`, and only when
   non-zero.
6. **One disclosure, shut by default** (confirmed against the alternatives of open-by-default,
   promote-some-fields-up, and no-disclosure-at-all). Behind *More member details*: Email, Birth date,
   Gender code, National ID, Nationality code, City code, Preferred language, Insurance company — a
   responsive `auto-fit` grid, code values in mono so they read as keys. `Profile`, `AccrualFactor`,
   `RedemptionFactor`, `ExchangeRate`, `PointsExpireSoonDays` and `ProfileUpdated` are **not drawn
   anywhere** — machinery, not member.
7. **Activities is the landing tab**; Sales and Actions are peers, not secondary. **Only Actions
   carries a count** in the tab strip, because it is the only read with a real total (226) — a count
   on a capped tab would be a lie. The cap sentence and the at-cap warning sit in a caption row above
   the grid with the filter control pushed to the end; Actions puts `1–25 of 312` and the pager there
   instead.
8. **Chips are additive and rare** (230, drawn): tier always, member-type when not `M`, blocked when
   there is a reason. An ordinary Gold member shows **one** chip. A code the server did not translate
   is labelled as a code — "City code", "Gender code" (229) — and shown in mono.

Also drawn, to prove the column rulings survive a real layout: a return line's signed `Qty`/`Amount`
against its unsigned `UnitPrice`, an Actions sub-action falling back to its raw code on a LEFT-JOIN
miss, and the double-miss empty state as a neutral client sentence with the box unrewritten (225).

The prototype is throwaway and lives only as this asset — no `features/loy/__prototype__/` was
created, because there is no `features/loy/` yet to mount anything into; the question was arrangement,
and a static page answers it more cheaply than a scaffold.
