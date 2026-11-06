import { describe, expect, it } from "vitest";
import { buildCatalog, contentKey, featPrerequisites, groupSpecies, matchesRules, normalizeEntry, searchEntries, slugify, subclassesFor }
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

describe("groupSpecies", () => {
  const sp = (name, extra = {}) => ({ name, key: `race:${name}`, ...extra });

  it("groups subraces under the importer's group name", () => {
    const rows = groupSpecies([sp("Aereni Elf", { groupName: "Elf" }), sp("Wood Elf (PHB)", { groupName: "Elf" }), sp("Bugbear", { groupName: "Bugbear" })]);
    expect(rows.map(r => r.group ?? r.entry.name)).toEqual(["Bugbear", "Elf"]);
    expect(rows[1].entries).toHaveLength(2);
  });

  it("groups system species by the end of their name, and joins a plain base race", () => {
    const rows = groupSpecies([sp("Hill Dwarf"), sp("Mountain Dwarf"), sp("Human"), sp("Variant Human (PHB)"), sp("Half-Elf")]);
    expect(rows.map(r => r.group ?? r.entry.name)).toEqual(["Dwarf", "Half-Elf", "Human"]);
    expect(rows[2].entries.map(e => e.name)).toEqual(["Human", "Variant Human (PHB)"]);
  });

  it("leaves a lone subrace as a plain entry", () => {
    const rows = groupSpecies([sp("Hill Dwarf"), sp("Tiefling")]);
    expect(rows.every(r => "entry" in r)).toBe(true);
  });
});

describe("anyRulesPacks", () => {
  const entry = (name, packId, rules) => normalizeEntry({ _id: name, name, type: "class", uuid: `u.${name}`, img: "", system: { source: { rules } } }, pack(packId));

  it("offers a compendium's content whatever its rules tag says", () => {
    const entries = [entry("Apothecary", "homebrew", "2014"), entry("Fighter", "srd", "2024"), entry("Old Thing", "srd", "2014")];
    const hidden = buildCatalog(entries, { rules: "2024" });
    expect(hidden.byType.class.map(e => e.name)).toEqual(["Fighter"]);
    const shown = buildCatalog(entries, { rules: "2024", anyRulesPacks: ["homebrew"] });
    expect(shown.byType.class.map(e => e.name)).toEqual(["Apothecary", "Fighter"]);
  });

  it("still applies to the other ruleset", () => {
    const entries = [entry("Artificer", "homebrew", "2024")];
    expect(buildCatalog(entries, { rules: "2014", anyRulesPacks: ["homebrew"] }).byType.class).toHaveLength(1);
  });
});

describe("featPrerequisites", () => {
  it("uses the system's prerequisite data", () => {
    expect(featPrerequisites({ prerequisites: { level: 5, items: ["pact-of-the-blade"] } }))
      .toEqual({ level: 5, items: ["pact-of-the-blade"] });
  });

  it("reads an imported feat's requirements text when the data is empty", () => {
    expect(featPrerequisites({ requirements: "5th Level Warlock, Pact of the Blade" }))
      .toEqual({ level: 5, items: ["pact-of-the-blade"] });
    expect(featPrerequisites({ requirements: "Warlock Level 1+" })).toEqual({ level: 0, items: [] });
  });

  it("is empty for a feat with no requirements", () => {
    expect(featPrerequisites({})).toEqual({ level: 0, items: [] });
  });
});
