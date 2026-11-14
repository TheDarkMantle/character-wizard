import { describe, expect, it } from "vitest";
import { inCategory, isMonsterAttack, isMundane, normalizeGear, pickCandidates, rankedGear } from "../scripts/equipment/gear.mjs";

const pack = (collection, label = collection) => ({ collection, label });
const raw = (name, type, extra = {}) => ({ _id: name.replace(/\W/g, ""), name, type, img: "", system: { ...extra } });

describe("isMundane", () => {
  it("is false for anything with a rarity or the magical property", () => {
    expect(isMundane(raw("Longsword", "weapon", { rarities: {}, properties: [] }))).toBe(true);
    expect(isMundane(raw("Longsword", "weapon", { rarities: [], properties: ["ver"] }))).toBe(true);
    expect(isMundane(raw("Dancing Longsword", "weapon", { rarities: { rare: true } }))).toBe(false);
    expect(isMundane(raw("Flame Tongue", "weapon", { rarities: [], properties: ["mgc", "ver"] }))).toBe(false);
    expect(isMundane(raw("Plain", "weapon", {}))).toBe(true);
  });
});

describe("normalizeGear", () => {
  it("keeps gear and drops everything else", () => {
    const longsword = normalizeGear(raw("Longsword", "weapon", {
      identifier: "longsword", type: { value: "martialM", baseItem: "longsword" }, source: { rules: "2014" }, container: null
    }), pack("dnd5e.items", "Items (SRD)"));
    expect(longsword).toMatchObject({ type: "weapon", typeValue: "martialM", baseItem: "longsword", rules: "2014", mundane: true, container: null });
    expect(normalizeGear(raw("Fireball", "spell"), pack("x"))).toBeNull();
    expect(normalizeGear(raw("Fighter", "class"), pack("x"))).toBeNull();
  });
});

describe("inCategory", () => {
  const sword = { type: "weapon", typeValue: "martialM" };
  const bow = { type: "weapon", typeValue: "simpleR" };
  it("matches specific weapon types and the simple and martial groups", () => {
    expect(inCategory(sword, "weapon", "martialM")).toBe(true);
    expect(inCategory(sword, "weapon", "martialR")).toBe(false);
    expect(inCategory(sword, "weapon", "mar")).toBe(true);
    expect(inCategory(bow, "weapon", "sim")).toBe(true);
    expect(inCategory(bow, "weapon", "mar")).toBe(false);
    expect(inCategory(bow, "weapon", "")).toBe(true);
  });

  it("matches armor, shields and tools", () => {
    expect(inCategory({ type: "equipment", typeValue: "shield" }, "armor", "shield")).toBe(true);
    expect(inCategory({ type: "equipment", typeValue: "light" }, "armor", "shield")).toBe(false);
    expect(inCategory({ type: "equipment", typeValue: "clothing" }, "armor", "")).toBe(false);
    expect(inCategory({ type: "tool", typeValue: "game" }, "tool", "game")).toBe(true);
    expect(inCategory({ type: "tool", typeValue: "music" }, "tool", "game")).toBe(false);
    expect(inCategory({ type: "tool", typeValue: "music" }, "tool", "")).toBe(true);
  });
});

