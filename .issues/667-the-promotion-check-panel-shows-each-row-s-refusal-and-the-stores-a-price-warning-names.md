---
status: done
spec: C:\Work\DMSCO\BackOffice\.issues\3201-hungerstation-promotions-are-made-on-oms-react-and-sent-to-hungerstation-spec.md
blocked-by: 666 (live: BackOffice 3212)
---

# 667 — The promotion check panel shows each row's refusal and the stores a price warning names

## What to build

A **Check** panel in the editor (`POST Promotions/{id}/Check`), run on demand and before Send.

- **Refusals** per row and per header field, in words:
  - material not on the HungerStation material list, or disabled or deleted there;
  - a percentage outside 1–100, a non-positive value, more than 3 decimals;
  - start not before end, end already past;
  - EN or AR display name missing;
  - the name already used on this chain;
  - more than 20,000 SKUs;
  - no stores.
- **Warnings** (a different colour; they never block): a final price or amount-off not below our
  price at some stores, naming those stores. Use the words "HungerStation will refuse this material at
  these stores", not "error".
- Send is disabled while Check reports any refusal. Warnings do not disable it.
- The preview grid marks each refused row, and a filter shows refused rows only.

Wire shapes: the contract's Check section (added by BackOffice 3212).

## Spine reach

UI → app (BackOffice doors, stubbed)

## Proof (→ `tdd` red-green cycles)

- [x] `checkSummary`: refusals block Send, warnings never do; per-row grouping (vitest)
- [x] drive (LTR + RTL), against stubs: each refusal code renders on its row/field; a price warning lists its stores; Send disabled then enabled after a fix
- [x] `npm run typecheck`, `npm run lint`, `npm test` green

## Boundaries

oms-react only.

## Done when

Every Check refusal and warning in the contract renders from stubs, and Send follows them.

## Blocked by

[666](666-an-hq-user-makes-a-strikethrough-promotion-pasted-from-excel-and-sends-it-to-hungerstation.md)

## Comments

- 2026-10-29 (built, `impl/667`): **done against stubs only. No BackOffice door exists, and the
  contract has no Check section yet (BackOffice 3212).** So "done" means vitest + typecheck + lint +
  the drive green against stubbed envelopes (real `errors[]` shape). Nothing was called live.
  - **One Check shape for both answers:** `check-summary.ts` — `checkSummary` (refusals per header
    field and per row by material, a material named twice merged, warnings counted apart; Send is
    blocked by any refusal OR `sendable: false`, never by a warning) and `checkOfRefusal`, which reads
    a DHS-00018 Send refusal's `data` as the same `HungerStationPromotionCheckResult`, defensively.
    It replaces 666's `row-refusals.ts` (deleted, its tests moved over).
  - **Panel** (`CheckPanel.tsx`, under the editor body, drafts only): **Check now** (`POST …/Check`,
    no body, on the SAVED draft — disabled until saved and while dirty); header refusals with their
    field; refused rows listed (first 20, the rest counted); price warnings in the attention colour,
    "HungerStation will refuse this material at these stores:" + each store as one `code · name`
    isolate. Header refusals also sit under their own Field (`error`, so `aria-invalid`); `stores`
    and `items` under their sections.
  - **When it runs:** on opening a saved draft (incl. right after the first save, which re-mounts the
    editor on its id), after every later save, on demand, and **before Send** — Send runs Check first
    and opens the reason dialog only on a clean answer. A new paste drops the old answer.
  - **Send** is disabled while the answer refuses (`data-send-blocked`, title says why); enabled
    again after fix → save → clean check. Warnings never disable it.
  - **Preview grid:** the Check column says the refusals in our words (else "HungerStation will refuse
    it at N stores"); refused rows `bg-danger-050`, warned rows `bg-attention-050`; a **Refused rows
    only** chip filters the grid. Each row carries its Check answer as row data (a value getter reading
    outside state left AG Grid's cells stale — caught by the drive).
  - **Words:** each code is said in our words (`check.codes.*`, EN + AR); a code we do not know shows
    the server's `message`. 666's drive check now expects our words for `NO_SKU`.
  - **Drive 285/285** (183 before + 102 for 667). § 11 (LTR + RTL), its own check door over 666's write doors; 666's doors gained a clean
    `check` (Save and Send now call it). **Renumbered:** 669's section, the second "§ 6", is now **§ 10**
    (header comment, labels, INDEX line); the header lists the sections.
  - 🚩 **Assumptions for the contract (BackOffice 3212):** (1) check codes `NO_SKU`,
    `MATERIAL_DISABLED`, `MATERIAL_DELETED`, `PERCENT_RANGE`, `VALUE_NOT_POSITIVE`, `VALUE_DECIMALS`
    (rows) and `NAME_IN_USE`, `DISPLAY_NAME_MISSING`, `WINDOW_ORDER`, `END_PAST`, `TOO_MANY_SKUS`,
    `NO_STORES` (header), in `HUNGERSTATION_PROMOTION_CHECK_CODES`; (2) header `field` values `name`,
    `displayNameEn`, `displayNameAr`, `startAt`, `endAt`, and promotion-level `items` / `stores`
    carried as header problems (the model has no other place for them); (3) a price warning carries
    store codes only — names come from the stores picker; (4) Check answers 200 with `sendable:false`
    rather than refusing, and DHS-00018 on Send carries the same body.
  - **Open:** should Save itself return the Check answer (3212: "Save reports them") instead of the
    editor calling Check after each save? Built as a second call; one round trip if the door adds it.

