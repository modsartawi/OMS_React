---
status: done
spec: BO 2737 (brief C:\Work\DMSCO\BackOffice\.issues\assets\2737-oms-react-rule-engine-brief.md)
blocked-by: 501
---

# 509 — Campaign settings: details, schedule, audience, features and offline

## What to build

The workspace's **Settings ▸** sub-menu, one page each, with its own Cancel / Save:

- **Details:** name EN + AR (both required), description.
- **Schedule:** from / until (date + time, either clearable), weekdays and hours, all entered and shown in
  **local time**.
- **Audience:** countries, channels, stores (store lookup), members only.
- **Features:** coupons / points can be switched on after creation. Switching one off while blocks use it is refused,
  and the message names the rules that use it.
- **Offline:** the HQ **offline-safe verdict** with its reasons, and "**online only**" to opt a safe campaign out.

## Spine reach

model/api (settings save, offline verdict, store lookup) · logic (schedule local ↔ wire, feature-off
guard) · component (five pages) · i18n · test

## Proof (→ `tdd` red-green cycles)

- [x] `schedule_roundTripsLocalDateTime_withNoUtcShift` · pure (`core/rules/schedule.test.ts`, with `scheduleProblems`)
- [x] `featureOff_refusedWhileBlocksUseIt_namingTheRules` · pure (`workspace/settings-form.test.ts`, with the Details form and `draftAfterReread`)
- [x] drive: edit each page, save, reload shows the values; offline verdict reasons (stubbed) · flow (`tools/campaigns-drive.mjs` §509, checks 72–80; whole drive 374/374)

## Boundaries

Provisional settings, verdict and store-lookup endpoints (BackOffice 2758), stubbed.

## Done when

All five settings pages save and reload in the drive.

## Blocked by

[501](501-a-marketer-sees-the-campaigns-list-by-state-and-opens-a-campaigns-dashboard.md)

## Open questions

- Audiences beyond tier / first purchase / member type / channel, and how one is uploaded, are spec 2737 fog. Default:
  pick existing audiences from the lookup only; uploading one is a later ticket.

## As built (2026-10-16)

- **Doors (PROVISIONAL, `core/rules/api.ts`):** `PUT RuleCampaign/Campaigns/{id}/Settings/{Details|Schedule|Audience|Features|Offline}`, each taking its page's part and answering the whole campaign; `GET …/OfflineVerdict` → `{ safe, reasons[{code, message}] }` (`safe` ignores the opt-out); store lookup = `RuleCampaign/Lookups/Stores`, plus `Countries` and `Channels` for the audience's short lists (HITL). New wire types `RuleCampaignDetails`, `RuleCampaignOffline`, `RuleOfflineVerdict` in `core/models/rule-campaign.ts`. A save is remembered as a saved draft is: the list, the checks and the verdict are read afresh.
- **Logic:** `core/rules/schedule.ts` — local ↔ wire with no `Date` built (a day as written, `HH:mm`), an end not after the start and hours ending before they start refused. `workspace/settings-form.ts` — `featuresInUse` (blocks, groups included, read through the catalogue's `feature`), the Details form, `draftAfterReread`.
- **Screens:** `Settings ▸` in the workspace menu (opens Details; Budgets not drawn until 510); `settings/*` route (a splat, so the crumb's record stays the campaign id; an unknown or unlanded page opens Details); five pages on shared `settings-ui.tsx` (own Cancel / Save, refusal message + code, leave guard). The leave guard was lifted into `LeaveGuard.tsx` and the rule builder now uses it too. The dashboard's named / schedule steps now link to their pages.
- **Review:** `/code-review` found an unsaved draft dropped by a background re-read (fixed + drive check 79), a wire day with a `Z` erased on save (now read as written), a menu left open when navigation was held (fixed); `/standards-review` found no hard violation (two duplications removed).
- **Outstanding (not AFK):** live doors (520); owner sign-off on the open-question default and on the HITL-509 rulings (day-only start/end, no overnight hours, countries/channels as lookups); a human read of the Arabic name input under RTL.

