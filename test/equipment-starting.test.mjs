import { describe, expect, it } from "vitest";
import { buildTree, describeNode, fixedGold, GOLD, isModernStyle, ITEMS, planEquipment } from "../scripts/equipment/starting.mjs";

const e = (_id, type, group = "", extra = {}) => ({ _id, type, group, sort: Object.keys(extra).length + _id.length, ...extra });
const ordered = list => list.map((x, i) => ({ ...x, sort: (i + 1) * 100 }));

// A trimmed 2024 Fighter: choose A (kit) or B (kit), or gold.
const fighter24 = ordered([
  e("root", "OR"),
  e("A", "AND", "root"),
  e("a1", "linked", "A", { key: "Compendium.x.Item.chain", count: null }),
  e("a2", "linked", "A", { key: "Compendium.x.Item.jav", count: 8 }),
  e("a3", "currency", "A", { key: "gp", count: 4 }),
  e("B", "AND", "root"),
  e("b1", "linked", "B", { key: "Compendium.x.Item.studded", count: null }),
  e("b2", "currency", "B", { key: "gp", count: 11 })
]);

// A trimmed 2014 Fighter: two separate choices and a fixed item.
const fighter14 = ordered([
  e("o1", "OR"),
  e("o1a", "linked", "o1", { key: "Compendium.x.Item.chain" }),
  e("o1b", "AND", "o1"),
  e("o1b1", "linked", "o1b", { key: "Compendium.x.Item.leather" }),
  e("o1b2", "linked", "o1b", { key: "Compendium.x.Item.longbow" }),
  e("o2", "OR"),
  e("o2a", "AND", "o2"),
  e("o2a1", "weapon", "o2a", { key: "martialM" }),
  e("o2a2", "armor", "o2a", { key: "shield" }),
  e("o2b", "weapon", "o2", { key: "martialM", count: 2 }),
  e("fixed", "linked", "", { key: "Compendium.x.Item.pack" })
]);

// A 2024 background: a fixed list, offered against gold.
const background24 = ordered([
  e("bg", "AND"),
  e("bg1", "linked", "bg", { key: "Compendium.x.Item.book" }),
  e("bg2", "focus", "bg", { key: "holy" }),
  e("bg3", "linked", "bg", { key: "Compendium.x.Item.parchment", count: 10 })
]);

describe("isModernStyle / fixedGold", () => {
  it("follows the source's own rules tag, then the world", () => {
    expect(isModernStyle({ rules: "2024", worldRules: "2014" })).toBe(true);
    expect(isModernStyle({ rules: "2014", worldRules: "2024" })).toBe(false);
    expect(isModernStyle({ rules: "", worldRules: "2024" })).toBe(true);
  });

  it("tells a flat amount from a formula", () => {
    expect(fixedGold("155")).toBe(155);
    expect(fixedGold(" 50 ")).toBe(50);
    expect(fixedGold("5d4 * 10")).toBeNull();
    expect(fixedGold("")).toBeNull();
  });
});

describe("buildTree", () => {
  it("nests children in order under their group", () => {
    const [root] = buildTree(fighter24);
    expect(root.type).toBe("OR");
    expect(root.children.map(c => c.id)).toEqual(["A", "B"]);
    expect(root.children[0].children.map(c => c.id)).toEqual(["a1", "a2", "a3"]);
    expect(root.children[0].children[0].count).toBe(1);
  });
});

describe("planEquipment, modern", () => {
  const plan = state => planEquipment({ entries: fighter24, wealth: "155", modern: true, state });

  it("asks A, B or gold first", () => {
    const result = plan({});
    expect(result.complete).toBe(false);
    expect(result.decisions).toHaveLength(1);
    expect(result.decisions[0]).toMatchObject({ id: "root", includesGold: true, selected: null });
    expect(result.decisions[0].options.map(o => o.id)).toEqual(["A", "B"]);
    expect(result.grants).toEqual([]);
  });

  it("grants the chosen kit", () => {
    const result = plan({ or: { root: "A" } });
    expect(result.complete).toBe(true);
    expect(result.grants).toEqual([
      { type: "item", uuid: "Compendium.x.Item.chain", count: 1 },
      { type: "item", uuid: "Compendium.x.Item.jav", count: 8 },
      { type: "currency", key: "gp", count: 4 }
    ]);
  });

  it("takes fixed gold instead of the kit", () => {
    const result = plan({ gold: true });
    expect(result.complete).toBe(true);
    expect(result.grants).toEqual([]);
    expect(result.gold).toEqual({ formula: "155", amount: 155, fixed: true });
    expect(result.decisions[0].selected).toBe(GOLD);
  });

  it("waits for a roll when the gold is a formula", () => {
    const entries = fighter24;
    expect(planEquipment({ entries, wealth: "5d4 * 10", modern: true, state: { gold: true } }).complete).toBe(false);
    const rolled = planEquipment({ entries, wealth: "5d4 * 10", modern: true, state: { gold: true, goldAmount: 120 } });
    expect(rolled.complete).toBe(true);
    expect(rolled.gold.amount).toBe(120);
  });
});

