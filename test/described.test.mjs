import { describe, expect, it } from "vitest";
import { describedItems } from "../scripts/equipment/described.mjs";

const sage = "<dl><dt><strong>Equipment:</strong> A bottle of black ink, a quill, a small knife, a letter from a dead colleague posing a question you have not yet been able to answer, a set of common clothes, and a pouch containing 10 gp</dt></dl>";

describe("describedItems", () => {
  it("adds only what the linked items don't cover", () => {
    const items = describedItems(sage, ["Ink (1 ounce bottle)", "Ink Pen", "Knife, Small", "Common Clothes"]);
    expect(items.map(i => i.name)).toEqual(["Quill", "Letter from a dead colleague"]);
    expect(items[1].description).toContain("posing a question");
  });

  it("finds a scroll of pedigree and skips the purse", () => {
    const knight = "<p><strong>Equipment:</strong> A set of fine clothes, a signet ring, a scroll of pedigree, and a purse containing 25 gp</p>";
    expect(describedItems(knight, ["Fine Clothes", "Signet Ring"]).map(i => i.name)).toEqual(["Scroll of pedigree"]);
  });

  it("leaves 2024 'Choose A or B' text alone", () => {
    expect(describedItems("<p><strong>Equipment:</strong> Choose A or B: (A) Quarterstaff, Robe, 8 GP; or (B) 50 GP</p>")).toEqual([]);
  });

  it("is empty with no equipment line", () => {
    expect(describedItems("<p>Nothing here</p>")).toEqual([]);
  });
});
