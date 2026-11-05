import { describe, expect, it } from "vitest";
import { builtInPack, fillQuivers, matchItemName, normalizeName, parsePackDescription, SRD_PACKS_2014 } from "../scripts/equipment/packs.mjs";

const q = lines => lines.map(l => `${l.qty}× ${l.names[0]}`);

describe("parsePackDescription", () => {
  it("reads the 2024 SRD description with item links", () => {
    const html = "<p>An Explorer's Pack contains the following items: @UUID[Compendium.dnd5e.equipment24.Item.phbagBackpack000]{Backpack}, "
      + "@UUID[Compendium.dnd5e.equipment24.Item.phbagBedroll0000]{Bedroll}, 2 flasks of @UUID[Compendium.dnd5e.equipment24.Item.phbagOil00000000]{Oil}, "
      + "10 days of @UUID[Compendium.dnd5e.equipment24.Item.phbagRations0000]{Rations}, @UUID[Compendium.dnd5e.equipment24.Item.phbagRope0000000]{Rope}, "
      + "@UUID[Compendium.dnd5e.equipment24.Item.phbagTinderbox00]{Tinderbox}, 10 @UUID[Compendium.dnd5e.equipment24.Item.phbagTorch000000]{Torches}, "
      + "and @UUID[Compendium.dnd5e.equipment24.Item.phbagWaterskin00]{Waterskin}.</p>";
    const lines = parsePackDescription(html);
    expect(q(lines)).toEqual(["1× Backpack", "1× Bedroll", "2× Oil", "10× Rations", "1× Rope", "1× Tinderbox", "10× Torches", "1× Waterskin"]);
    expect(lines[0].uuid).toBe("Compendium.dnd5e.equipment24.Item.phbagBackpack000");
    expect(lines[2].uuid).toBe("Compendium.dnd5e.equipment24.Item.phbagOil00000000");
  });

  it("reads the plain-text D&D Beyond description", () => {
    const html = '<div class="ddb"><p>An Explorer’s Pack contains the following items: Backpack, Bedroll, 2 flasks of Oil, 10 days of Rations, Rope, Tinderbox, 10 Torches, and Waterskin.</p></div>';
    const lines = parsePackDescription(html);
    expect(q(lines)).toEqual(["1× Backpack", "1× Bedroll", "2× flasks of Oil", "10× days of Rations", "1× Rope", "1× Tinderbox", "10× Torches", "1× Waterskin"]);
    // The part after "of" is offered as the item name too.
    expect(lines[2].names).toEqual(["flasks of Oil", "Oil"]);
    expect(lines.every(l => !l.uuid)).toBe(true);
  });

  it("counts things but not measurements", () => {
    const lines = parsePackDescription("A pack contains: a bedroll, 50 feet of hempen rope, 5 candles, 10 pitons, a set of fine clothes and a crowbar.");
    expect(lines.map(l => [l.qty, l.names.at(-1)])).toEqual([
      [1, "bedroll"], [1, "hempen rope"], [5, "candles"], [10, "pitons"], [1, "fine clothes"], [1, "crowbar"]
    ]);
  });

  it("returns nothing when the description lists no items", () => {
    expect(parsePackDescription("A backpack can hold one cubic foot or 30 pounds of gear.")).toEqual([]);
    expect(parsePackDescription("")).toEqual([]);
  });
});

describe("normalizeName", () => {
  it("ignores case, notes and plurals", () => {
    expect(normalizeName("Torches")).toBe("torch");
    expect(normalizeName("Rations (1 day)")).toBe("ration");
    expect(normalizeName("Rope, Hempen (50 feet)")).toBe("rope hempen");
    expect(normalizeName("Ball Bearings (bag of 1,000)")).toBe("ball bearing");
  });
});

