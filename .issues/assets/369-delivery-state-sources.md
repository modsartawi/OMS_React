# 369 — Where a delivery's state and times come from (evidence)

Evidence behind [How a delivery's state maps to timeline steps](../369-how-a-deliverys-state-maps-to-timeline-steps.md).
Read from source on 2026-10-02. The canonical code is `C:\Work\DMSCO\SIS.Oms\SIS.Data\Modules\Sd\`,
and BackOffice `Sartawi.Retail.Data\Modules\Sd\` is a synced copy. Citations use these short names:

- **D** = `Sd/Services/DocumentService/SdDocumentService_Delivery.cs`
- **U** = `…_Update.cs`
- **M** = `Sd/Mapping/SdDocumentStatusDescriptionMapping.cs`

## The update path

Every delivery action goes through `UpdateDeliveryStatusAndLog` (D:3381-3507), in this order:

1. `HandleActionType` writes the status columns.
2. `LastAction` is set, if the action type row has `UpdateLastAction`.
3. `ChangedOn` is set to now.
4. `OverallStatus` is set to `C`, if the action type row has `CompleteDocument`.
5. **One `SdDocumentLog` row is written** (`EntryTime = Now`).
6. **One status-history snapshot is written.**

The per-code flag values live in the DB table `SdDocumentActionType` and are not in the repo.

## The lifecycle columns and the actions that write them

| Column | Code | Meaning | Written by |
|---|---|---|---|
| ReadyStatus | R | Ready | `DRDY`. Also at creation for pick-in-store (D:942-946) |
| | C | Transaction completed | `DTXC` |
| | S | Needs reschedule | `DRBK` (driver returned it), or `DCST`/`DPOL` on a delivery-type document |
| | '' | — | Reset by `DRSC` (reschedule) and `DCHC` (change courier) |
| DeliveryStatus | O | Out for delivery | `DOFD`. Also stamps `OutForDeliveryTime` |
| | D | Delivered | `DDLR`. Also sets `OverallStatus=C` and stamps `ActualDeliveryTime` |
| | B | Returned back | `DRBK`. Express deliveries are then auto-requested to close after 5 minutes |
| | L / S / R | Delayed / deposited / rejected | No live caller. `DRJC` throws |
| CloseStatus | R | Close requested | `DRCL`. **Final: `DCCR` always throws** (`CloseRequestIsFinal.cs`) |
| | C | Closed | `DCLS` (normally the `AutoClose` worker; sets `OverallStatus=C`). Also `DFCL` (does **not** set Overall) |
| | N / X | Closed not invoiced / cancelled after delivery | `DCNI` / `DCAD` |
| ClearStatus | C / D | Driver cash clear / confirmed | `DCLR` / `DCLC`. A gate, not a lifecycle step |
| PaymentStatus | N / P | Need payment / paid | **Order header only.** A delivery is "paid" when `amountDue == 0` (`SdDocumentMapping.cs:553`). No "partially paid" code exists |

- `AvailabilityStatus` is not mapped at all (it is commented out in the entity), so it is always `null`.
- `ConsignmentStatus` is derived in `GetStatusModel` (`SdDocumentMapping.cs:413-443`). The first
  rule that matches wins:
  1. any close → `C`
  2. delivery status O/D/B → `O`/`D`/`B`
  3. any ready status → `R`
  4. created → `T`
  5. rescheduled → `S`

**Pick-in-store (`deliveryType 'P'`)** uses the same state machine and the same ending (`DDLR` →
Delivered). There is no "collected" state, and no out-for-delivery step in practice.

## Times

| Source | What it holds | On which read |
|---|---|---|
| `SdDocumentLog.EntryTime` | Real time of **every** action | Details (Log tab) |
| `DeliveryHeader.OutForDeliveryTime` | Set by `DOFD`. `DCHC` also overwrites it (looks like a bug) | List row only |
| `DeliveryHeader.ActualDeliveryTime` | Set by `DDLR` | List row only |
| `entryTime` | Creation | Both |
| `SdDocumentHeaderAction` | Ready, out-for-delivery, delivered, close-requested, closed, rescheduled, returned-back, clear and transaction-completed times | **Not on any model.** Schema :19732 |
| `statusHistory` | One consignment letter per action, `null`s kept | Details. **No time**: the history row's `EntryTime` is hard-coded to `DateTime.MaxValue` |
| `DeliveryDateTime`, `EstimateDeliveryTime` | Never assigned / caller-supplied (`0001-01-01` in captures) | Unusable |

## Outbox jobs

- **Statuses:** `P`, `G`, `C`, `F`.
- **Retries:** the processor retries with backoff and marks a job **`F` after 5 attempts or once
  `RetryDeadline` passes**.
- **`F` is terminal.** Only `P` rows are picked up again.
- **Jobs are side effects:** courier, Magento/Hybris, SMS and SGH pushes. They are never lifecycle
  steps.
- **Retry:** see [What the delivery reads give us](../360-what-the-delivery-reads-give-us.md).

## Captured corpus

`assets/078-document-payloads/*.json` contains these status histories:

- `["T","T","R","D"]` (pick-in-store, delivered)
- `["T","T","R","R","R","C","C"]`
- `["T","T","S"]`

`paymentStatus`, `clearStatus` and `acceptanceStatus` are empty on all five captures.
