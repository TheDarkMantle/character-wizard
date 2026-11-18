import { describe, expect, it } from "vitest";
import { describedExpertise, expertiseAdvancement } from "../scripts/content/described-expertise.mjs";

const canny = "<p>Choose one of your skill proficiencies. Your proficiency bonus is doubled for any ability check you make that uses the chosen skill.</p><p>You can also speak, read, and write two additional languages of your choice.</p>";

describe("describedExpertise", () => {
  it("reads the Tasha's Canny wording", () => expect(describedExpertise(canny)).toBe(1));

  it("reads the 2024 wording", () => {
    expect(describedExpertise("<p>Choose one of your skill proficiencies with which you lack Expertise. You gain Expertise in that skill.</p>")).toBe(1);
    expect(describedExpertise("<p>Choose two of your skill proficiencies with which you lack Expertise. You gain Expertise in those skills.</p>")).toBe(2);
  });

  it("ignores other text and the importer's secret duplicate", () => {
    expect(describedExpertise("<p>You have proficiency in Stealth.</p>")).toBe(0);
    expect(describedExpertise("")).toBe(0);
    expect(describedExpertise(`<p>Nothing here.</p><section class="secret">${canny}</section>`)).toBe(0);
  });
});

describe("expertiseAdvancement", () => {
  const input = { type: "feat", description: canny, traits: [{ mode: "default" }], id: "abc" };

  it("builds an Expertise choice over every skill", () => {
    expect(expertiseAdvancement(input)).toMatchObject({
      _id: "abc", type: "Trait", level: 1,
      configuration: { mode: "expertise", choices: [{ count: 1, pool: ["skills:*"] }], grants: [] }
    });
  });

  it("titles the choice with the name it is given, since dnd5e would fill in a generic label", () => {
    expect(expertiseAdvancement({ ...input, name: "Expertise" }).name).toBe("Expertise");
  });

  it("adds nothing when the item already has its own Expertise choice", () => {
    expect(expertiseAdvancement({ ...input, traits: [{ mode: "default" }, { mode: "expertise" }] })).toBeNull();
  });

  it("only applies to features", () => {
    expect(expertiseAdvancement({ ...input, type: "class" })).toBeNull();
    expect(expertiseAdvancement({ ...input, type: "race" })).toBeNull();
  });

  it("adds nothing when the text doesn't grant Expertise", () => {
    expect(expertiseAdvancement({ ...input, description: "<p>You gain darkvision.</p>" })).toBeNull();
  });
});
