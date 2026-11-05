---
status: done
spec: 766
blocked-by: 770, BackOffice 3386
---

# 785 — Curators see how Cube and the dbt runs are going

## What to build

A status card on the analytics home (`/analytics`), **for curators only.** It is rendered when
`GET Analytics/Access` says `canCurate`, and the door answers `ANALYTICS-402` to anyone else. It reads
BackOffice 3386's `GET Analytics/Health`, which is the analytics container's `/health` passed on by SIS.Api.

**No new grant:** it uses the curator grant, `AnalyticsCurate`. A viewer already sees freshness on every panel
("data as of", and "behind" after 45 minutes).

- **The headline** is one badge, and its tone follows the state:
  - *Cube is up and the marts are fresh* (ok);
  - *the marts are behind* (warn: Cube is up, the data is older);
  - *Cube is down* (bad);
  - *the marts cannot be read or were never built* (bad);
  - *the container did not answer* (bad);
  - *no address configured* (mute).
- **The details:**
  - Cube state and marts state;
  - the last good run, with its age in minutes and the threshold in force (45 by day, 360 at night);
  - the last run: the job (intraday, nightly, full rebuild or by hand), its outcome (succeeded, failed,
    skipped, tests failed, or refused because the POS replica was behind) and its time;
  - the image version and when it was checked.
- It asks again **every minute** while it is on screen (`HEALTH_REFRESH_MS`).
- Unknown states read as unreachable, never as ok (`health.ts`, `readHealth`).

## Proof

- `src/features/analytics/boards/health.test.ts` (21): reading the door, the tone and headline for each state,
  the last-run split, the run tones, and the local time reading.
- `tools/analytics-drive.mjs` scenario 785 (31/31, en ltr, rtl and dark):
  - a viewer gets no card and no call;
  - a curator sees the fresh card, then the stale 503 body as a warning;
  - unreachable shows no detail rows;
  - a 402 is said in words;
  - no page errors.
  - Screenshots are `tools/.analytics-shots/785-*.png`.

## Owed

The live look once infra gives the container its DNS name and SIS.Api's `Analytics:CubeBaseUrl` points at it
(749). It is part of 784's staging walk.
