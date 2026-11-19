---
status: done
spec: BO 4063 (E:\Projects\BackOffice\.issues\4063-mini-pos-promoters-sell-non-pharmacy-items-spec.md)
blocked-by: BO 4065, BO 4067, BO 4069
---

# 916 — A promoter installs the Mini POS app, signs in, unlocks at the pharmacy, scans a basket and submits it

## What to build

A second Vite entry, the **Mini POS** phone app, built and served as its own path, with a web manifest and a
service worker that caches the app shell and the scanner library.
- **Screens:**
  - sign in (Ua `mobile` channel with password and authenticator);
  - not assigned today;
  - unlock (scan the pharmacy QR);
  - basket (camera scan, typed code, quantity, remove, the server's price and refusal messages);
  - submitted (the order number as a large barcode).
- **The scanner adapter**, from the 3709 prototype: built-in `BarcodeDetector`, else ZXing, plus a wedge input. It
  reports format, value, reader and time-to-read, which are sent on add item. GS1 DataMatrix is parsed into GTIN,
  expiry, batch and serial.
- **The phone decides nothing:** the store, the promoter and the price come from the server.

```ts
// from the 3709 prototype - the adapter contract
type ScanRead = { reader: 'native' | 'zxing' | 'wedge'; format: string; value: string; msToRead: number };
interface BarcodeScanner { start(video: HTMLVideoElement): Promise<void>; stop(): void; onRead(cb: (r: ScanRead) => void): void; torch?(on: boolean): Promise<void>; }
```

## Spine reach

UI (PWA) → BackOffice SIS.Api (4065, 4067, 4069)

## Proof (→ `tdd` red-green cycles)

- [x] Unit: the GS1 parse (raw, `]d2`, bracketed) and adapter fallback (no built-in → ZXing) · vitest
- [x] Component: the refusal message shown, and submitted shows the barcode · vitest
- [ ] Installability check (no manifest errors) and the 3709 phone trial on the chosen model — the manifest half is
  proved by file (`tools/minipos-sw.test.mjs`); Chrome's install prompt and the camera on the chosen phone are owed

## Boundaries

Separate build entry; nothing changes for the existing OMS app.

## Done when

On a phone, a promoter can install, sign in, unlock, scan and submit against a SIS.Api with 4065/4067/4069.

## Blocked by

BO [4065](E:\Projects\BackOffice\.issues\4065-tracer-an-assigned-promoter-prices-and-submits-a-basket-that-becomes-an-mpos-order-at-thei.md), BO [4067](E:\Projects\BackOffice\.issues\4067-selling-unlocks-only-after-scanning-todays-pharmacys-changing-or-printed-qr.md), BO [4069](E:\Projects\BackOffice\.issues\4069-pharmacist-only-and-refused-items-are-refused-at-scan-and-again-at-submit.md)

## Comments

**2026-11-19, implementer (branch `t916`, worktree `E:\Projects\OMS_React-t916`)**, on `spec/4032-mini-pos`. Built
against BackOffice `spec4032` (read only): `MiniPosEndpoints.cs`, `MiniPosRefusals.cs`, `UaAuthEndpoints.cs`, and the
answers of 4065, 4067, 4069, 4070, 4073. SIS.Api was not run: the server is stubbed in the tests and the drive.

- **Second Vite entry.** `minipos/index.html` → `src/app/minipos-main.tsx` → `src/features/mini-pos/phone/` (the
  `mini-pos` area beside 915's screens; served at `/minipos/`). `vite.config.ts` names both inputs. The OMS entry, router and menu are untouched.
- **Manifest + worker.** `public/minipos/` holds `manifest.webmanifest` and three PNG icons (192, 512, 512 maskable).
  `tools/minipos-sw.mjs` is a dependency-free Vite plugin that emits `minipos/sw.js`. It reads the precache list off the
  bundle: the entry, every chunk it reaches statically or by dynamic import (ZXing is one, about 400 kB), their CSS
  and fonts, and the public files. The cache name comes from that list. Navigations are network-first and fall back to
  the cached shell. API calls are never cached. The worker is registered in production only.
- **Sign in.** `UaAuth/Login` `{ userId, password, channel: 'mobile' }`, then `UaAuth/VerifyTotp`. Every call carries
  `x-api-key` (the build's `VITE_MINIPOS_API_KEY`) and `Authorization: Bearer`. The token is kept in `localStorage`
  (`minipos.session`), guarded.
- **The door decides the screen.** After sign-in, and after an unlock, the phone calls `MiniPos/Open`. The answer
  routes it (`refusal.ts` `doorScreenFor`): `MINIPOS_NOT_ASSIGNED_TODAY` → not assigned today; `NOT_PROMOTER`,
  `DISABLED`, `LOGIN_TOO_LONG` → refused; `NOT_UNLOCKED` → unlock; 401 → sign in. Opened → basket. `refusedExisting`
  → continue the open basket, or cancel it and start a new one.
- **Unlock.** Scans a QR (`PHARMACY_CODE_FORMATS`) and sends `MiniPos/Unlock { code }`. Each refusal is shown in
  English and Arabic.
- **Basket.** Camera, typed code, and wedge (the same field, told apart by keying speed: `keyedEntry`). Also qty −/+,
  remove, submit, cancel basket. AddItem sends `{ transactionId, requestId, code, qty: 1, entryMode, msToRead, reader,
  serial }`. A GS1 DataMatrix sends its GTIN (as the EAN-13 when the GTIN-14 starts with `0`) and its AI 21 serial.
  A below-stock pending confirm asks "add anyway" and re-sends the same requestId with the `confirmToken`. Basket verbs
  run one at a time (TanStack mutation `scope`). States go through `applyState`. Every figure is the server's.
- **Submitted.** The document number as Code 128 (`code128.ts`, digits packed in set C), black on white in either
  theme (palette allowlist), with the digits under it.
- **Refusals.** English from `message` / `data.messageEn`, Arabic from `data.messageAr`, each in its own `<bdi>`.
  Session-verb refusals (`NO_CUSTOMER_ATTACHED`, unknown item) carry English only.
- **One core change.** `core/api.ts` `setUnauthorizedHandler`. When one is installed it replaces the OMS
  `/login` redirect on a 401. The phone installs it; OMS installs none. Tested in `api.test.ts`.
- **i18n.** The `mini-pos-phone` namespace, en and ar, registered in `core/i18n.ts`, with a key-parity test. The language
  switch writes `oms.locale` and reloads, as in OMS.
- **Tests.** `gs1.test.ts`, `scanner.test.ts` (fallback, read timing, wedge), `code128.test.ts` (round trip through
  ZXing's Code 128 reader), `refusal.test.ts`, `screens.test.ts` (refusal shown, barcode drawn, locale parity) and
  `tools/minipos-sw.test.mjs` (shell list, cache naming, manifest install criteria, icon pixel sizes). Each proof was
  mutation-checked red. Whole suite green. Typecheck clean. Lint gates grid-base, contrast, palette, controls and
  map-build are OK (boundaries: only the known insurance-rules failures).
- **Drive.** `tools/minipos-drive.mjs` (stubbed, 390×844) passed **14/14**: not assigned, unlock, the bearer and the
  channel key, no store sent, a refusal in both languages, a typed add, and submit to the barcode.
- **Build.** `npm run build` emits `dist/minipos/{index.html, sw.js, manifest.webmanifest, icons}`.

**Seams for 917:** `CustomerSlot.tsx` is the customer step's place. The server refuses `AddItem`, `PriceCheck` and
`Submit` with `NO_CUSTOMER_ATTACHED` until a member is attached (4070). **Until 917 lands, a live walk cannot add a
line**, and the basket shows that refusal. "My orders today", reopen and resubmit join `MiniPosPhonePage`'s `Screen`
union.

**Owed / for the owner:**
1. **Phone trial (3709) on the chosen model:** the camera, the torch, the GS1 DataMatrix read in poor light, and
   Chrome's install prompt. Headless has no camera.
2. **Live walk** against a SIS.Api with 4065/4036/4038 (and 4070 for a line to price).
3. **Deploy:** IIS must serve `/minipos/` (default document `index.html`, not swallowed by the OMS SPA rewrite) and
   `.webmanifest` as `application/manifest+json` (IIS has no default MIME for it). `sw.js` must not be cached long.
   Set `VITE_MINIPOS_API_KEY` at build time to the mobile channel key. A build without it says so at sign-in.
4. **4067's open point stands:** if the phone's channel key passes `ApiKeyEndpointFilter`, it can read
   `MiniPos/TillCode` for any store. The key ships in the phone's JavaScript, as any client key does.
5. **Bundle:** the phone reaches `core/api`, which imports `core/i18n` and so every OMS locale (about 1.7 MB raw in
   one chunk). It is cached once by the worker. Trimming it means a leaner i18n entry for the phone, a later change.
6. A pack whose item master holds only the GTIN-14 (not the EAN-13) would not resolve from a DataMatrix. Check
   `LookupBarcodeAsync` on the trial items. Serialised items are refused today anyway (4073).

