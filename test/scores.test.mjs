import { describe, expect, it } from "vitest";
import {
  adjustPointBuy, breakdown, isComplete, modifier, parseArray, pointBuySpent, remainingValues, rollFormula,
  STANDARD_ARRAY
} from "../scripts/abilities/scores.mjs";

const ids = ["str", "dex", "con", "int", "wis", "cha"];

describe("modifier", () => {
  it("rounds down", () => {
    expect([8, 9, 10, 11, 15, 17, 20].map(modifier)).toEqual([-1, -1, 0, 0, 2, 3, 5]);
  });
});

describe("parseArray", () => {
  it("reads six numbers, highest first", () => {
    expect(parseArray("17, 15, 13, 12, 10, 8")).toEqual([17, 15, 13, 12, 10, 8]);
    expect(parseArray("8 10 12 13 15 17")).toEqual([17, 15, 13, 12, 10, 8]);
  });

  it("rejects anything else", () => {
    for ( const bad of ["", "15, 14, 13", "15, 14, 13, 12, 10, 8, 8", "a, b, c, d, e, f", "15, 14, 13, 12, 10, 0", "21, 14, 13, 12, 10, 8", "15.5, 14, 13, 12, 10, 8"] ) {
      expect(parseArray(bad)).toBeNull();
    }
  });
});

describe("rollFormula", () => {
  it("drops the lowest die, rerolling 1s only when asked", () => {
    expect(rollFormula()).toBe("4d6dl1");
    expect(rollFormula(true)).toBe("4d6rr1dl1");
  });
});

describe("array methods", () => {
  it("offers each value once, plus the ability's own", () => {
    const scores = { str: 15, dex: 14 };
    expect(remainingValues(STANDARD_ARRAY, scores, ids)).toEqual([13, 12, 10, 8]);
    expect(remainingValues(STANDARD_ARRAY, scores, ids, "str")).toEqual([15, 13, 12, 10, 8]);
  });

  it("lets a repeated value be used that many times", () => {
    expect(remainingValues([15, 15, 10], { str: 15 }, ids)).toEqual([15, 10]);
  });

  it("is complete only when every value is placed", () => {
    const full = { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 };
    expect(isComplete("standard", full, ids, STANDARD_ARRAY)).toBe(true);
    expect(isComplete("standard", { ...full, cha: undefined }, ids, STANDARD_ARRAY)).toBe(false);
    expect(isComplete("standard", { ...full, cha: 15 }, ids, STANDARD_ARRAY)).toBe(false);
    expect(isComplete("roll", full, ids, [])).toBe(false);
  });
});

describe("point buy", () => {
  it("costs 0 to 9 points per score", () => {
    expect(pointBuySpent({}, ids)).toBe(0);
    expect(pointBuySpent({ str: 15, dex: 15, con: 15, int: 8, wis: 8, cha: 8 }, ids)).toBe(27);
    expect(pointBuySpent({ str: 13, dex: 13, con: 13, int: 12, wis: 12, cha: 12 }, ids)).toBe(27);
  });

  it("stops at 8, 15 and the budget", () => {
    let scores = {};
    expect(adjustPointBuy(scores, "str", -1, ids)).toBe(scores);
    for ( let i = 0; i < 7; i++ ) scores = adjustPointBuy(scores, "str", 1, ids);
    expect(scores.str).toBe(15);
    expect(adjustPointBuy(scores, "str", 1, ids)).toBe(scores);
    for ( let i = 0; i < 7; i++ ) scores = adjustPointBuy(scores, "dex", 1, ids);
    for ( let i = 0; i < 7; i++ ) scores = adjustPointBuy(scores, "con", 1, ids);
    expect(pointBuySpent(scores, ids)).toBe(27);
    // The budget is spent, so nothing else can go up.
    expect(adjustPointBuy(scores, "int", 1, ids)).toBe(scores);
    // Lowering one frees points for another.
    scores = adjustPointBuy(scores, "str", -1, ids);
    expect(adjustPointBuy(scores, "int", 1, ids).int).toBe(9);
  });

  it("is complete while within budget", () => {
    expect(isComplete("pointbuy", { str: 8, dex: 8, con: 8, int: 8, wis: 8, cha: 8 }, ids)).toBe(true);
    expect(isComplete("pointbuy", { str: 15, dex: 15, con: 15, int: 15, wis: 8, cha: 8 }, ids)).toBe(false);
  });
});

describe("manual", () => {
  it("needs a whole number from 1 to 20 for every ability", () => {
    const scores = { str: 18, dex: 14, con: 12, int: 10, wis: 9, cha: 7 };
    expect(isComplete("manual", scores, ids)).toBe(true);
    expect(isComplete("manual", { ...scores, str: 21 }, ids)).toBe(false);
    expect(isComplete("manual", { ...scores, str: undefined }, ids)).toBe(false);
  });
});

describe("breakdown", () => {
  it("shows base, bonus, final and modifier", () => {
    const rows = breakdown({ str: 15, dex: 14 }, { str: 15, dex: 16 }, ["str", "dex"]);
    expect(rows).toEqual([
      { id: "str", base: 15, final: 15, bonus: 0, mod: 2 },
      { id: "dex", base: 14, final: 16, bonus: 2, mod: 3 }
    ]);
  });

  it("copes with an unset base", () => {
    expect(breakdown({}, {}, ["str"])).toEqual([{ id: "str", base: undefined, final: undefined, bonus: 0, mod: undefined }]);
  });
});
