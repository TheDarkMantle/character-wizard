import { describe, expect, it } from "vitest";
import { describedItems } from "../scripts/equipment/described.mjs";

const sage = "<dl><dt><strong>Equipment:</strong> A bottle of black ink, a quill, a small knife, a letter from a dead colleague posing a question you have not yet been able to answer, a set of common clothes, and a pouch containing 10 gp</dt></dl>";

describe("describedItems", () => {
  it("adds only what the linked items don't cover", () => {
    const items = describedItems(sage, ["Ink (1 ounce bottle)", "Ink Pen", "Knife, Small", "Common Clothes"]);
    expect(items.map(i => i.name)).toEqual(["Quill", "Letter from a dead colleague posing a question you have not yet been able to answer"]);
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
      .toEqual(["Map of the city you grew up in", "Pet mouse", "Token to remember your parents by"]);

    const entertainer = "<p><strong>Equipment:</strong> A musical instrument (one of your choice), the favor of an admirer (love letter, lock of hair, or trinket), a costume, and a pouch containing 15 gp</p>";
    expect(describedItems(entertainer, ["Costume"]).map(i => i.name)).toEqual(["Favor of an admirer (love letter, lock of hair, or trinket)"]);
  });

  it("treats a staff as the quarterstaff the character already has", () => {
    const outlander = "<p><strong>Equipment:</strong> A staff, a hunting trap, a trophy from an animal you killed, and a pouch containing 10 gp</p>";
    expect(describedItems(outlander, ["Quarterstaff", "Trap, Hunting"]).map(i => i.name)).toEqual(["Trophy from an animal you killed"]);
  });

  it("stays inside the Equipment paragraph when the description has many paragraphs", () => {
    const athlete = '<div><h1>Background: Athlete</h1><p>Intro.</p> <hr> <p><strong>Equipment:</strong> A bronze discus or leather ball, a lucky charm or past trophy, a set of traveler\u2019s clothes, and a pouch containing 10 gp</p> <hr> <h5>Feature: Echoes of Victory</h5> <p>You have attracted admiration among spectators, fellow athletes, and trainers in the region that hosted your past athletic victories.</p> <p>Between adventures, you might compete in athletic events sufficient enough to maintain a comfortable lifestyle.</p></div>';
    expect(describedItems(athlete, ["Clothes, Traveler's"]).map(i => i.name))
      .toEqual(["Bronze discus or leather ball", "Lucky charm or past trophy"]);
  });

  it("keeps the whole phrase, as in the Hermit's scroll case", () => {
    const hermit = "<p><strong>Equipment:</strong> A scroll case stuffed full of notes from your studies or prayers, a winter blanket, a set of common clothes, an herbalism kit, and 5 gp</p>";
    expect(describedItems(hermit, ["Blanket, Winter", "Common Clothes", "Herbalism Kit"]).map(i => i.name))
      .toEqual(["Scroll case stuffed full of notes from your studies or prayers"]);
  });
});
