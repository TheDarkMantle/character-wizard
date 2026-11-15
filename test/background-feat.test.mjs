import { describe, expect, it } from "vitest";
import { describedFeatName, featUuidNamed, fillEmptyFeatGrants } from "../scripts/content/background-feat.mjs";

describe("describedFeatName", () => {
  it("reads the Feat line of an import", () => {
    const html = "<div class=\"ddb\"><h1>Background: Farmer</h1><p><strong>Ability Scores:</strong> Strength, Constitution, Wisdom<br><strong>Feat:</strong> Tough<br><strong>Skill Proficiencies:</strong> Animal Handling</p></div>";
    expect(describedFeatName(html)).toBe("Tough");
  });

  it("uses the label of a linked feat and keeps the parenthesis after it", () => {
    const html = "<p>Ability Scores: Intelligence<br>Feat: @UUID[Compendium.dnd5e.feats24.Item.phbftMagicInitia]{Magic Initiate} (Cleric)<br>Skill Proficiencies: Insight</p>";
    expect(describedFeatName(html)).toBe("Magic Initiate (Cleric)");
  });

  it("finds nothing without a Feat line", () => {
    expect(describedFeatName("<p>You have a feat for talking.</p>")).toBe("");
    expect(describedFeatName(undefined)).toBe("");
  });
});

describe("featUuidNamed", () => {
  const feats = [
    { name: "Tough", featSubtype: "", uuid: "a" },
    { name: "Tough", featSubtype: "origin", uuid: "b" },
    { name: "Musician", featSubtype: "origin", uuid: "c" }
  ];
  it("prefers an origin feat and ignores case", () => {
    expect(featUuidNamed(feats, "tough")).toBe("b");
    expect(featUuidNamed(feats, "Musician")).toBe("c");
  });
  it("is null for an unknown name", () => {
    expect(featUuidNamed(feats, "Lucky")).toBeNull();
    expect(featUuidNamed(feats, "")).toBeNull();
  });
});

describe("fillEmptyFeatGrants", () => {
  const make = () => ({
    a: { type: "ItemGrant", name: "Feat", configuration: { items: [] } },
    b: { type: "ItemGrant", name: "Equipment", configuration: { items: [] } },
    c: { type: "Trait", name: "Feat", configuration: {} }
  });
  it("fills only an empty item grant named for a feat", () => {
    const advancement = make();
    expect(fillEmptyFeatGrants(advancement, "uuid")).toBe(true);
    expect(advancement.a.configuration.items).toEqual([{ uuid: "uuid", optional: false, sort: 0 }]);
    expect(advancement.b.configuration.items).toEqual([]);
  });
  it("leaves a grant that already has a feat", () => {
    const advancement = { a: { type: "ItemGrant", name: "Feat", configuration: { items: [{ uuid: "x" }] } } };
    expect(fillEmptyFeatGrants(advancement, "uuid")).toBe(false);
    expect(advancement.a.configuration.items[0].uuid).toBe("x");
  });
});
