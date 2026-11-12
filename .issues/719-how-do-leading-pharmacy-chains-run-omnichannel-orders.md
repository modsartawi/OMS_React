---
type: wayfinder-ticket
wayfinder: research
map: 717
status: done
blocked-by: —
---

# 719 — How do leading pharmacy chains run omnichannel orders?

## Question

What do leading pharmacy and health-retail chains offer customers and run in operations across
channels? Which of these capabilities are **pharmacy-specific**, meaning a generic enterprise OMS
does not cover them?

Chains to look at:
- **Global:** Walgreens, CVS, Boots, Amazon Pharmacy.
- **Regional:** Nahdi, Al-Dawaa, Aster.
- **Pharmacy platform vendors where public:** for example the pharmacy modules of Salesforce Health
  Cloud, or McKesson / Omnicell retail offerings.

Topics to cover: e-prescription intake (Wasfaty-style), insurance eligibility and pre-authorisation
at the counter, pharmacist consult or prescription sessions, controlled-drug and serial / batch
tracking (GS1, SFDA-style), refill reminders, click and collect for Rx, same-day and express
delivery of medicines, inter-store transfers for out-of-stock items, and loyalty tied to health
purchases.

The answer should include the list of pharmacy-specific capabilities, worded as extra rows for
the matrix, with a source for each. It should also flag which ones are regulatory must-haves in
KSA / GCC and which are customer delighters.

Write it with `/research` to `docs/research/717-pharmacy-omnichannel.md`.

## Answer

Research note: [docs/research/717-pharmacy-omnichannel.md](../docs/research/717-pharmacy-omnichannel.md) — 31 pharmacy-specific rows (RX-01…31) against Walgreens, CVS, Boots, Amazon Pharmacy, Nahdi, Al-Dawaa and Aster, with 67 sources.

- **Regulatory must-haves in KSA:**
  - Wasfaty intake.
  - NPHIES eligibility, pre-authorisation and claims.
  - SFDA RSD serial and batch track and trace. Enforcement is live: SFDA fined 10 pharmacies over SAR 1.7 m in January 2026.
  - Controlled-drug e-prescriptions.
  - Shortage notice to SFDA.
  - E-pharmacy licence conditions.
  - Pharmacist verification before a prescription is released.
- **Customer delighters:**
  1. Auto-refill and refill synchronisation.
  2. Prescriptions delivered through food-delivery apps. Aster does this on Talabat, which is the closest match to our HungerStation channel.
  3. Adherence packs and prescription subscriptions.
  4. The pharmacy joined to the chain's own clinics.
  5. Online doctor consultations that turn into prescriptions.
- **The benchmark is Nahdi.** Its digital share of sales was 25.8 % in FY2025 (over SAR 2.5 bn) and 31 % in Q1 2026. It has 1,218 pharmacies, 30-minute delivery and Wasfaty in every store since October 2025.
- **Other chains:** Al-Dawaa delivers within 60 minutes. Aster delivers within 90 minutes and is entering KSA.
- **Thin evidence:**
  - Al-Dawaa's and Aster's digital share.
  - The exact date of the NPHIES pharmacy mandate.
  - The SFDA rule text on scanning each pack before handover. It comes from a vendor source only.
  - Whether Nahdi or Al-Dawaa run NPHIES or aggregator integrations.
