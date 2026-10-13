# HITL — ticket 479 (Deliverect catalog: whitelist and platform exclusions)

## Q: Does "Push catalog now" carry a reason?
**Decision taken:** No. A confirm modal with an account field; POST `Catalog/Push?account=` with body `{}`. The answer (`fileId`, `status`, `rows`) shows in the dialog; DLV-00011 shows inline with Deliverect's answer.
**Why:** The contract's Push section names no body and no reason ("Writes carry a mandatory reason where a section says so"). This follows the 478 Retry precedent.
**Revisit if:** 2623 takes `{ reason }`. The dialog would then become a ReasonDialog.

## Q: How does `api.post` send `?account=`?
**Decision taken:** Added an optional third `params` argument to `api.post` in `src/core/api.ts`, built through the same `buildQuery` that `get` uses. Covered by one vitest case.
**Why:** api-envelope rule. The first version built the query string by hand; /code-review flagged it.
**Revisit if:** —

## Q: What does Restore do on a row that is both deleted and disabled?
**Decision taken:** Restore undoes ONE step. A deleted row comes back as it was before the delete (still disabled if it was). A disabled row is enabled. Delete keeps the disabled flag.
**Why:** Conservative. A restore never puts on sale a material someone had disabled for a separate reason. The spec-review asked for an owner ruling.
**Revisit if:** The owner wants Restore to make the row fully active in one step.

## Q: Header row in a paste or a sheet
**Decision taken:** A FIRST line or cell with no digit at all ("Material", "رقم المادة") is skipped as a header and the screen says so. Every other value is sent as typed, and the server judges it (DLV-00012).
**Why:** A sheet's header would otherwise get the whole import refused by DLV-00012.
**Revisit if:** Material numbers can have no digit at all, or the owner wants a header refused instead. Known edge: a header on the same line as numbers ("Material, 101234") is sent and comes back unknown.

## Q: "Refuse the file client-side over 5000 rows" — rows or distinct materials?
**Decision taken:** Rows. A sheet with more than 5000 non-blank entries in column A (repeats included, header excluded) is refused and not loaded. A PASTE is refused when it has more than 5000 DISTINCT materials, which is what the request would carry.
**Why:** The ticket's words for the file. The contract's DLV-00012 counts the rows sent.
**Revisit if:** The owner wants both to count distinct materials.

## Q: A sheet with more than one column
**Decision taken:** Refused with "keep only the material numbers in the first column", rather than guessing which column holds them.
**Why:** The ticket says "an .xlsx with one column". Reading the wrong column would import names as materials.
**Revisit if:** The owner wants column A read regardless.

## Q: Push when the account list is refused or empty
**Decision taken:** A typed account key, the same way 477 handles an Accounts 403. Also typed when the read holds no active account. After a successful push, the same account cannot be pushed again by a second click.
**Why:** The briefing's Accounts-403 ruling, applied here. /code-review raised the empty-list case and the double push.
**Revisit if:** Accounts rides any Deliverect grant (see Contract gap).

## Q: Inactive platforms in the exclusion editor
**Decision taken:** Every platform the Platforms read lists gets a box, an inactive one marked "(inactive)". Keys the read does not list stay excluded, shown as read-only chips, and are always sent back.
**Why:** The briefing's exclusion trap ruling.
**Revisit if:** —

## Q: xlsx reader graduation — what moved?
**Decision taken:** Moved with `git mv`: `features/oms/central-invoice/xlsx.ts` → `core/util/xlsx-read.ts`, `xlsx.test.ts` → `core/util/xlsx-read.test.ts`, and `__fixtures__/deliveries.xlsx` → `core/util/__fixtures__/`. The reader's code is unchanged; only its doc comment changed. The one test case that fed central-invoice's `deliveryColumn` moved unchanged into `central-invoice/delivery-list.test.ts`, because core may not import a feature. `CentralInvoicePage.tsx` was repointed. The central-invoice drive gives 64/65 both on this branch AND on a clean checkout of e0cb864. The one failure ("A: no Document reload after a send") is pre-existing and not related to this change.
**Why:** Briefing ruling. Behaviour unchanged.
**Revisit if:** —

## Q: The sibling drives' menu checks
**Decision taken:** The orders drive's check 1 now reads the first two leaves, and its "only canViewOrders" session also drops `canManageCatalog`. The stores drive's list of built leaves gains `/deliverect/catalog`. A header note was added to each. `menu-deliverect.test.ts` gained a catalog-only case.
**Why:** The new leaf follows Orders by design.
**Revisit if:** —

## Contract gap

- **Platforms behind `canManageTerms`.** The catalog's exclusion editor (on `canManageCatalog`) needs `GET Platforms`. When it is refused or still loading, the editor shows "platform list unavailable" (or a loading line) with NO boxes and Save disabled. Never an empty list that would send `[]`. The drive covers the 200 and 403 paths. **Ask:** let `Platforms` and `Accounts` ride any Deliverect grant.
- **Accounts behind `canManageTerms`.** Push needs the account. On a 403 it falls back to a typed key (the drive covers 200 and 403). **Ask:** as above.
- **PUT Whitelist / PUT Exclusions answer shapes are unspecified.** Nothing is read from them, and the list is refetched. **Ask:** name them.
- **Push body and reason are unspecified.** It sends `{}` with no reason. **Ask:** confirm.
- **Whitelist PUT refusals are not listed.** DLV-00004 is presumably the one; any refusal shows in the dialog with its code. **Ask:** list them.

## Review notes
- /code-review, applied: paging keeps the submitted search; a page past the end snaps back to the last page; a second push of the same account is blocked; a new push clears the old answer; a file's header and repeats are reported; a stale file read cannot overwrite a newer one; `excludedPlatforms` is null-safe; `api.post` takes params. Not applied: the app-wide `figure` duplicate (it is now single-sourced inside the feature in `whitelist-state.ts`; graduating it app-wide is not this slice's job).
- /standards-review, applied: `figure` single-sourced; `PlatformChip` moved to its own file; `deliverect` → `deliverectRefusal`; the paging sentence is now a plural key (six Arabic forms); the parser doc comment now names its header exception; restore undoes one step; the file cap counts rows. Not applied: `LtrCell` copied from stores (the briefing says copy, do not import); `CatalogDialogs.tsx` holding five dialogs (the stores precedent); the `cap` parameter on `parseMaterialList` (a test seam); the menu label in `deliverect-stores:menu.*` (the briefing's ruling).

## Outstanding (not AFK's)
- Live doors on staging (483, BackOffice 2623 and 2627).
- Owner sign-off: no-reason Push, restore-one-step, header skip, rows-based file cap, multi-column refusal, the Platforms/Accounts 403 fallbacks.
- Owner's eye on the Arabic rendering. The RTL drive proves direction and isolation only.
