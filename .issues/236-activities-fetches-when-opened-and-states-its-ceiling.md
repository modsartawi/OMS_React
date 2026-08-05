---
status: open
spec: 231
blocked-by: 233
---

# 236 — Activities fetches when opened and states its ceiling

## What to build

The first tab, and with it **the whole tab shell** the other two slot into. Activities is the tab an
agent lands on, because "what happened to my points" is the question that brought them here.

**Six columns:** Date (`formatDateTime`) · Activity · **Points** · Status · Expires · Reference.

- 🚩 **`points` arrives already signed.** `LoyActivityService.AddActivity` negates `SpendPoints` in
  place for debits, so there is **no client-side debit/credit table** and none is needed — 223's
  original "derive the sign from `ActivityType`" was struck by 226.
- Signed, `text-end`, tabular numerals, **exactly two decimals always** (`accrualFactor` is
  `0.285714286`, so fractional points are routine), and 🚩 **never coloured** — the Activity column
  already names the direction in the server's own English, so the sign is a second reading of a fact
  already stated in text. A colour-blind agent loses nothing.
- **Expires** is blank when `points <= 0` (the server's own rule) and on a sentinel date.
- **Status earns its place**: a *Pending* accrual is the commonest "why isn't my balance right", and
  without the column a pending row looks identical to a posted one — the tab would silently
  misexplain the balance it exists to explain.
- 🚩 **No client-side total, ever.** The server rounds each row, so a sum of rounded rows will not
  equal the header's `pointsBalance`.

**The tab shell, established here:**

- **Lazy fetch on first open**, cached per member. Consequence that simplifies everything downstream:
  **only the open tab can be loading or failed**, so there is no invisible broken tab to signal.
- **`?tab=` in the URL** so a link lands where it meant to; an unknown value falls back to Activities
  rather than erroring.
- **The ceiling is always stated.** `"Most recent 100 activities."`, plus an at-cap warning
  (`"there may be older activity not shown"`) when the returned count **equals** the cap. At
  exactly-100 that warning is a harmless false positive; silence would be a false **negative** on a
  4,000-row member, which is the failure that matters. 🚩 **A bare row count is never shown** — it
  reads as completeness.
- **Sort and filter are on**, because the entire window is already in the browser and the caption
  says which window it is. (Actions is the opposite case and says so by contrast — see
  [238](238-actions-pages-through-a-real-total.md).)
- **Empty** is a sentence in this tab's own words — *"No loyalty activity for this member."* — never a
  shared "No data". A rejected option was one generic empty/error pair; it costs the sentence that
  tells the agent *what* was absent.
- **Failed** is the existing `core/ui/ErrorBanner` **inline in the tab body**, message via
  `apiErrorMessage(err, fallback)`, plus a **Retry scoped to that tab**. No toast — the state is
  already fully visible in the tab being looked at. The header and other tabs are untouched.
- **Empty and failed are never conflated.** By the time a tab fetches the member exists — only the
  *member* call can refuse a bad key, and the reports answer `[]` for a member with no history.

**No row links.** Checked, not assumed: no route accepts an `ActivityId` or a reference number, and
`oms/document/:documentNo` is a different identifier space that would 404 on every row.

Ordering note, worth knowing and not worth a caveat on screen: the source is `ORDER BY ActivityId
DESC` — **insertion order, not date order** — so a backdated posting sorts by when it was written.

## Spine reach

model · **api** (`LoyWeb/Reports/LastActivities/{loyId}`) · **logic** (`tab-volume`, pure) ·
**component/route** (the tab strip + `?tab=`) · **i18n** · test

## Proof (→ `tdd` red-green cycles)

- [ ] `tab-volume` — the caption names the ceiling; the at-cap warning fires at exactly the cap and
      not below; a bare row count is never produced · **pure**
- [ ] `tools/loy-member-drive.mjs` (extended) — Activities loads on landing; a second tab does **not**
      fetch until opened; a 40-row member shows the caption without the warning and a 100-row member
      shows both; a stubbed failure shows the inline banner with a Retry that refetches only that
      tab; an empty member shows the Activities sentence; `?tab=` survives a reload · **flow**

## Boundaries

- **New API dependency:** `GET LoyWeb/Reports/LastActivities/{loyId}` — BackOffice, not built.
  It is a raw-SQL read with **no existence check**, so a missing member yields `200 []`, not a
  refusal. 🚩 The realistic failure is a **raw 500 with no envelope** (`ExecuteAsync` rethrows
  anything that is not a `DomainException`) — which is what earns the Retry, and why the fallback
  string is what the agent actually reads there.
- 🚩 **Reuse, do not rebuild:** `core/ui/ErrorBanner` (verified, in `core/ui`) and `formatDateTime`.
- New `loy.json` keys for the captions, the empty sentence and the tab labels.

## Done when

`tab-volume` is green, the tab strip works with `?tab=`, a tab fetches only when opened, and the
drive shows the below-cap / at-cap / empty / failed-with-Retry states.

🚩 Nothing driven against a live SIS.Api.

## Blocked by

[233](233-one-field-resolves-a-member.md) — a tab needs a resolved member to hang off.
