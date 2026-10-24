/**
 * Ticket 550 — a Deliverect push's lines (BackOffice 3026; contract § Stock sync lines): how one
 * line reads (a base row against a platform row, a line with no price, out of stock), whether a
 * push's lines were delivered or only attempted, the 15-day wording's state, and the Lines door's
 * query from the drawer's filter.
 */
import { describe, expect, it } from "vitest";
import type { DeliverectSyncLine } from "@/core/models/deliverect";
import {
  LINES_KEPT_DAYS,
  SYNC_LINES_TAKE,
  figure,
  linesNotice,
  linesQuery,
  platformChoices,
  platformParam,
  pushOutcome,
  readLine,
} from "./sync-lines";

const line = (over: Partial<DeliverectSyncLine> = {}): DeliverectSyncLine => ({
  plu: "601624",
  channel: null,
  price: 18.95,
  stock: 7,
  stockStatus: "IN_STOCK",
  ...over,
});

describe("the contract constants", () => {
  it("line detail is kept 15 days, and the drawer reads the door default page of 200", () => {
    expect([LINES_KEPT_DAYS, SYNC_LINES_TAKE]).toEqual([15, 200]);
  });
});

describe("readLine — one line as the drawer shows it", () => {
  it("a base row (channel null) is the location row: its price at 3 decimals, its stock grouped, in stock", () => {
    expect(readLine(line({ stock: 1204 }))).toEqual({
      platform: null,
      price: "18.950",
      stock: "1,204",
      stockStatus: "inStock",
      outOfStock: false,
    });
  });

  it("a platform row carries the platform's name and no stock figure", () => {
    const r = readLine(
      line({
        channel: "Jahez",
        price: null,
        stock: null,
        stockStatus: "OUT_OF_STOCK",
      }),
    );
    expect(r).toEqual({
      platform: "Jahez",
      price: null,
      stock: null,
      stockStatus: "outOfStock",
      outOfStock: true,
    });
  });

  it("a line with no price sent reads null — the items file price stands, it is NOT zero", () => {
    expect(readLine(line({ price: null })).price).toBeNull();
    expect(readLine(line({ price: 0 })).price).toBe("0.000");
  });

  it("a base row out of stock with a stock of 0 still shows the 0", () => {
    const r = readLine(line({ stock: 0, stockStatus: "OUT_OF_STOCK" }));
    expect([r.stock, r.outOfStock]).toEqual(["0", true]);
  });

  it("a stock status the contract does not name has no label and is not marked out of stock", () => {
    const r = readLine(line({ stockStatus: "DISCONTINUED" }));
    expect([r.stockStatus, r.outOfStock]).toEqual([null, false]);
  });
});

describe("pushOutcome — a refused push lines are attempted, never delivered", () => {
  it('"S" with a processed (or not yet arrived) callback is sent', () => {
    expect(pushOutcome("S", "processed")).toBe("sent");
    expect(pushOutcome("S", null)).toBe("sent");
  });

  it('"E" is attempted, whatever the callback', () => {
    expect(pushOutcome("E", null)).toBe("attempted");
    expect(pushOutcome("E", "processed")).toBe("attempted");
  });

  it("a push Deliverect took but whose processing callback reported an error is attempted too", () => {
    expect(pushOutcome("S", "error")).toBe("attempted");
  });

  it("the callback is read case-blind, and every failure word counts — error, failed, failure, rejected", () => {
    for (const word of [
      "Error",
      "ERROR",
      " error ",
      "failed",
      "Failed",
      "failure",
      "rejected",
      "REJECTED",
    ])
      expect([word, pushOutcome("S", word)]).toEqual([word, "attempted"]);
    expect(pushOutcome("S", "Processed")).toBe("sent");
  });

  it("a push still running is neither sent nor attempted — whatever its status says so far", () => {
    expect(pushOutcome("S", null, true)).toBe("running");
    expect(pushOutcome("E", null, true)).toBe("running");
    expect(pushOutcome("S", "processed", false)).toBe("sent");
  });
});

describe("linesNotice — the words that stand in for an empty table", () => {
  it('an expired push (linesKept false) says the 15 days — never "nothing was sent"', () => {
    expect(linesNotice({ linesKept: false, total: 0, filtered: false })).toBe(
      "expired",
    );
    expect(linesNotice({ linesKept: false, total: 0, filtered: true })).toBe(
      "expired",
    );
  });

  it("a kept push with no line at all sent nothing; with a filter on, nothing matches", () => {
    expect(linesNotice({ linesKept: true, total: 0, filtered: false })).toBe(
      "noneSent",
    );
    expect(linesNotice({ linesKept: true, total: 0, filtered: true })).toBe(
      "noMatch",
    );
  });

  it('a running push with no line yet is in progress, never "sent no lines"', () => {
    expect(
      linesNotice({
        linesKept: true,
        total: 0,
        filtered: false,
        running: true,
      }),
    ).toBe("running");
    expect(
      linesNotice({ linesKept: true, total: 0, filtered: true, running: true }),
    ).toBe("noMatch");
  });

  it("a push with lines needs no notice", () => {
    expect(
      linesNotice({ linesKept: true, total: 2, filtered: false }),
    ).toBeNull();
  });
});

describe("linesQuery — the drawer's filter as the Lines door's params", () => {
  it("page 1 with no filter: skip 0, take 200, no plu, no channel", () => {
    expect(linesQuery({ plu: "", platform: "", page: 1 })).toEqual({
      plu: null,
      channel: null,
      skip: 0,
      take: 200,
    });
  });

  it("the PLU is trimmed and matched exactly; base rows only send channel=base; a platform sends its name", () => {
    expect(linesQuery({ plu: " 601624 ", platform: "base", page: 1 })).toEqual({
      plu: "601624",
      channel: "base",
      skip: 0,
      take: 200,
    });
    expect(linesQuery({ plu: "", platform: "Jahez", page: 3 })).toEqual({
      plu: null,
      channel: "Jahez",
      skip: 400,
      take: 200,
    });
  });
});

describe("platformParam — the platform field as the door channel", () => {
  it("all rows sends none; base rows only sends base", () => {
    expect(platformParam("all", "Jahez")).toBe("");
    expect(platformParam("base", "Jahez")).toBe("base");
  });

  it("a typed platform name is sent trimmed, whichever page first carried it; blank means all rows", () => {
    expect(platformParam("platform", "  HungerStation ")).toBe("HungerStation");
    expect(platformParam("platform", "   ")).toBe("");
  });
});

describe("figure — a count grouped as the app draws figures", () => {
  it("groups thousands", () => {
    expect(figure(18240)).toBe("18,240");
  });
});

describe("platformChoices — the platform filter offers the names the lines carried", () => {
  it("the names seen so far plus the new page, each once, sorted; base rows add none", () => {
    expect(
      platformChoices(
        ["Keeta"],
        [line(), line({ channel: "Jahez" }), line({ channel: "Keeta" })],
      ),
    ).toEqual(["Jahez", "Keeta"]);
  });

  it("the current selection is kept even when the filtered page no longer carries it", () => {
    expect(platformChoices([], [], "HungerStation")).toEqual(["HungerStation"]);
    expect(platformChoices([], [], "base")).toEqual([]);
  });
});
