import { describe, expect, it } from "vitest";
import {
  greyHeld, heldNames, highestSpellLevel, offerUnlisted, planSpells, spellsBetween
} from "../scripts/spells/plan.mjs";

describe("planSpells", () => {
  it("gives a known caster its known spells", () => {
    expect(planSpells({ identifier: "bard", cantrips: 2, known: 4, maxLevel: 1 }))
      .toEqual({ mode: "known", cantrips: 2, spells: 4, prepared: 0 });
  });

  it("gives a prepared caster its prepared spells", () => {
    expect(planSpells({ identifier: "cleric", cantrips: 3, prepared: 4, maxLevel: 1 }))
      .toEqual({ mode: "prepared", cantrips: 3, spells: 4, prepared: 0 });
  });

  it("fills a wizard's spellbook and prepares from it", () => {
    expect(planSpells({ identifier: "wizard", cantrips: 3, prepared: 4, maxLevel: 1 }))
      .toEqual({ mode: "spellbook", cantrips: 3, spells: 6, prepared: 4 });
    expect(planSpells({ identifier: "wizard", level: 3, cantrips: 3, prepared: 5, maxLevel: 2 }).spells).toBe(10);
  });

  it("never prepares more than the spellbook holds", () => {
    expect(planSpells({ identifier: "wizard", prepared: 9, maxLevel: 1 }).prepared).toBe(6);
  });

  it("leaves leveled spells out until there are slots for them", () => {
    expect(planSpells({ identifier: "ranger", cantrips: 0, prepared: 2, maxLevel: 0 }))
      .toEqual({ mode: "none", cantrips: 0, spells: 0, prepared: 0 });
    expect(planSpells({ identifier: "wizard", cantrips: 3, maxLevel: 0 }).spells).toBe(0);
  });

  it("is empty for a class with nothing to pick", () => {
    expect(planSpells({ identifier: "fighter" })).toEqual({ mode: "none", cantrips: 0, spells: 0, prepared: 0 });
  });
});

describe("highestSpellLevel", () => {
  it("finds the top level that has slots", () => {
    expect(highestSpellLevel({ 1: 2, 2: 0 })).toBe(1);
    expect(highestSpellLevel({ 1: 4, 2: 3, 3: 2 })).toBe(3);
  });
  it("counts a warlock's pact slots", () => {
    expect(highestSpellLevel({}, 1)).toBe(1);
  });
  it("is zero with no slots", () => {
    expect(highestSpellLevel({ 1: 0 })).toBe(0);
  });
});

describe("spellsBetween", () => {
  const spells = [
    { name: "Shield", system: { level: 1 } },
    { name: "Light", system: { level: 0 } },
    { name: "Fireball", system: { level: 3 } },
    { name: "Burning Hands", system: { level: 1 } }
  ];
  it("keeps a level range, sorted by level then name", () => {
    expect(spellsBetween(spells, 1, 2).map(s => s.name)).toEqual(["Burning Hands", "Shield"]);
    expect(spellsBetween(spells, 0, 0).map(s => s.name)).toEqual(["Light"]);
  });
});

describe("held spells", () => {
  it("greys out a spell the character already has, ignoring case", () => {
    const held = heldNames([{ name: "Prestidigitation" }]);
    const options = [{ label: "prestidigitation" }, { label: "Light" }];
    expect(greyHeld(options, held)).toEqual([{ label: "prestidigitation", disabled: true }, { label: "Light" }]);
  });
});

describe("offerUnlisted", () => {
  it("offers world spells that no list contains", () => {
    expect(offerUnlisted(true, 0)).toBe(true);
    expect(offerUnlisted(true, 2)).toBe(false);
    expect(offerUnlisted(false, 0)).toBe(false);
  });
});
