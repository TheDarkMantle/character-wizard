import { describe, expect, it } from "vitest";
import {
  advancementName, fallbackTitleKey, isDraconicAncestry, traitOptionLabel, traitTitleKey
} from "../scripts/advancement/naming.mjs";

describe("advancementName", () => {
  it("prefers name, accepts the old title, trims", () => {
    expect(advancementName({ name: " Primal Order ", title: "x" })).toBe("Primal Order");
    expect(advancementName({ title: "Old" })).toBe("Old");
    expect(advancementName({ name: "" })).toBe("");
  });
});

describe("traitTitleKey", () => {
  it("names by category and mode", () => {
    expect(traitTitleKey(["skills:acr", "skills:ath"])).toBe("CHARWIZ.Naming.Trait.skills");
    expect(traitTitleKey(["weapon:sim", "weapon:mar"])).toBe("CHARWIZ.Naming.Trait.weapon");
    expect(traitTitleKey(["skills:acr"], "expertise")).toBe("CHARWIZ.Naming.Expertise");
    expect(traitTitleKey(["weapon:sim:*"], "mastery")).toBe("CHARWIZ.Naming.WeaponMastery");
    expect(traitTitleKey(["skills:acr", "tool:art:smith"])).toBe("CHARWIZ.Naming.Trait.mixed");
  });
});

describe("fallbackTitleKey", () => {
  it("names grants by owner type", () => {
    expect(fallbackTitleKey({ type: "ItemGrant" }, { itemType: "class" })).toBe("CHARWIZ.Naming.ClassFeatures");
    expect(fallbackTitleKey({ type: "ItemGrant" }, { itemType: "race" })).toBe("CHARWIZ.Naming.SpeciesTraits");
    expect(fallbackTitleKey({ type: "ItemGrant" }, { itemType: "feat" })).toBe("CHARWIZ.Naming.Features");
    expect(fallbackTitleKey({ type: "Weird" })).toBeNull();
  });
});

describe("dragon ancestry", () => {
  it("adds colours only for Dragonborn", () => {
    expect(traitOptionLabel("dr:fire", "Fire", "dragonborn")).toBe("Fire (Brass, Gold, Red)");
    expect(traitOptionLabel("dr:fire", "Fire", "tiefling")).toBe("Fire");
    expect(isDraconicAncestry("dragonborn", ["dr:acid", "dr:cold"])).toBe(true);
    expect(isDraconicAncestry("dragonborn", ["skills:acr"])).toBe(false);
    expect(isDraconicAncestry("elf", ["dr:acid"])).toBe(false);
  });
});
