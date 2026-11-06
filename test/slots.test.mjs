import { describe, expect, it } from "vitest";
import {
  adjustPoints, createBlocker, featsMatching, groupTraitSlots, meetsPrerequisites, picksRemaining, pruneSelections, spellsMatching, standardPoints, tally, toggleSelection, traitGroups, uniqueByName
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
    expect(createBlocker({ ...state, abilitiesReady: false })).toBe("NeedAbilities");
    expect(createBlocker({ ...state, equipmentReady: false })).toBe("NeedEquipment");
    expect(createBlocker({ ...state, abilitiesReady: false, equipmentReady: false })).toBe("NeedAbilities");
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

describe("racial increases (Tasha's)", () => {
  it("pools the fixed increases, capped at the largest one", () => {
    expect(standardPoints({ fixed: { str: 0, dex: 2, int: 1 } }))
      .toEqual({ total: 3, cap: 2, defaults: ["dex", "dex", "int"] });
  });

  it("keeps a species of +1s at one per ability", () => {
    const fixed = { str: 1, dex: 1, con: 1, int: 1, wis: 1, cha: 1 };
    expect(standardPoints({ fixed })).toMatchObject({ total: 6, cap: 1 });
  });

  it("adds spendable points to the total with no standard answer", () => {
    expect(standardPoints({ fixed: { cha: 2 }, points: 2 })).toEqual({ total: 4, cap: 2, defaults: ["cha", "cha"] });
  });

  it("starts as a valid selection for the points control", () => {
    const { total, cap, defaults } = standardPoints({ fixed: { dex: 2, int: 1 } });
    const slot = { key: "k", kind: "asi", count: total, cap, options: [{ value: "dex" }, { value: "int" }] };
    expect(pruneSelections([slot], { k: defaults })).toEqual({ k: defaults });
    expect(picksRemaining([slot], { k: defaults })).toBe(0);
  });
});

describe("spell choices", () => {
  const spells = [
    { name: "Fire Bolt", system: { level: 0, school: "evo" } },
    { name: "Mage Hand", system: { level: 0, school: "con" } },
    { name: "Magic Missile", system: { level: 1, school: "evo" } }
  ];

  it("filters by level and school", () => {
    expect(spellsMatching(spells, { level: "0" }).map(s => s.name)).toEqual(["Fire Bolt", "Mage Hand"]);
    expect(spellsMatching(spells, { level: "0", school: ["evo"] }).map(s => s.name)).toEqual(["Fire Bolt"]);
    expect(spellsMatching(spells, { level: "" })).toHaveLength(3);
  });

  it("matches nothing for relative levels it can't resolve", () => {
    expect(spellsMatching(spells, { level: "available" })).toEqual([]);
  });

  it("offers a spell once when several compendiums have it", () => {
    expect(uniqueByName([{ name: "Fire Bolt", id: 1 }, { name: "fire bolt", id: 2 }, { name: "Light", id: 3 }])
      .map(e => e.id)).toEqual([1, 3]);
  });
});

describe("traitGroups", () => {
  const skills = ["skills:acr", "skills:ath", "skills:ins", "skills:prc", "skills:rel"];
  const anyKeys = type => (type === "skills" ? skills : []);
  const choice = (full, idx = 0) => ({ type: "choice", idx, full });
  const grant = key => ({ type: "grant", full: [key] });
  const values = group => group.options.map(o => `${o.value}${o.disabled ? "!" : ""}`);

  it("grants a proficiency the character doesn't have", () => {
    expect(traitGroups({ slots: [grant("skills:ins")], anyKeys })).toEqual({ grants: ["skills:ins"], groups: [] });
  });

  it("turns a grant the character already has into a pick of any other", () => {
    const { grants, groups } = traitGroups({ slots: [grant("skills:ins")], anyKeys, held: new Set(["skills:ins", "skills:ath"]) });
    expect(grants).toEqual([]);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({ id: "r:skills", count: 1 });
    expect(values(groups[0])).toEqual(["skills:acr", "skills:ath!", "skills:ins!", "skills:prc", "skills:rel"]);
  });

  it("greys out what the character holds but still offers the rest of the pool", () => {
    const pool = ["skills:acr", "skills:ath", "skills:prc", "skills:rel"];
    const { groups } = traitGroups({ slots: [choice(pool), choice(pool)], anyKeys, held: new Set(["skills:ath"]) });
    expect(groups).toHaveLength(1);
    expect(groups[0].count).toBe(2);
    expect(values(groups[0])).toEqual(["skills:acr", "skills:ath!", "skills:prc", "skills:rel"]);
  });

  it("offers any proficiency of the kind when the whole pool is already held", () => {
    const { groups } = traitGroups({ slots: [choice(["skills:ath", "skills:prc"])], anyKeys, held: new Set(["skills:ath", "skills:prc"]) });
    expect(groups[0].id).toBe("r:skills");
    expect(values(groups[0])).toEqual(["skills:acr", "skills:ath!", "skills:ins", "skills:prc!", "skills:rel"]);
  });

  it("grants outright what has no real choice left", () => {
    const { grants, groups } = traitGroups({ slots: [choice(["skills:ath", "skills:prc"])], anyKeys, held: new Set(["skills:ath"]) });
    expect(grants).toEqual(["skills:prc"]);
    expect(groups).toEqual([]);
  });

  it("hides blocked options from choices but never from fixed grants", () => {
    const blocked = new Set(["skills:rel", "skills:ins"]);
    const { grants, groups } = traitGroups({ slots: [grant("skills:ins"), choice(skills)], anyKeys, blocked });
    expect(grants).toEqual(["skills:ins"]);
    expect(values(groups[0])).toEqual(["skills:acr", "skills:ath", "skills:prc"]);
  });

  it("can't offer something it grants", () => {
    const { groups } = traitGroups({ slots: [grant("skills:ath"), choice(skills)], anyKeys });
    expect(values(groups[0])).toContain("skills:ath!");
  });

  it("ignores disabled options when pruning selections", () => {
    const slot = { key: "k", kind: "trait", count: 1, options: [{ value: "a", disabled: true }, { value: "b" }] };
    expect(pruneSelections([slot], { k: ["a"] })).toEqual({});
    expect(pruneSelections([slot], { k: ["b"] })).toEqual({ k: ["b"] });
  });
});

describe("feat prerequisites", () => {
  const invocation = (name, prerequisites) => ({ name, featType: "feat", featSubtype: "eldritchInvocation", prerequisites });
  const character = { level: 1, held: new Set(["warlock", "class:warlock"]) };

  it("hides invocations that need a higher level", () => {
    const feats = [invocation("Armor of Shadows", { level: 0, items: [] }), invocation("Devil's Sight", { level: 5, items: [] })];
    expect(featsMatching(feats, { subtype: "eldritchInvocation" }, character).map(f => f.name)).toEqual(["Armor of Shadows"]);
  });

  it("hides invocations that need an item the character lacks", () => {
    const needsBlade = invocation("Lifedrinker", { level: 0, items: ["pact-of-the-blade"] });
    expect(meetsPrerequisites(needsBlade, character)).toBe(false);
    expect(meetsPrerequisites(needsBlade, { level: 1, held: new Set(["pact-of-the-blade"]) })).toBe(true);
  });

  it("accepts any one of several listed items", () => {
    const either = invocation("Either", { items: ["pact-of-the-blade", "pact-of-the-chain"] });
    expect(meetsPrerequisites(either, { level: 3, held: new Set(["pact-of-the-chain"]) })).toBe(true);
  });

  it("offers everything when no character is given, and feats with no prerequisites", () => {
    expect(featsMatching([invocation("A", { level: 9, items: [] })], {})).toHaveLength(1);
    expect(meetsPrerequisites({ name: "Plain" }, character)).toBe(true);
  });
});
