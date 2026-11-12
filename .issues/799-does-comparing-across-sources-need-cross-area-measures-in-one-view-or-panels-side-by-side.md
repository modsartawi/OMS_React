---
type: wayfinder-ticket
wayfinder: grilling
map: 793
status: done
blocked-by: 796
---

# 799 — Does comparing across sources need cross-area measures in one view, or panels side by side?

## Question

The motivating report compares figures from several sources (for example sales against
deliveries per store). There are two ways to do that inside the semantic model:
- **Panels side by side** on one board, each from its own area, sharing the board's parameters.
  v1 already does this.
- **Cross-area measures in one view:** a Cube view that joins marts on their shared dimensions
  (store, day, channel), so one table or combo chart holds both. Ratios across areas (for example
  deliveries per 1,000 till transactions) become possible.

Settle which v2 needs, using the chosen areas. If cross-area views are in, say which dimensions
may join, how the grain is aligned (daily marts and `fct_delivery`), and how rates stay
Σ numerator ÷ Σ denominator. User-made joins stay out of scope.

## Answer

Done 2026-11-06 (grilling). The owner chose both recommendations: **named series** inside one area,
and **one curated cross-area view** that BackOffice declares. The points after those two are the
agent's, and the owner may overrule any of them.

**What the shipped model allows today** (BackOffice `Analytics/cube/model`, read 2026-11-06):
- Every view wraps **one fact cube plus `stores`**. No view joins two facts.
- The shared keys line up: `date`, `store` (plus `city` and `region` through `stores`) and
  `channel`. Till's six channel keys are the orders and delivery five plus `offline`, with the same
  keys and labels.
- `delivery_type` (796) reaches only orders and delivery. The till mart already carries `order_no`
  (`mart_till_sales_daily.sql:22`), so a till sale can reach its order and that order's delivery
  type.

### 1. Panels side by side stay the default way to compare areas

A report compares areas with panels, each from its own area, all bound to the same parameters
(797). This is v1's model with parameters added, and it covers loyalty, claims and every figure
the cross-area view leaves out. 797's rule that a `members` parameter may point at a different
dimension on each panel is what lets one strip drive several areas.

### 2. Named series: several filtered series in one chart (owner)

A view in **one area** may declare **up to 4 named series**. Each series is:
- a label, which the author writes in English and Arabic, as data;
- filters on that view's own category dimensions.

Every series shares the view's measures, chart type and axis. The acceptance case's "HungerStation
against QC" becomes two series: `channel = hungerstation` and `delivery_type = QC`.

- **How it runs.** SIS.Api runs one Cube `/load` per series with that series' filters added, and
  merges the results on the shared axis. Because each series is its own query, rates stay
  Σ numerator ÷ Σ denominator, percentiles stay right, and series may overlap without being
  counted twice.
- **What the chart shows:**
  - The series takes the colour role, in place of a colour breakdown. The panel may keep one more
    dimension, time or one category, as its axis.
  - **There is no total across series**, because series may overlap.
  - Colour slots go to the series in order.
- **Chart types:** line, area, bar, combo, table and KPI. A KPI tile shows one figure per series
  side by side. Donut and heatmap do not take series.
- **Parameters:** every bound parameter applies to every series in the panel. A `members`
  parameter **cannot bind** to a dimension that a series already filters on in that panel. The
  editor does not pre-fill that binding, the panel says the parameter does not reach it (797 item
  4), and a saved binding like that is refused with `ANALYTICS-411`.
- **Cross-filter:** clicking a mark on the axis cross-filters other panels by that member, as in
  v1. Clicking a series (its legend entry or its colour) only highlights it. A series is not a
  member, so it does not cross-filter.
- **Caps:** each series query carries the 30 s and 10,000-row caps. A panel with series counts as
  one panel, but it costs N queries. Whether that fits 750's load figures joins the map's Load fog.
