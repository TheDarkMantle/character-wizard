import { describe, expect, it } from "vitest";
import { buildCatalog, contentKey, matchesRules, normalizeEntry, searchEntries, slugify, subclassesFor }
  from "../scripts/content/catalog-logic.mjs";

const pack = (collection, label = collection) => ({ collection, label });
const raw = (type, name, extra = {}, system = {}) => ({ _id: name.replace(/\W/g, ""), type, name, img: "icon.webp",
  system, ...extra });

describe("slugify", () => {
  it("makes dnd5e-style identifiers", () => {
    expect(slugify("Path of the Berserker")).toBe("path-of-the-berserker");
    expect(slugify("Dragonborn's Breath")).toBe("dragonborns-breath");
    expect(slugify("Élan  Vital")).toBe("elan-vital");
  });
});

describe("normalizeEntry", () => {
  it("ignores types the wizard doesn't use", () => {
    expect(normalizeEntry(raw("weapon", "Longsword"), pack("p"))).toBeNull();
  });

  it("builds uuid, identifier, rules and key", () => {
    const e = normalizeEntry(raw("subclass", "Champion", {}, {
      identifier: "champion", classIdentifier: "fighter", source: { rules: "2024", book: "PHB 2024" }
    }), pack("dnd-players-handbook.classes", "PHB Classes"));
    expect(e.uuid).toBe("Compendium.dnd-players-handbook.classes.Item.Champion");
    expect(e.rules).toBe("2024");
    expect(e.key).toBe("subclass:fighter:champion");
    expect(e.book).toBe("PHB 2024");
  });

  it("falls back to a slug when identifier is missing", () => {
    const e = normalizeEntry(raw("race", "Hill Dwarf"), pack("p"));
    expect(e.identifier).toBe("hill-dwarf");
    expect(e.rules).toBeNull();
  });

  it("reads feat subtype", () => {
    const e = normalizeEntry(raw("feat", "Archery", {}, { type: { value: "feat", subtype: "fightingStyle" } }),
      pack("p"));
    expect(e.featType).toBe("feat");
    expect(e.featSubtype).toBe("fightingStyle");
  });
});

describe("contentKey", () => {
  it("scopes subclasses to their class", () => {
    expect(contentKey({ type: "subclass", identifier: "champion", classIdentifier: "fighter" }))
      .not.toBe(contentKey({ type: "subclass", identifier: "champion", classIdentifier: "paladin" }));
  });
});

describe("matchesRules", () => {
  it("filters tagged content by rules", () => {
    expect(matchesRules({ rules: "2014" }, "2024")).toBe(false);
    expect(matchesRules({ rules: "2024" }, "2024")).toBe(true);
  });
  it("follows the untagged setting", () => {
    expect(matchesRules({ rules: null }, "2024", "show")).toBe(true);
    expect(matchesRules({ rules: null }, "2024", "hide")).toBe(false);
  });
});

describe("buildCatalog", () => {
  const srd = pack("dnd5e.classes", "SRD");
  const phb = pack("dnd-players-handbook.classes", "PHB");
  const entries = [
    normalizeEntry(raw("class", "Fighter", { _id: "a" }, { identifier: "fighter", source: { rules: "2024" } }), srd),
    normalizeEntry(raw("class", "Fighter", { _id: "b" }, { identifier: "fighter", source: { rules: "2024" } }), phb),
    normalizeEntry(raw("class", "Fighter", { _id: "c" }, { identifier: "fighter", source: { rules: "2014" } }), srd),
    normalizeEntry(raw("subclass", "Champion", {}, { identifier: "champion", classIdentifier: "fighter",
      source: { rules: "2024" } }), phb),
    normalizeEntry(raw("race", "Elf", {}, { identifier: "elf", source: { rules: "2024" } }), srd),
    normalizeEntry(raw("race", "Tiefling", {}, { identifier: "tiefling", source: { rules: "2024" } }), srd),
    normalizeEntry(raw("race", "Kenku", {}, { identifier: "kenku" }), pack("homebrew", "Homebrew"))
  ];

  it("filters by rules and de-duplicates, first scanned pack wins by default", () => {
    const { byType, duplicates } = buildCatalog(entries, { rules: "2024" });
    expect(byType.class).toHaveLength(1);
    expect(byType.class[0].pack).toBe("dnd5e.classes");
    expect(duplicates).toBe(1);
  });

  it("respects pack priority", () => {
    const { byType } = buildCatalog(entries, { rules: "2024", packOrder: ["dnd-players-handbook.classes"] });
    expect(byType.class[0].pack).toBe("dnd-players-handbook.classes");
  });

  it("hides blocked content and counts it", () => {
    const { byType, blockedCount } = buildCatalog(entries, { rules: "2024", blocked: ["race:tiefling"] });
    expect(byType.race.map(r => r.name)).toEqual(["Elf", "Kenku"]);
    expect(blockedCount).toBe(1);
  });

  it("can include blocked content flagged, for the GM view", () => {
    const { byType } = buildCatalog(entries, { rules: "2024", blocked: ["race:tiefling"], includeBlocked: true });
    expect(byType.race.find(r => r.name === "Tiefling").blocked).toBe(true);
  });

  it("hides untagged content when asked", () => {
    const { byType } = buildCatalog(entries, { rules: "2024", untagged: "hide" });
    expect(byType.race.map(r => r.name)).toEqual(["Elf", "Tiefling"]);
  });

  it("prefers a tagged copy over an untagged copy of the same thing", () => {
    const extra = normalizeEntry(raw("race", "Elf", { _id: "x" }, { identifier: "elf" }), pack("homebrew"));
    const { byType } = buildCatalog([...entries, extra], { rules: "2024" });
    expect(byType.race.filter(r => r.identifier === "elf")).toHaveLength(1);
    expect(byType.race.find(r => r.identifier === "elf").rules).toBe("2024");
  });

  it("finds subclasses for a class", () => {
    const catalog = buildCatalog(entries, { rules: "2024" });
    expect(subclassesFor(catalog, "fighter").map(s => s.name)).toEqual(["Champion"]);
  });

  it("searches by name and source", () => {
    const { byType } = buildCatalog(entries, { rules: "2024" });
    expect(searchEntries(byType.race, "homebrew").map(r => r.name)).toEqual(["Kenku"]);
    expect(searchEntries(byType.race, "  ")).toHaveLength(3);
  });
});
