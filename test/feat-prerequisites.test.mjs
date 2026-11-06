import { describe, expect, it } from "vitest";
import { mergePrerequisites, textPrerequisites } from "../scripts/content/feat-prerequisites.mjs";

describe("textPrerequisites", () => {
  it("reads the level from the imported description", () => {
    const html = '<div class="ddb"><p><em>Prerequisite: Level 2+ Warlock</em></p>\n<p>You can see normally in Dim Light and Darkness.</p></div>';
    expect(textPrerequisites(html)).toEqual({ level: 2, items: [] });
  });

  it("reads an official description in a blockquote", () => {
    expect(textPrerequisites("<blockquote><p>Prerequisite: Level 5+ Warlock</p></blockquote><p>Text.</p>").level).toBe(5);
  });

  it("reads a named Pact and an ordinal level", () => {
    expect(textPrerequisites("<p>Prerequisite: 5th-level Warlock, Pact of the Blade</p>"))
      .toEqual({ level: 5, items: ["pact-of-the-blade"] });
  });

  it("doesn't read the feat's own text", () => {
    expect(textPrerequisites("<p>Prerequisite: Pact of the Chain</p><p>You can cast a spell of level 3 and 9 times.</p>"))
      .toEqual({ level: 0, items: ["pact-of-the-chain"] });
  });

  it("finds nothing without a prerequisite line", () => {
    expect(textPrerequisites("<p>You can see in the dark. Level 9 is far.</p>")).toEqual({ level: 0, items: [] });
  });
});

describe("mergePrerequisites", () => {
  it("takes the higher level", () => {
    expect(mergePrerequisites({ level: 1, items: [] }, { level: 2, items: [] }).level).toBe(2);
    expect(mergePrerequisites({ level: 5, items: [] }, { level: 0, items: [] }).level).toBe(5);
  });
  it("prefers the data's items, else the text's", () => {
    expect(mergePrerequisites({ level: 0, items: ["a"] }, { level: 0, items: ["b"] }).items).toEqual(["a"]);
    expect(mergePrerequisites({ level: 0, items: [] }, { level: 0, items: ["b"] }).items).toEqual(["b"]);
  });
});
