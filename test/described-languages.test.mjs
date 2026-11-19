import { describe, expect, it } from "vitest";
import { describedLanguages, LANGUAGE_ADVANCEMENT_ID, languageGrantAdvancement } from "../scripts/content/described-languages.mjs";

const languages = [
  { path: "standard:common", label: "Common" }, { path: "standard:common-sign", label: "Common Sign Language" },
  { path: "exotic:draconic", label: "Draconic" }, { path: "exotic:cant", label: "Thieves' Cant" },
  { path: "exotic:druidic", label: "Druidic" }
];
const dragon = "<p><strong>Dragon's Tongue.</strong> You know Draconic. If you already know Draconic when you select this feat, you instead learn one language of your choice.</p>";

describe("describedLanguages", () => {
  it("reads 'You know <language>'", () => {
    expect(describedLanguages(dragon, languages)).toEqual(["languages:exotic:draconic"]);
    expect(describedLanguages("<p>You also know Druidic.</p>", languages)).toEqual(["languages:exotic:druidic"]);
  });

  it("matches curly apostrophes and the longest name", () => {
    expect(describedLanguages("<p>You know Thieves’ Cant, the secret mix.</p>", languages)).toEqual(["languages:exotic:cant"]);
    expect(describedLanguages("<p>You know Common Sign Language.</p>", languages)).toEqual(["languages:standard:common-sign"]);
  });

  it("ignores text that doesn't name a language the character learns", () => {
    expect(describedLanguages("<p>If you already know Draconic you learn another.</p>", languages)).toEqual([]);
    expect(describedLanguages("<p>You know the ways of the forest.</p>", languages)).toEqual([]);
    expect(describedLanguages("", languages)).toEqual([]);
  });

  it("skips the importer's secret duplicate", () => {
    expect(describedLanguages(`<p>Nothing.</p><section class="secret">${dragon}</section>`, languages)).toEqual([]);
  });
});

describe("languageGrantAdvancement", () => {
  const input = { type: "feat", description: dragon, traits: [], languages };

  it("grants the language the text names", () => {
    expect(languageGrantAdvancement(input)).toMatchObject({
      _id: LANGUAGE_ADVANCEMENT_ID, type: "Trait", level: 0,
      configuration: { mode: "default", grants: ["languages:exotic:draconic"], choices: [] }
    });
    expect(LANGUAGE_ADVANCEMENT_ID).toHaveLength(16);
  });

  it("adds nothing when the data already grants or offers it", () => {
    expect(languageGrantAdvancement({ ...input, traits: [{ grants: ["languages:exotic:draconic"] }] })).toBeNull();
    expect(languageGrantAdvancement({ ...input, traits: [{ choices: [{ pool: ["languages:exotic:draconic"] }] }] })).toBeNull();
  });

  it("recognises an older alias for the same language", () => {
    expect(languageGrantAdvancement({ type: "feat", description: "<p>You know Druidic.</p>", languages,
      traits: [{ choices: [{ pool: ["languages:druidic"] }] }] })).toBeNull();
  });

  it("only applies to features", () => {
    expect(languageGrantAdvancement({ ...input, type: "race" })).toBeNull();
    expect(languageGrantAdvancement({ ...input, type: "background" })).toBeNull();
  });
});