describe("matchItemName", () => {
  const gear = [
    { name: "Backpack", id: "backpack" }, { name: "Rope, Hempen (50 feet)", id: "hemp" }, { name: "Rope, Silk (50 feet)", id: "silk" },
    { name: "Torch", id: "torch" }, { name: "Rations (1 day)", id: "rations" }, { name: "Oil (flask)", id: "oil" },
    { name: "Clothes, Costume", id: "costume" }, { name: "Clothes, Fine", id: "fine" }, { name: "Lantern, Hooded", id: "lantern" }
  ];
  const find = (...names) => matchItemName(names, gear)?.id;

  it("matches whatever the word order or plurals", () => {
    expect(find("Torches")).toBe("torch");
    expect(find("hempen rope")).toBe("hemp");
    expect(find("days of Rations", "Rations")).toBe("rations");
    expect(find("hooded lantern")).toBe("lantern");
  });

  it("prefers an exact name, then the closest", () => {
    expect(find("rope")).toBeTruthy();
    expect(find("costume")).toBe("costume");
    expect(find("fine clothes")).toBe("fine");
  });

  it("finds nothing for an unknown item, and prefers the better ranked copy", () => {
    expect(find("unobtainium")).toBeUndefined();
    const dup = [{ name: "Torch", id: "late", rank: 5 }, { name: "Torch", id: "early", rank: 1 }];
    expect(matchItemName(["torch"], dup).id).toBe("early");
  });
});

describe("the built-in 2014 packs", () => {
  it("covers the seven SRD packs", () => {
    expect(Object.keys(SRD_PACKS_2014).sort()).toEqual([
      "burglars-pack", "diplomats-pack", "dungeoneers-pack", "entertainers-pack", "explorers-pack", "priests-pack", "scholars-pack"
    ]);
  });

  it("lists the Explorer's Pack as the SRD does", () => {
    expect(builtInPack("explorers-pack").map(l => `${l.qty}× ${l.names[0]}`)).toEqual([
      "1× backpack", "1× bedroll", "1× mess kit", "1× tinderbox", "10× torch", "10× rations", "1× waterskin", "1× hempen rope"
    ]);
  });

  it("knows nothing about other packs", () => {
    expect(builtInPack("apothecarys-pack")).toEqual([]);
  });
});

describe("whether a pack line stated its quantity", () => {
  it("is explicit only when a number is given", () => {
    const lines = parsePackDescription("A pack contains: a bedroll, 10 Torches, two candles, 1,000 ball bearings, and 50 feet of rope.");
    expect(lines.map(l => [l.qty, l.explicit])).toEqual([[1, false], [10, true], [2, true], [1000, true], [1, false]]);
  });

  it("marks table lines explicit when they give more than one", () => {
    const lines = builtInPack("explorers-pack");
    expect(lines.find(l => l.names[0] === "torch")).toMatchObject({ qty: 10, explicit: true });
    expect(lines.find(l => l.names[0] === "backpack")).toMatchObject({ qty: 1, explicit: false });
  });
});

describe("fillQuivers", () => {
  const quiver = { name: "Quiver", children: [], source: "none" };
  const arrows = { name: "Arrows", quantity: 20 };

  it("puts arrows and bolts into an empty quiver", () => {
    const lines = fillQuivers([{ name: "Longbow" }, quiver, arrows, { name: "Crossbow Bolts", quantity: 20 }]);
    expect(lines.map(l => l.name)).toEqual(["Longbow", "Quiver"]);
    expect(lines[1].children.map(c => c.name)).toEqual(["Arrows", "Crossbow Bolts"]);
    expect(lines[1].source).toBe("gear");
  });

  it("leaves a quiver that already has contents alone", () => {
    const full = { name: "Quiver", children: [{ name: "Arrows" }], source: "contents" };
    expect(fillQuivers([full, arrows])).toEqual([full, arrows]);
  });

  it("does nothing without ammunition or without a quiver", () => {
    expect(fillQuivers([quiver, { name: "Longbow" }])).toEqual([quiver, { name: "Longbow" }]);
    expect(fillQuivers([arrows])).toEqual([arrows]);
  });

  it("keeps arrows out of a bolt case", () => {
    const bolts = { name: "Case, Crossbow Bolt", children: [], source: "none" };
    const lines = fillQuivers([bolts, arrows, { name: "Crossbow Bolts" }]);
    expect(lines.find(l => l.name.startsWith("Case")).children.map(c => c.name)).toEqual(["Crossbow Bolts"]);
    expect(lines.some(l => l.name === "Arrows")).toBe(true);
  });
});
