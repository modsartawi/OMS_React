---
status: open
spec: BO 4032 (E:\Projects\BackOffice\.issues\4032-mini-pos-promoters-sell-non-pharmacy-items-spec.md)
blocked-by: BO 4034, BO 4036, BO 4038
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

UI (PWA) → BackOffice SIS.Api (4034, 4036, 4038)

## Proof (→ `tdd` red-green cycles)

- [ ] Unit: the GS1 parse (raw, `]d2`, bracketed) and adapter fallback (no built-in → ZXing) · vitest
- [ ] Component: the refusal message shown, and submitted shows the barcode · vitest
- [ ] Installability check (no manifest errors) and the 3709 phone trial on the chosen model

## Boundaries

Separate build entry; nothing changes for the existing OMS app.

## Done when

On a phone, a promoter can install, sign in, unlock, scan and submit against a SIS.Api with 4034/4036/4038.

## Blocked by

BO [4034](E:\Projects\BackOffice\.issues\4034-tracer-an-assigned-promoter-prices-and-submits-a-basket-that-becomes-an-mpos-order-at-thei.md), BO [4036](E:\Projects\BackOffice\.issues\4036-selling-unlocks-only-after-scanning-todays-pharmacys-changing-or-printed-qr.md), BO [4038](E:\Projects\BackOffice\.issues\4038-pharmacist-only-and-refused-items-are-refused-at-scan-and-again-at-submit.md)
