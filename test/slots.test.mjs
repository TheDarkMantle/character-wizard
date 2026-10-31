import { describe, expect, it } from "vitest";
import {
  featsMatching, groupTraitSlots, picksRemaining, pruneSelections, toggleSelection
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
