import { describe, expect, it } from "vitest";
import { buildBoard, levelsOf, remainingChoices } from "../scripts/advancement/read.mjs";

// Trimmed-down advancement data shaped like a 2024 Fighter in dnd5e 6.0.
const fighter = [
  { _id: "hp", type: "HitPoints", title: "Hit Points", configuration: {} },
  { _id: "saves", type: "Trait", title: "Saving Throws", level: 1, classRestriction: "primary",
    configuration: { grants: ["saves:str", "saves:con"], choices: [], mode: "default" } },
  { _id: "skills", type: "Trait", title: "Skills", level: 1, classRestriction: "primary",
    configuration: { grants: [], choices: [{ count: 2, pool: ["skills:acr", "skills:ath", "skills:prc"] }] } },
  { _id: "multi", type: "Trait", title: "Multiclass Proficiencies", level: 1, classRestriction: "secondary",
    configuration: { grants: ["armor:lgt"], choices: [] } },
  { _id: "f1", type: "ItemGrant", title: "Features", level: 1,
    configuration: { items: [{ uuid: "Compendium.x.Item.secondwind" }] } },
  { _id: "style", type: "ItemChoice", title: "Fighting Style", configuration: {
    choices: { 1: { count: 1 } }, pool: [], restriction: { type: "feat", subtype: "fightingStyle" } } },
  { _id: "mastery", type: "Trait", title: "Weapon Mastery", level: 1,
    configuration: { mode: "mastery", grants: [], choices: [{ count: 3, pool: ["weapon:sim:*", "weapon:mar:*"] }] } },
  { _id: "sub", type: "Subclass", title: "Subclass", level: 3, configuration: {} },
  { _id: "asi4", type: "AbilityScoreImprovement", title: "ASI", level: 4, configuration: {} },
  { _id: "scale", type: "ScaleValue", title: "Second Wind uses",
    configuration: { scale: { 1: { value: 2 }, 4: { value: 3 } } } },
  { _id: "weird", type: "SomeModuleAdvancement", title: "Custom", level: 1, configuration: {} }
];

describe("levelsOf", () => {
  it("handles per-type level rules", () => {
    expect(levelsOf(fighter[5])).toEqual([1]);
    expect(levelsOf(fighter[0])).toHaveLength(20);
    expect(levelsOf(fighter[9], { itemType: "class" })).toEqual([1, 4]);
    expect(levelsOf({ type: "Size", configuration: {} })).toEqual([0]);
  });
});

describe("buildBoard", () => {
  it("splits level 1 fighter into granted and choices", () => {
    const board = buildBoard(fighter, { fromLevel: 1, toLevel: 1, itemType: "class" });
    expect(board.granted.map(e => e.title)).toEqual(["Hit Points", "Saving Throws", "Features"]);
    expect(board.choices.map(e => [e.title, e.count])).toEqual([
      ["Skills", 2], ["Fighting Style", 1], ["Weapon Mastery", 3]
    ]);
    expect(board.choices[1].restriction).toEqual({ type: "feat", subtype: "fightingStyle" });
    expect(board.choices[2].mode).toBe("mastery");
    expect(board.info.map(e => e.title)).toEqual(["Second Wind uses"]);
    expect(board.native.map(e => e.title)).toEqual(["Custom"]);
  });

  it("skips secondary-class advancements for the first class and vice versa", () => {
    const first = buildBoard(fighter, { fromLevel: 1, toLevel: 1, itemType: "class" });
    expect(first.granted.some(e => e.title === "Multiclass Proficiencies")).toBe(false);
    const multi = buildBoard(fighter, { fromLevel: 1, toLevel: 1, itemType: "class", isOriginalClass: false });
    expect(multi.granted.some(e => e.title === "Multiclass Proficiencies")).toBe(true);
    expect(multi.granted.some(e => e.title === "Saving Throws")).toBe(false);
  });

  it("includes later levels when starting higher", () => {
    const board = buildBoard(fighter, { fromLevel: 1, toLevel: 4, itemType: "class" });
    expect(board.choices.map(e => e.title)).toEqual(expect.arrayContaining(["Subclass", "ASI"]));
    expect(board.choices.filter(e => e.type === "HitPoints")).toHaveLength(3);
  });

  it("treats optional grants as choices", () => {
    const board = buildBoard([{ _id: "g", type: "ItemGrant", title: "Pick", level: 0,
      configuration: { optional: true, items: [{ uuid: "a" }, { uuid: "b" }] } }], { toLevel: 1 });
    expect(board.choices[0].choiceType).toBe("optional-item");
  });

  it("treats a single-option trait choice as a grant", () => {
    const board = buildBoard([{ _id: "t", type: "Trait", title: "Language", level: 0,
      configuration: { grants: [], choices: [{ count: 1, pool: ["languages:standard:common"] }] } }], { toLevel: 0 });
    expect(board.granted).toHaveLength(1);
    expect(board.choices).toHaveLength(0);
  });
});

describe("remainingChoices", () => {
  it("counts picks still needed", () => {
    const board = buildBoard(fighter, { fromLevel: 1, toLevel: 1, itemType: "class" });
    expect(remainingChoices(board)).toBe(6);
    const skills = board.choices[0].id;
    expect(remainingChoices(board, { [skills]: ["skills:ath"] })).toBe(5);
  });
});
