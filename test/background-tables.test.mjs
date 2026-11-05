import { describe, expect, it } from "vitest";
import {
  classifyTable, composeValue, entryForRoll, rollFormula, tableEntries, tableLinks, togglePick
} from "../scripts/content/background-tables.mjs";

describe("tableLinks", () => {
  it("finds roll table links in a description", () => {
    const html = "<p>@UUID[Compendium.dnd5e.tables.RollTable.HDzErjwy3TseLOZX]{Personality Traits} and "
      + "<div>@UUID[Compendium.world.ddb-tables.RollTable.KjqdMrgg49rdLa3F]{Open RollTable Background: Sage: Bond}</div>"
      + " @UUID[Compendium.dnd5e.items.Item.abc]{An item}</p>";
    expect(tableLinks(html)).toEqual([
      { uuid: "Compendium.dnd5e.tables.RollTable.HDzErjwy3TseLOZX", label: "Personality Traits" },
      { uuid: "Compendium.world.ddb-tables.RollTable.KjqdMrgg49rdLa3F", label: "Open RollTable Background: Sage: Bond" }
    ]);
  });
});

describe("classifyTable", () => {
  it("names the kind of table", () => {
    expect(classifyTable("Background: Sage: Personality Trait")).toBe("trait");
    expect(classifyTable("Acolyte Ideals")).toBe("ideal");
    expect(classifyTable("Open RollTable Background: Sage: Bond")).toBe("bond");
    expect(classifyTable("Background: Urchin: Flaw")).toBe("flaw");
  });
  it("ignores other tables", () => {
    expect(classifyTable("Background: Sage: Specialty")).toBeNull();
    expect(classifyTable("Background: Folk Hero: Defining Event")).toBeNull();
  });
});

describe("tableEntries", () => {
  const results = [
    { range: [3, 4], description: "<p>Third &amp; fourth</p>" },
    { range: [1, 2], name: "First" },
    { range: [5, 5], description: "" }
  ];
  it("sorts, cleans and labels entries", () => {
    expect(tableEntries(results)).toEqual([
      { index: 0, low: 1, high: 2, label: "1–2", text: "First" },
      { index: 1, low: 3, high: 4, label: "3–4", text: "Third & fourth" }
    ]);
  });
  it("finds the entry for a roll", () => {
    const entries = tableEntries(results);
    expect(entryForRoll(entries, 4).text).toBe("Third & fourth");
    expect(entryForRoll(entries, 9)).toBeUndefined();
  });
});

describe("rollFormula", () => {
  const entries = n => tableEntries(Array.from({ length: n }, (_, i) => ({ range: [i + 1, i + 1], name: `E${i + 1}` })));
  it("rolls an ordinary die", () => {
    expect(rollFormula("1d8", entries(8))).toBe("1d8");
    expect(rollFormula("", entries(6))).toBe("1d6");
  });
  it("offers no roll when the die doesn't fit the table", () => {
    expect(rollFormula("1d8", entries(6))).toBeNull();
    expect(rollFormula("2d6", entries(11))).toBeNull();
    expect(rollFormula("", entries(7))).toBeNull();
  });
});

describe("fields", () => {
  it("composes picks and free text", () => {
    expect(composeValue(["A", "B"], " mine ")).toBe("A\nB\nmine");
    expect(composeValue([], "")).toBe("");
  });

  it("toggles picks within the field's limit", () => {
    expect(togglePick([], 2, 1)).toEqual([2]);
    expect(togglePick([2], 4, 1)).toEqual([4]);
    expect(togglePick([2], 2, 1)).toEqual([]);
    expect(togglePick([1], 3, 2)).toEqual([1, 3]);
    expect(togglePick([1, 3], 5, 2)).toEqual([1, 5]);
  });
});
