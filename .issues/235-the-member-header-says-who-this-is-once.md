---
status: open
spec: 231
blocked-by: 233
---

# 235 — The member header says who this is, and says it once

## What to build

Slice 0 leaves a header carrying a name and three keys. This slice makes it the pane an agent
actually reads on a call: the status chips, the points block, and the long tail of member fields
behind one disclosure — plus `codes.ts`, the pure module that decides when a server code becomes
English and when it stays a code.

**The chips are additive and independent, with no precedence rule** (230):

```
M, not blocked   →  Nouf Al-Harbi   [Gold]
M, CM            →  Nouf Al-Harbi   [Gold] [Blocked · Mobile moved to another account]
A, not blocked   →  Nouf Al-Harbi   [Gold] [Archived]
A, IA            →  Nouf Al-Harbi   [Gold] [Archived] [Blocked · Inactive]
```

- **tier** — always;
- **member type** — whenever `memberType !== 'M'` (Archived · Non-loyalty · Family);
- **blocked** — whenever `blockedReasonCode` is set.

🚩 **An ordinary member gets no status chip at all** — silence is the Active state, so a chip always
means "read me". There is no precedence rule to write or get wrong, and an archived-and-blocked
member never has one fact hidden behind the other.

**The points block has exactly one headline number.** `pointsBalance` is the only large figure on the
page, with `pointsBalanceAmount` + currency as its subline; `pendingPoints`, `pointsExpireSoon`
("within 30 days") and `tierPointsBalance` sit beside it at label size. **Expiring is the only tinted
figure, and only when non-zero** — "nothing is expiring" should be quiet.

**One disclosure, shut by default**, over email, birth date, gender code, national ID, nationality
code, city code, preferred language, insurance company. Confirmed against open-by-default and
promote-some-fields-up at the prototype review: a screen opened forty times a day should not be forty
screens of PII nobody asked for.

**Drawn nowhere:** `profile` (a dead constant, always `"W|D"`), `accrualFactor`, `redemptionFactor`,
`exchangeRate`, `pointsExpireSoonDays` (a never-assigned constant `30`), `profileUpdated`. That is
engine machinery, not the member.

**`codes.ts` — the rule is "a code is data unless its value set is closed in server *source*"** (229).
Known value → key; **unknown → `null`, so the component renders the bare code**. Never
`t(key, { defaultValue: code })`: same pixels, but the guard would live at each call site as a
convention to remember instead of in one module a test enforces.

| Code | Translated? |
|---|---|
| `tier` (`S`/`G`/`P`) | ✅ closed by `LoyEndpoints.GetTiers` literals |
| `activityStatus` (`A`/`P`/`N`/`E`) | ✅ closed by `LoyActivityStatusConstants` |
| `blockedReasonCode` (`CM`/`IA`) | ✅ named exception — the set is an open master table, but both codes are **branch conditions in server logic** |
| `gender` | ❌ 🚩 looks closed, is not — the read hands over whatever sign-up wrote, unvalidated |
| `nationality`, `cityCode` | ❌ open, table-backed, no endpoint on the door |

**A passed-through code is labelled as a code** — "City code", "Nationality code", never "City".
WPF labels `CityCode` "City" over a raw `0021`; that label promises a name the screen does not have.

## Spine reach

model · **logic** (`codes`, header derivation — both pure) · **component** · **i18n**
(`tier.*`, `activityStatus.*`, `blockedReason.*` in `loy.json`) · test

## Proof (→ `tdd` red-green cycles)

- [ ] `codes` — `S`/`G`/`P`, `A`/`P`/`N`/`E`, `CM`/`IA` each map to a key; 🚩 an unknown value returns
      `null` so the caller renders the **bare code**, never a raw `loy:tier.X`; gender is never
      mapped · **pure**
- [ ] `member-header` — chip derivation: none for an ordinary member, type chip iff
      `memberType !== 'M'`, blocked chip iff `blockedReasonCode` set, both independently; the
      `0001-01-01` birth date is suppressed **via the existing `isBlankDate`** · **pure**
- [ ] `tools/loy-member-drive.mjs` (extended) — an ordinary member (one chip), a blocked member, an
      archived member, an archived-and-blocked member, the disclosure opening and shutting · **flow**

## Boundaries

No new endpoint — this renders the member payload slice 0 already fetches. New `loy.json` key groups.
🚩 **Reuse, do not rebuild:** `isBlankDate` already exists and is exported for exactly this;
`formatShortDate` renders the birth date.

## Done when

Both pure suites are green, an unknown tier renders as its bare code in the running app, an ordinary
member shows exactly one chip and an archived-and-blocked member shows three, and the disclosure
starts shut.

🚩 Nothing driven against a live SIS.Api.

## Blocked by

[233](233-one-field-resolves-a-member.md) — the header needs a resolved member to render.