- **Export:** a `series` column holding the series label.
- **Refusals:** more than 4 series, a duplicate label, or a filter on a dimension that is not in
  the view is `ANALYTICS-411` at save.
- **The AI:** `create_view` may write series. How a whole report's words become series is 802's.

### 3. One curated cross-area view: `store_day` (owner)

One new Cube view, **Stores by day** (`store_day`), lets one table or chart hold figures from
several areas, for example per store: till sales, orders, the cancellation rate and deliveries.
It is declared by a BackOffice pull request, like every other area. Users never make joins.

- **Built in dbt, not by Cube joins.** A mart `mart_store_day` combines the existing area marts
  with `UNION ALL` and then `GROUP BY`, which works as a full outer join. A store with sales and
  no orders therefore keeps its row, and its order counts are 0, not null. Cube sees one plain fact
  cube, so v1's one-view rule holds and Cube's fan-out handling across two facts is never used.
- **Grain:** day × store × channel × delivery type.
  - `channel` uses till's six keys. Orders and deliveries are always 0 under `offline`.
  - `delivery_type` needs a new till dimension. **Till gains `delivery_type`** through
    `order_no` → order → delivery, with 796's rules. A sale with no order is `(none)`. The same
    dimension goes into the `till` view, so "sales of QC" can be asked anywhere.
- **The date:** each figure keeps its own area's date: the sale date for till, the order date
  (`EntryTime`) for orders, and the creation date for deliveries. The view's description, and each
  measure's, says which. The marts already re-read the last 10 days for late cancellations (796),
  and `mart_store_day` rebuilds the same window.
- **What it holds:** only **additive** figures, so every one sums correctly across any slice:
  - **till:** `till_sales`, `till_returns`, `gross_till_value_sar`, `net_till_value_sar`;
  - **orders:** `orders`, `cancelled_orders`, `expired_orders`;
  - **delivery:** `deliveries`, `deliveries_delivered`.

  Each figure carries the same name, label and definition as in its own area. A dbt parity test
  checks that the daily total of each figure equals the total of its own area's mart.
- **Ratios are declared by BackOffice** over those sums, never averaged. They start with these
  four, and BackOffice may add more in later pull requests:
  - `cancellation_rate` = Σ cancelled ÷ Σ orders;
  - `delivered_share` = Σ delivered ÷ Σ deliveries;
  - `deliveries_per_1000_till_sales` = 1000 × Σ deliveries ÷ Σ till sales;
  - `net_value_per_order` = Σ net till value of order-linked sales ÷ Σ orders. This needs one more
    private additive numerator, `order_linked_net_value_sar`.
- **Left out:**
  - delivery percentiles and distinct customers, because they cannot be added up;
  - loyalty and claims, which have no channel and their own grain;
  - shares whose numerators are private.

  These stay as panels in their own areas. Coupons and promotions (796 rank 1) have day, store and
  channel, so they **may join `store_day` in a later BackOffice pull request**. The v2 spec does
  not require it.
- **Availability** works as for any area. If one source mart is stale, `store_day` shows the
  oldest freshness among its sources.

### 4. The acceptance case, checked

"Sales for each channel yesterday, HungerStation against QC, and their cancellation rates", with
the period as a parameter that defaults to yesterday:
- **Panel 1, till:** a bar of `net_till_value_sar` by `channel`.
- **Panel 2, till:** `net_till_value_sar` in two named series, HungerStation and QC. This needs the
  new till `delivery_type`.
- **Panel 3, orders:** `cancellation_rate` in the same two named series, with HungerStation's
  "inside OMS only" caveat (796).
- **Optional panel 4, `store_day`:** a table per store of value, orders, the cancellation rate and
  deliveries.
- **`period` binds to all four.** The ready-made `channel` parameter cannot bind to panels 2 and 3,
  which already filter on channel in their series, and the panels say so.

### New terms

`CONTEXT.md` gains **Named series** and **Cross-area view**.
