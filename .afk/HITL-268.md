# HITL — ticket 268 (settlement screen appears for a granted session)

## Q: Copy `ScreenGate` into the settlement feature, or graduate it to `@/core/ui`?

**Decision taken:** **Graduated** to `src/core/ui/ScreenGate.tsx`. Both existing copies
(`features/collection/inquiry/ScreenGate.tsx`, `features/reports/retail-invoice/ScreenGate.tsx`)
are deleted and all five shipped screens now import the one component.

**Why:** the ticket's own condition for graduating — "the copy would be the *second* one and the
component is genuinely identical" — is met twice over. There are already **two** copies (263 made
the second), and 261 §Out of Scope wrote the trigger down in advance: *"two copies is the
duplication the rule accepts, and a **third** area is the trigger."* Settlement is that third. The
two files were byte-identical apart from the namespace, the query and the optional-vs-required
`children`.

**Revisit if:** a fourth consumer needs a genuinely different gate shape (a per-call refusal arm, a
gate that renders no header). Then the shared piece is the *denial card*, not the whole gate, and
this component should shed the header rather than grow a variant prop.

### What the graduation had to parameterize

- **`query`** — the area's access query *options*, not just its key, so `retry: false` and
  `staleTime: Infinity` travel with it (257's ruling: react-query merges concurrent observers'
  options).
- **`can`** — unchanged; still the very predicate the nav leaf was built with.
- **`ns`** — new. The five `access.*` keys live in each area's namespace and their sentences
  legitimately differ ("No access to this screen" vs "No access to invoices"). Core owns the shape,
  not the copy.
- **`children` is now required** — 263's stricter contract, kept. A gate that silently rendered a
  bare header is a way for a screen to go missing without failing. That made
  `collection.shell.comingSoon` — the fallback the optional `children` rendered — unreachable, so it
  was **deleted** rather than left as a dead sentence a later reader would try to find a caller for.
  All four collection screens have had real bodies since 254–257.

## Q: `features/collection/settlement` needs the Collections access probe, which lives in `features/collection/inquiry/api.ts` — and a feature may not import a feature.

**Decision taken:** graduated the **shared half** of the probe to `src/core/collection/api.ts` —
`COLLECTION_ACCESS_KEY`, `collectionAccessQuery()` and `collectionAccessApi.access()`. The
**predicates stay with their screens**: `canOpenCollections/Acrs/Deposits/Attempts` in
`features/collection/inquiry/api.ts`, `canOpenSettlement` in
`features/collection/settlement/api.ts`.

**Why:** exactly the road `@/core/oms/api` (125), `@/core/bonus-buy/api` (118) and
`@/core/nphies/api` (211) each took when a second feature became a consumer — and `menu-model.ts`
already carries the comment explaining that rule. 253 deliberately left it in the feature because
that feature was the *only* consumer; that condition ended today. Moving only the shared half keeps
244 §10's "the grants are independent" true: a screen's reading of its own grant is that screen's
business.

**Revisit if:** the settlement feature ever wants a `Settlement/Access` probe of its own. It should
not — D1 makes it a fifth grant on the one call, not an area — but if 274 discovers the server
cannot extend `CollectionWeb/Access`, this is the file that changes.

**Note the ticket said** "the access call in the feature's own `api.ts`". Taken as intent (the
feature names its own door) rather than as a location, because the location it names is a lint
failure: `tools/check-boundaries.mjs` classifies `collection/inquiry` and `collection/settlement` as
two features and fails the import.

## Q: `canOpenSettlement` — optional or required on `CollectionAccessResult`, given the server does not answer it yet?

**Decision taken:** **required**. The predicate reads `=== true`, so the live four-boolean answer
lands as a denial and the leaf and route stay shut for every real session today.

**Why:** the contract (BackOffice spec 1173) owes five booleans. An optional field invites a screen
to treat a missing grant as an acceptable shape and grow a `?? true`. And a shut screen is the
*designed* posture for an unbuilt grant — D1 says the grant is the only off-switch, so no feature
flag was added to open it. Both sides of that line are proven by
`tools/settlement-drive.mjs` against a stubbed envelope, which is the only way to stand a session on
each side while the flag does not exist.

**Revisit if:** 274 finds the server names the flag differently (`canOpenSettlementAccount`, or a
grant on a separate probe). One-line change here plus the predicate.

## Q: Which i18n namespace — extend `collection`, or a new `settlement`?

**Decision taken:** a new `settlement` namespace, as the ticket specifies.

**Why:** "namespace == feature name" applies plainly — settlement is its own feature, sharing only
the area, the URL prefix and the probe. `reports` was the deviation (an AREA namespace) and it was
justified by a second report screen joining it; nothing here needs the inquiry feature's keys.
269–273 add to `settlement.json`.

**Revisit if:** a later slice needs to reuse an inquiry string verbatim. Copy the key; do not merge
the namespaces.

## Q: The scope control is "rendered but inert" — how inert?

**Decision taken:** three buttons in a `role="group"`, `aria-disabled` (not `disabled`), "My
branches" shown pressed, with a visible "Not active yet" note wired as `aria-describedby`.

**Why:** `core/ui/Button` already rules that a control unavailable *with a reason* stays focusable so
the reason can be reached; and showing "mine" pressed states D2's default rather than leaving a
reader to infer it. 270 replaces the whole component.

**Revisit if:** 270 finds the segmented control is the wrong affordance for three scopes at estate
scale (the spike used a dropdown in the header, `[ my branches ▾ ]`). Nothing else depends on this
markup.
