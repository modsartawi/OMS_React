---
status: open
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

- [ ] `schedule_roundTripsLocalDateTime_withNoUtcShift` · pure
- [ ] `featureOff_refusedWhileBlocksUseIt_namingTheRules` · pure
- [ ] drive: edit each page, save, reload shows the values; offline verdict reasons (stubbed) · flow

## Boundaries

Provisional settings, verdict and store-lookup endpoints (BackOffice 2758), stubbed.

## Done when

All five settings pages save and reload in the drive.

## Blocked by

[501](501-a-marketer-sees-the-campaigns-list-by-state-and-opens-a-campaigns-dashboard.md)

## Open questions

- Audiences beyond tier / first purchase / member type / channel, and how one is uploaded, are spec 2737 fog. Default:
  pick existing audiences from the lookup only; uploading one is a later ticket.
