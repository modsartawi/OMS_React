# HITL log — ticket 436 (Cities & districts, read side)

## Q: Where do SdCityModel and SdDistrictModel live in @/core/models?
**Decision taken:** `SdDistrictModel` already existed in `src/core/models/lookups.ts` (the WPF class, same fields), so it is reused, not redefined; `SdCityModel` (WPF fields, camelCase) is added beside it.
**Why:** the wave says "reuse, do not redefine"; both are the same WPF Sd address models.
**Revisit if:** the BackOffice spec for BO-5 gives the gated doors a different row shape from the WPF classes.

## Q: What is "last change (by and on)" when WPF shows Created and Updated separately?
**Decision taken:** two columns ("Last changed by", "Last changed on"). They show the update when its time is set, otherwise the creation. An unset `.NET 0001-01-01` is blank. If the update time is set but `updatedBy` is blank, "by" stays blank (it is not borrowed from the creator).
**Why:** the ticket asks for one "last change"; a never-updated row's last change is its creation.
**Revisit if:** the owner wants WPF's four raw columns.

## Q: How are codes and coordinates isolated?
**Decision taken:** by the core grid base (`BdiCell`, `<bdi>` with dir auto) on every cell, with no per-column `Ltr`. Codes and coordinates have no Arabic letters, so they resolve LTR. A negative longitude was driven and reads whole under RTL.
**Why:** the bidi rule: "Grid cells are isolated by the core base … `Ltr` is not a cell renderer".
**Revisit if:** a code ever starts with an Arabic letter.

## Q: Which city name goes in the districts title?
**Decision taken:** `code · name`, isolated once as a pair. The name follows the UI language (Arabic name when `i18n.language` is `ar`, otherwise English). Today `lng` is pinned to `en`, so it always shows English, even under RTL.
**Why:** pair-led-by-machine-value rule; it is ready for the Arabic switch-on.
**Revisit if:** the owner wants both names, or only the code.

## Q: The `figure` count helper (`toLocaleString('en-US')`) is now copied in three spec-430 features
**Decision taken:** left as the sibling features have it; not graduated to `@/core` in this slice.
**Why:** graduating it would touch two shipped features outside this ticket.
**Revisit if:** a hardening pass wants it in `@/core/util/number-format`.

## Note: drive port
Port 5199 was already held by a server this session did not start, so it was left alone. The drive ran against its own vite on 5236 (`DRIVE_PORT=5236`), and that server was killed afterwards.