describe("pickCandidates", () => {
  const gear = [
    { uuid: "srd.long", name: "Longsword", type: "weapon", typeValue: "martialM", baseItem: "longsword", identifier: "longsword", rules: "2014", pack: "srd", mundane: true },
    { uuid: "ddb.long", name: "Longsword", type: "weapon", typeValue: "martialM", baseItem: "longsword", identifier: "longsword", rules: "2014", pack: "ddb", mundane: true },
    { uuid: "ddb.dance", name: "Dancing Longsword", type: "weapon", typeValue: "martialM", baseItem: "longsword", identifier: "dancing", rules: "2014", pack: "ddb", mundane: false },
    { uuid: "srd.maul", name: "Maul", type: "weapon", typeValue: "martialM", baseItem: "maul", identifier: "maul", rules: "2014", pack: "srd", mundane: true },
    { uuid: "new.maul", name: "Maul", type: "weapon", typeValue: "martialM", baseItem: "maul", identifier: "maul", rules: "2024", pack: "new", mundane: true },
    { uuid: "srd.dagger", name: "Dagger", type: "weapon", typeValue: "simpleM", baseItem: "dagger", identifier: "dagger", rules: "2014", pack: "srd", mundane: true }
  ];
  const find = extra => pickCandidates(gear, { category: "weapon", key: "martialM", rules: "2014", packOrder: ["srd", "ddb"], ...extra }).map(g => g.uuid);

  it("leaves out magic items, other categories and copies from the other edition", () => {
    expect(find()).toEqual(["srd.long", "srd.maul"]);
  });

  it("collapses copies of one base item, keeping the better ranked pack", () => {
    expect(find({ packOrder: ["ddb", "srd"] })).toEqual(["ddb.long", "srd.maul"]);
  });

  it("offers another edition's copy from a compendium allowed under any rules", () => {
    expect(find({ rules: "2024", packOrder: ["new"], anyRulesPacks: ["srd", "ddb"] })).toEqual(["srd.long", "new.maul"]);
  });
});

describe("rankedGear", () => {
  it("prefers the pack's own compendium, then the world's rules", () => {
    const gear = [
      { name: "Torch", pack: "a", rules: "2014", mundane: true },
      { name: "Torch", pack: "b", rules: "2024", mundane: true },
      { name: "Magic Torch", pack: "b", rules: "2024", mundane: false }
    ];
    const ranked = rankedGear(gear, { rules: "2024", packOrder: ["a", "b"], preferPack: "a" });
    expect(ranked).toHaveLength(2);
    expect(ranked.find(g => g.pack === "a").rank).toBeLessThan(ranked.find(g => g.pack === "b").rank);
    const world = rankedGear(gear, { rules: "2024", packOrder: ["a", "b"], preferPack: null });
    expect(world.find(g => g.pack === "b").rank).toBeLessThan(world.find(g => g.pack === "a").rank);
  });
});

describe("monster attacks stored as weapons", () => {
  const club = raw("Club", "weapon", { type: { value: "simpleM", baseItem: "club" } });
  const windBlast = raw("Wind Blast", "weapon", { type: { value: "simpleR", baseItem: "" } });

  it("tells a real weapon from a monster attack by its base item", () => {
    expect(isMonsterAttack(club)).toBe(false);
    expect(isMonsterAttack(windBlast)).toBe(true);
    expect(isMonsterAttack(raw("Rope", "equipment"))).toBe(false);
  });

  it("keeps monster attacks out of the pickable gear", () => {
    const gear = [club, windBlast].map(r => normalizeGear(r, pack("x")));
    expect(pickCandidates(gear, { category: "weapon", key: "sim", rules: "2014" }).map(g => g.name)).toEqual(["Club"]);
    expect(rankedGear(gear, { rules: "2014" }).map(g => g.name)).toEqual(["Club"]);
  });
});

describe("variants of one base item", () => {
  const spear = (name, rules, extra = {}) => ({
    ...raw(name, "weapon", { type: { value: "simpleM", baseItem: "spear" }, source: { rules }, ...extra })
  });

  it("offers the plain item, not a variant that shares its base item and ranks better", () => {
    const gear = [
      normalizeGear(spear("Shadowsteel Spear", "2014"), pack("tob2")),
      normalizeGear(spear("Spear", "2014"), pack("srd")),
      normalizeGear(spear("Spear", "2024"), pack("ddb"))
    ];
    // The variant's pack comes first in the GM's order, which used to be enough to take the Spear's place.
    const list = pickCandidates(gear, { category: "weapon", key: "sim", rules: "2014", packOrder: ["tob2", "srd", "ddb"] });
    expect(list.map(g => g.name)).toEqual(["Spear"]);
    expect(list[0].pack).toBe("srd");
  });

  it("still picks the best-ranked copy of the plain item", () => {
    const gear = [normalizeGear(spear("Spear", "2014"), pack("a")), normalizeGear(spear("Spear", "2014"), pack("b"))];
    expect(pickCandidates(gear, { category: "weapon", key: "sim", rules: "2014", packOrder: ["b", "a"] })[0].pack).toBe("b");
  });
});
