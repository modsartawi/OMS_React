# HITL — 539 (deal → promotion rename)

## Q: Port 5199 was already listening (another process, not started by this session). Kill it or move?
**Decision taken:** Left it alone; ran this session's own vite on 5197 (`DRIVE_PORT=5197`), then killed only the PID that owned 5197.
**Why:** Killing a server this session did not start could break someone else's work; the drive honours DRIVE_PORT.
**Revisit if:** 5199 is meant to be reserved for the AFK runner — then whatever holds it is a leak to clean up.

## Q: Ticket 534 named the prototype folder/branch `deal-campaign-rules-navigation`, which fails 539's `git grep -i -w deal -- .issues/53[3-8]-*.md`.
**Decision taken:** 534 now points at "the navigation prototype the 2848 brief names" (variant 1, key `1`) instead of quoting the path; the brief still holds the exact path.
**Why:** The path is a real BackOffice name that cannot be renamed from here, and the grep check is a Proof box.
**Revisit if:** BackOffice renames the prototype folder/branch — then quote the new path in 534.

## Q: Do 533 and 538 now need BackOffice 2862 deployed and script 018?
**Decision taken:** Yes: 533's and 538's blocked-by and "Before it can run" name BackOffice 2862 and `018_rename_rule_deal_to_promotion.sql` (018 only where an older 015 / 017 ran; a no-op on a fresh database).
**Why:** 539 deploys with 2862 and the screens now speak `promotionCode`; a staging DB on the old 015 would answer the old column names.
**Revisit if:** the owner rules staging gets a fresh 015-017, so 018 is not an owner step.

## Q: Should oms-react's CONTEXT.md gain a "Promotion (rule engine)" entry beside the bonus-buy Promotion?
**Decision taken:** Not in 539; left for 534 (or /domain-modeling). CONTEXT.md is untouched.
**Why:** 539 is a pure rename of code and tickets; the brief forbids touching CONTEXT.md's bonus-buy entries, and a new glossary entry is a modelling act.
**Revisit if:** 534's reviewer finds the screens' "promotion" ambiguous against the bonus-buy entry — add the entry then (2862 wrote BackOffice's).

## Q: The stub's converter refusal and Note text — rename the old words or copy the server's new text?
**Decision taken:** Copied pricing2's wording: "One upload is one SAP promotion number; this file holds 2: …" and the Note "SAP promotion number …" (drive and api.test.ts agree).
**Why:** The stub should mirror the real server (RuleBbyConverter.cs on pricing2); the screen passes the message through as data, so no behaviour changes.
**Revisit if:** never — it is stub data.

## Q: Priority fixtures say "Item deals" / "Deals" (an evaluation group's name). Rename?
**Decision taken:** Left as they are.
**Why:** They are plain English test data for a Priority group, not the rule-engine term; `-w deal` does not match them and 535 must leave priority-drive green.
**Revisit if:** the owner wants the word gone from every fixture too.

## Q: 539's own file name says "deal". Rename it?
**Decision taken:** Kept: `539-deal-is-renamed-promotion-…`. 533-538 cite it as "ticket 539" (no link), so their grep stays clean.
**Why:** The slug describes the rename itself; 539 is outside the 533-538 range the ticket renames.
**Revisit if:** a later check greps all of `.issues/`.
