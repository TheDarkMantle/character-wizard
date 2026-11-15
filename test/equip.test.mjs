import { describe, expect, it } from "vitest";
import { itemsToEquip } from "../scripts/equipment/equip.mjs";

const gear = (_id, type, value, extra = {}) => ({ _id, type, system: { type: { value }, ...extra } });

describe("itemsToEquip", () => {
  it("equips weapons, one body armor and one shield", () => {
    const items = [
      gear("a", "equipment", "heavy"), gear("b", "equipment", "light"), gear("c", "equipment", "shield"),
      gear("d", "weapon", "martialM"), gear("e", "weapon", "simpleR")
    ];
    expect([...itemsToEquip(items)].sort()).toEqual(["a", "c", "d", "e"]);
  });

  it("leaves ordinary gear, ammunition and clothing alone", () => {
    const items = [gear("a", "equipment", "clothing"), gear("b", "consumable", "ammo"), gear("c", "loot", ""), gear("d", "container", "")];
    expect(itemsToEquip(items).size).toBe(0);
  });

  it("skips attunement items and anything inside a pack", () => {
    const items = [
      gear("a", "equipment", "heavy", { attunement: "required" }),
      gear("b", "weapon", "simpleM", { container: "pack" }),
      gear("c", "weapon", "simpleM", { container: null })
    ];
    expect([...itemsToEquip(items)]).toEqual(["c"]);
  });

  it("leaves the shield off when the only melee weapon is two-handed", () => {
    const items = [
      gear("a", "equipment", "shield"), gear("b", "weapon", "martialM", { properties: ["hvy", "two"] }),
      gear("c", "equipment", "heavy")
    ];
    expect([...itemsToEquip(items)].sort()).toEqual(["b", "c"]);
  });

  it("leaves the shield off with only a bow", () => {
    const items = [gear("a", "equipment", "shield"), gear("b", "weapon", "simpleR", { properties: ["amm", "two"] })];
    expect([...itemsToEquip(items)]).toEqual(["b"]);
  });

  it("keeps the shield when a one-handed melee weapon is there beside a bow or a two-handed weapon", () => {
    const sickle = gear("s", "weapon", "simpleM", { properties: ["lgt"] });
    const bow = gear("b", "weapon", "simpleR", { properties: ["amm", "two"] });
    const greatsword = gear("g", "weapon", "martialM", { properties: ["hvy", "two"] });
    const shield = gear("h", "equipment", "shield");
    expect([...itemsToEquip([shield, bow, sickle])].sort()).toEqual(["b", "h", "s"]);
    expect([...itemsToEquip([shield, greatsword, sickle])].sort()).toEqual(["g", "h", "s"]);
  });

  it("equips a shield held with no weapons at all", () => {
    expect([...itemsToEquip([gear("a", "equipment", "shield")])]).toEqual(["a"]);
  });

  it("keeps the shield with versatile and one-handed weapons", () => {
    const items = [gear("a", "equipment", "shield"), gear("b", "weapon", "martialM", { properties: ["ver"] })];
    expect([...itemsToEquip(items)].sort()).toEqual(["a", "b"]);
  });
});
