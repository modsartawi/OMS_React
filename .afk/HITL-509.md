# HITL — ticket 509 (campaign settings: details, schedule, audience, features, offline)

Brief re-read at the start of 509: still **no contract section** in
`2737-oms-react-rule-engine-brief.md`, so every door and shape below is provisional
(`src/core/models/rule-campaign.ts`, `src/core/rules/api.ts`) and re-pointed by 520.

## Q: Do Start and End carry a time of day, or are their times the daily hours?
**Decision taken:** Start and End are local **days** (the 501 model's `from` / `until`, end exclusive). The page's only times are the **daily hours** (`hoursFrom` / `hoursTo`), shown on their own row with their own Clear button. Each of Start, End and the hours can be cleared on its own.
**Why:** The prototype pairs each date with a time input, but those inputs are bound to `hoursFrom` / `hoursTo`, and its own copy says "the two times are daily hours". 501 settled the model as days plus daily hours. Putting the hours on their own row says the same thing without the confusing pairing.
**Revisit if:** 2758 gives the window a start and end **moment** (for example "starts at 14:00 on its first day"). Then `from` / `until` become `yyyy-MM-ddTHH:mm` and Start and End get a time input each. Until then, a moment on the wire is read as its written day, and a Save writes back that day only.

## Q: Should daily hours that cross midnight (22:00–02:00) be allowed?
**Decision taken:** They are refused at the page: "The daily hours must end after they start." A single end alone is allowed; the other end is the edge of the day.
**Why:** The dashboard reads the hours as one range, and the prototype's engine compares the hours inside a single day. A window across midnight has no agreed meaning yet.
**Revisit if:** HQ (2758) defines overnight hours. Then drop `hoursToNotAfterFrom` in `src/core/rules/schedule.ts`.

## Q: Where do the Audience page's countries and channels come from?
**Decision taken:** From the lookup door, like the stores: `RuleCampaign/Lookups/Countries` and `RuleCampaign/Lookups/Channels`, provisional and stubbed with the prototype's lists. Each is shown as a row of toggles, read with an empty search. Stores use a search (the store lookup the ticket names).
**Why:** HQ owns these lists, and their names reach the screen as data, so no country or channel name is hard-coded or translated in the client. These are two more doors than the ticket names, but 520 re-points them in the same file.
**Revisit if:** 2758 serves countries and channels another way (for example inside the catalogue), or a list grows past HQ's lookup cap. A capped list belongs on a search.

## Q: What can "Customers" be set to?
**Decision taken:** Three options, from the prototype: everyone; members only; earning Arbahi members only. They map to the model's `members: 'any' | 'identified' | 'earning'` (501).
**Why:** The ticket says "members only". The prototype's third option is already in the model and in the fixtures.
**Revisit if:** The owner wants only two choices.

## Q: Does switching a feature off check formulas as well as blocks?
**Decision taken:** The page names only the rules whose **blocks** need the feature, using the catalogue's `feature` on each block type (the same gate as the palette). A named value's formula that reads points is not detected by the client, which never parses a formula (ADR 0089). In that case HQ's refusal is shown as it comes, with its message and code.
**Why:** The ADR forbids parsing on the client.
**Revisit if:** HQ's refusal for this case should name the rules in a structured way (for example a list of rule ids) so the page can link them.

## Q: Where does "online only" sit, and when is it offered?
**Decision taken:** It is a checkbox on the Offline page, offered only when HQ's verdict is offline-safe. Its words are "Online only — keep it off offline tills anyway". A campaign HQ finds unsafe reads "Online only" with HQ's reasons, as HQ sent them (data, `<bdi>`), and has no checkbox. The verdict is read from `GET …/OfflineVerdict`, provisional. Its `safe` ignores the opt-out, and it is re-read after any rules or settings save.
**Why:** The prototype's `OfflineSet` does this, and the brief says the verdict is HQ's.
**Revisit if:** 2758 folds the verdict into the campaign read, or the verdict should be shown on the dashboard too (the prototype has a line for it there; this slice did not add it).

## Q: Are leaving with unsaved changes, and a background re-read, guarded?
**Decision taken:** Yes. Each settings page asks before leaving with unsaved changes, using the rule builder's guard (now the shared `LeaveGuard.tsx`). A re-read of the campaign in the background never drops what the marketer typed. A page takes HQ's new value only when its draft was clean, or when the value is the answer to its own Save.
**Why:** It is the same promise the builder makes. `/code-review` found that the first cut threw away unsaved edits when the campaign was re-read.
**Revisit if:** The owner prefers that settings pages leave without asking.

## Note: CONTEXT.md
The standards review noted that CONTEXT.md has no entries for the rule-engine terms (campaign, offline-safe, online only, audience). Its "Avoid: campaign" line is about the SAP promotion. A `/domain-modeling` pass for the rule-engine vocabulary is worth doing; it is not in this slice.
