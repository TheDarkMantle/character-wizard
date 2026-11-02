import { describe, expect, it } from "vitest";
import {
  adjustPoints, createBlocker, featsMatching, groupTraitSlots, picksRemaining, pruneSelections, tally, toggleSelection
} from "../scripts/advancement/slots.mjs";

const slot = (key, count, values, extra = {}) => ({ key, count, options: values.map(value => ({ value, label: value })), ...extra });

describe("groupTraitSlots", () => {
  it("separates grants from choices and merges identical pools", () => {
    const skills = ["skills:acr", "skills:ath", "skills:prc"];
    const { grants, groups } = groupTraitSlots([["saves:str"], ["saves:str"], skills, [...skills].reverse(), ["tool:smith", "tool:brewer"]]);
    expect(grants).toEqual(["saves:str"]);
    expect(groups).toEqual([
      { options: skills, count: 2 },
      { options: ["tool:brewer", "tool:smith"], count: 1 }
    ]);
  });

  it("ignores empty slots", () => {
    expect(groupTraitSlots([[]])).toEqual({ grants: [], groups: [] });
  });
});

describe("featsMatching", () => {
  const feats = [
    { name: "Archery", featType: "feat", featSubtype: "fightingStyle" },
    { name: "Alert", featType: "feat", featSubtype: "origin" },
    { name: "Action Surge", featType: "class", featSubtype: "" }
  ];
  it("filters by type and subtype", () => {
    expect(featsMatching(feats, { type: "feat", subtype: "fightingStyle" }).map(f => f.name)).toEqual(["Archery"]);
    expect(featsMatching(feats, { type: "feat" }).map(f => f.name)).toEqual(["Archery", "Alert"]);
    expect(featsMatching(feats, {})).toHaveLength(3);
  });
});

describe("selections", () => {
  const slots = [slot("a", 1, ["x", "y"]), slot("b", 2, ["p", "q", "r"])];

  it("prunes stale and excess selections", () => {
    expect(pruneSelections(slots, { a: ["z"], b: ["p", "q", "r"], gone: ["x"] })).toEqual({ b: ["p", "q"] });
  });

  it("counts picks remaining", () => {
    expect(picksRemaining(slots, {})).toBe(3);
    expect(picksRemaining(slots, { a: ["x"], b: ["p"] })).toBe(1);
  });

  it("swaps in single-pick slots and caps multi-pick slots", () => {
    expect(toggleSelection(slots[0], { a: ["x"] }, "y")).toEqual(["y"]);
    expect(toggleSelection(slots[0], { a: ["x"] }, "x")).toEqual([]);
    expect(toggleSelection(slots[1], { b: ["p", "q"] }, "r")).toEqual(["p", "q"]);
    expect(toggleSelection(slots[1], { b: ["p", "q"] }, "p")).toEqual(["q"]);
  });

  it("lets optional slots take more than their required count", () => {
    const optional = slot("o", 0, ["m", "n"], { max: 2 });
    expect(picksRemaining([optional], {})).toBe(0);
    expect(toggleSelection(optional, { o: ["m"] }, "n")).toEqual(["m", "n"]);
  });
});

describe("createBlocker", () => {
  const slots = [slot("a", 1, ["x", "y"])];
  const state = { picks: { class: { uuid: "c" } }, slots, selections: { a: ["x"] }, canCreate: true };

  it("allows a finished build", () => {
    expect(createBlocker(state)).toBeNull();
  });

  it("explains what is missing, permission first", () => {
    expect(createBlocker({ ...state, canCreate: false, picks: {} })).toBe("NoPermission");
    expect(createBlocker({ ...state, picks: {} })).toBe("NeedClass");
    expect(createBlocker({ ...state, selections: {} })).toBe("NeedChoices");
  });
});

describe("ability score points", () => {
  const asi = slot("bg", 3, ["int", "wis", "cha"], { kind: "asi", cap: 2 });

  it("tallies repeats", () => {
    expect(tally(["int", "int", "wis"])).toEqual({ int: 2, wis: 1 });
  });

  it("adds points up to the cap and the total", () => {
    let sel = [];
    sel = adjustPoints(asi, { bg: sel }, "int", 1);
    sel = adjustPoints(asi, { bg: sel }, "int", 1);
    expect(adjustPoints(asi, { bg: sel }, "int", 1)).toEqual(["int", "int"]);
    sel = adjustPoints(asi, { bg: sel }, "wis", 1);
    expect(sel).toEqual(["int", "int", "wis"]);
    expect(adjustPoints(asi, { bg: sel }, "cha", 1)).toEqual(sel);
  });

  it("removes one point at a time", () => {
    expect(adjustPoints(asi, { bg: ["int", "int", "wis"] }, "int", -1)).toEqual(["int", "wis"]);
    expect(adjustPoints(asi, { bg: ["wis"] }, "int", -1)).toEqual(["wis"]);
  });

  it("keeps repeats when pruning, but not past the cap, total or options", () => {
    expect(pruneSelections([asi], { bg: ["int", "int", "int", "str", "wis", "cha"] })).toEqual({ bg: ["int", "int", "wis"] });
  });

  it("counts points as picks remaining", () => {
    expect(picksRemaining([asi], { bg: ["int", "wis"] })).toBe(1);
  });
});