describe("planEquipment, a background as a plain list", () => {
  it("offers the list against gold", () => {
    const result = planEquipment({ entries: background24, wealth: "50", modern: true });
    expect(result.decisions[0]).toMatchObject({ id: ITEMS, includesGold: true });
    expect(result.decisions[0].options).toHaveLength(1);
    expect(result.complete).toBe(false);
  });

  it("asks for a pick from a category once the items are chosen", () => {
    const result = planEquipment({ entries: background24, wealth: "50", modern: true, state: { or: { [ITEMS]: ITEMS } } });
    expect(result.complete).toBe(false);
    expect(result.grants.find(g => g.type === "pick")).toMatchObject({ category: "focus", key: "holy", need: 1, picked: [] });
    const done = planEquipment({ entries: background24, wealth: "50", modern: true,
      state: { or: { [ITEMS]: ITEMS }, picks: { bg2: ["Compendium.x.Item.amulet"] } } });
    expect(done.complete).toBe(true);
    expect(done.grants.map(g => g.type)).toEqual(["item", "pick", "item"]);
  });

  it("just grants everything when there is no gold alternative", () => {
    const result = planEquipment({ entries: background24, wealth: "", modern: true });
    expect(result.decisions).toEqual([]);
    expect(result.grants).toHaveLength(3);
  });
});

describe("planEquipment, legacy", () => {
  const plan = state => planEquipment({ entries: fighter14, wealth: "5d4 * 10", modern: false, state });

  it("has an independent choice for each OR and grants fixed items straight away", () => {
    const result = plan({});
    expect(result.decisions.map(d => d.id)).toEqual(["o1", "o2"]);
    expect(result.decisions.every(d => !d.includesGold)).toBe(true);
    expect(result.grants).toEqual([{ type: "item", uuid: "Compendium.x.Item.pack", count: 1 }]);
    expect(result.complete).toBe(false);
  });

  it("needs every choice and every category pick", () => {
    const partial = plan({ or: { o1: "o1b", o2: "o2a" } });
    expect(partial.complete).toBe(false);
    expect(partial.grants.filter(g => g.type === "pick")).toHaveLength(2);
    const done = plan({ or: { o1: "o1a", o2: "o2b" }, picks: { o2b: ["Compendium.x.Item.longsword", "Compendium.x.Item.maul"] } });
    expect(done.complete).toBe(true);
    expect(done.grants.find(g => g.leafId === "o2b")).toMatchObject({ need: 2 });
  });

  it("doesn't count blank picks", () => {
    const result = plan({ or: { o1: "o1a", o2: "o2b" }, picks: { o2b: ["", "Compendium.x.Item.maul"] } });
    expect(result.complete).toBe(false);
    expect(result.grants.find(g => g.leafId === "o2b").picked).toEqual(["Compendium.x.Item.maul"]);
  });

  it("replaces everything with gold on request", () => {
    const rolled = plan({ gold: true, goldAmount: 90 });
    expect(rolled.complete).toBe(true);
    expect(rolled.grants).toEqual([]);
    expect(rolled.gold.amount).toBe(90);
    expect(plan({ gold: true }).complete).toBe(false);
  });
});

describe("describeNode", () => {
  it("describes groups and leaves", () => {
    const [root] = buildTree(fighter24);
    const label = node => ({ a1: "Chain Mail", a2: "8× Javelin", a3: "4 GP" })[node.id] ?? node.id;
    expect(describeNode(root.children[0], label)).toBe("Chain Mail, 8× Javelin, 4 GP");
    expect(describeNode(root, label)).toBe("Chain Mail, 8× Javelin, 4 GP or b1, b2");
  });
});
