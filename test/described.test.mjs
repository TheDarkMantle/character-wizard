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

  it("handles real imported text: markup inside words, brackets with commas, choices", () => {
    const urchin = '<p><strong>Equipment: </strong>A small knife, a map of the city you grew up in, a pet mouse, a token to remember your parents by, a set of common clothes, and a pouch c<span class="No-Break">ontaining 10 gp</span></p>';
    expect(describedItems(urchin, ["Knife, Small", "Clothes, Common"]).map(i => i.name))
      .toEqual(["Map of the city", "Pet mouse", "Token to remember your parents by"]);

    const entertainer = "<p><strong>Equipment:</strong> A musical instrument (one of your choice), the favor of an admirer (love letter, lock of hair, or trinket), a costume, and a pouch containing 15 gp</p>";
    expect(describedItems(entertainer, ["Costume"]).map(i => i.name)).toEqual(["Favor of an admirer"]);
  });

  it("treats a staff as the quarterstaff the character already has", () => {
    const outlander = "<p><strong>Equipment:</strong> A staff, a hunting trap, a trophy from an animal you killed, and a pouch containing 10 gp</p>";
    expect(describedItems(outlander, ["Quarterstaff", "Trap, Hunting"]).map(i => i.name)).toEqual(["Trophy from an animal"]);
  });
});
