import { describe, expect, it } from "vitest";
import { describedLanguageChoices, languageShortfall } from "../scripts/content/language-count.mjs";

const any = ["languages:*"];
const trait = (count, pool = any, id = "t1") => ({ id, choices: [{ count, pool }] });

describe("describedLanguageChoices", () => {
  it("reads the forms the books use", () => {
    expect(describedLanguageChoices("<p>You can also speak, read, and write two additional languages of your choice.</p>")).toBe(2);
    expect(describedLanguageChoices("<p>You can speak, read, and write Common and two other languages of your choice.</p>")).toBe(2);
    expect(describedLanguageChoices("<p>Common and one extra language of your choice</p>")).toBe(1);
    expect(describedLanguageChoices("<p>Languages: Two of y our choice</p>")).toBe(2);
    expect(describedLanguageChoices("<p><strong>Languages:</strong> Any one of your choice</p>")).toBe(1);
    expect(describedLanguageChoices("<p>You know three languages of your choice.</p>")).toBe(3);
  });

  it("ignores text that doesn't state a number of picks", () => {
    expect(describedLanguageChoices("<p>Languages: Choose one of Elvish, Giant, or Kraul</p>")).toBe(0);
    expect(describedLanguageChoices("<p>You can communicate telepathically; a language is not needed.</p>")).toBe(0);
    expect(describedLanguageChoices("")).toBe(0);
    expect(describedLanguageChoices(undefined)).toBe(0);
  });

  it("skips the importer's secret duplicate of the text", () => {
    const html = "<p>Pick one other language of your choice.</p><section class=\"secret\"><p>two additional languages of your choice</p></section>";
    expect(describedLanguageChoices(html)).toBe(1);
  });
});

describe("languageShortfall", () => {
  const deft = "<p>You can also speak, read, and write two additional languages of your choice.</p>";

  it("raises Deft Explorer from one language to two", () => {
    expect(languageShortfall({ type: "feat", description: deft, traits: [trait(1)] }))
      .toEqual({ advancementId: "t1", index: 0, extra: 1, count: 2 });
  });

  it("raises the Eberron Changeling's pick, which sits beside a granted Common", () => {
    const traits = [{ id: "lang", choices: [{ count: 1, pool: any }] }];
    expect(languageShortfall({ type: "race", traits,
      description: "<p>You can speak, read, and write Common and two other languages of your choice.</p>" }))
      .toMatchObject({ advancementId: "lang", extra: 1, count: 2 });
  });

  it("leaves a choice that already matches, or is larger", () => {
    expect(languageShortfall({ type: "feat", description: deft, traits: [trait(2)] })).toBeNull();
    expect(languageShortfall({ type: "feat", description: deft, traits: [trait(3)] })).toBeNull();
  });

  it("never lowers, and never adds a choice that isn't there", () => {
    expect(languageShortfall({ type: "feat", description: "<p>one other language of your choice</p>", traits: [trait(2)] })).toBeNull();
    expect(languageShortfall({ type: "feat", description: deft, traits: [] })).toBeNull();
    expect(languageShortfall({ type: "feat", description: deft, traits: [{ id: "g", choices: [] }] })).toBeNull();
  });

  it("only touches a pure language choice", () => {
    expect(languageShortfall({ type: "feat", description: deft, traits: [trait(1, ["skills:ath", "languages:*"])] })).toBeNull();
    expect(languageShortfall({ type: "feat", description: deft, traits: [trait(1, ["skills:ath"])] })).toBeNull();
  });

  it("does nothing when two language choices make the target ambiguous", () => {
    expect(languageShortfall({ type: "feat", description: deft, traits: [trait(1, any, "a"), trait(1, any, "b")] })).toBeNull();
  });

  it("leaves classes and subclasses alone, since their text repeats their features'", () => {
    expect(languageShortfall({ type: "class", description: deft, traits: [trait(1)] })).toBeNull();
    expect(languageShortfall({ type: "subclass", description: deft, traits: [trait(1)] })).toBeNull();
  });

  it("does not fire for the Thieves' Cant import, which grants more than its text", () => {
    expect(languageShortfall({ type: "feat", description: "<p>You know Thieves' Cant and one other language of your choice.</p>",
      traits: [trait(2, ["languages:exotic:cant"])] })).toBeNull();
  });
});
