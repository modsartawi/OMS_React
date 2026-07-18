# Rule: no user-visible string literals — always `t()`

Every string a user can read comes from a translation key, never a literal in JSX or TS.
The app is en-only today but wired through `react-i18next` (`src/core/i18n.ts`) so RTL/Arabic
retrofit (a known map item) is a data change, not a code sweep.

## What this means

- **JSX text, `aria-label`, `title`, `placeholder`, toast/dialog copy, error messages** → `t('ns:key')`.
- Keys live in `src/locales/en/<namespace>.json`, one namespace per feature area
  (`common`, `auth`, `deliveries`, `document`, `authz-admin`, `ua-admin`). Add the key to the JSON
  in the same change that uses it — a `t()` call with no backing key renders the raw key to users.
- Interpolate with named params, never string concatenation:
  `t('storeSwitcher.changed.detail', { storeCode })` → `"Now acting as store {{storeCode}}."`.
- Server-supplied text (envelope `message`, a document field) is passed through as data — it is not
  a literal and needs no key. But any label *around* it does.

## Allowed literals (not user-visible)

Route paths, API endpoint strings, CSS class names, `data-*` keys, log/console text, test names,
machine codes matched against the envelope (`LAST_ADMIN`, `SYSTEM_ROLE`). These are not localized.

## The tell

If you typed a human sentence inside `<...>` or a `"..."` that ends up on screen, it's a violation.
Reach for `t()` and add the key.
