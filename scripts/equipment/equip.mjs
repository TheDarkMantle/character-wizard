/**
 * Which of the starting items a new character should have equipped. On the sheet, armor class only counts armor and
 * shields that are equipped, and the actions list only shows equipped weapons, so a character built with unequipped
 * gear starts with the wrong AC and no attacks.
 */

const BODY_ARMOR = new Set(["light", "medium", "heavy"]);

/**
 * @param {{ _id: string, type: string, system?: { type?: { value?: string }, container?: string|null, attunement?: string } }[]} items
 *   Item data being added to the actor.
 * @returns {Set<string>}  Ids of the items to equip: every weapon, one suit of body armor and one shield.
 *   Items that need attunement and anything stored inside a container are left alone. The shield is equipped when the
 *   character has a one-handed or versatile melee weapon to hold in the other hand (the sickle beside a bow, the
 *   quarterstaff). With only two-handed or ranged weapons it stays off, since a hand can't hold both.
 */
export function itemsToEquip(items) {
  const equip = new Set();
  let armor = false;
  let shield = false;
  let shieldId = null;
  let weapons = 0;
  let oneHandedMelee = false;
  for ( const item of items ) {
    if ( item.system?.container || item.system?.attunement === "required" ) continue;
    if ( item.type === "weapon" ) {
      equip.add(item._id);
      weapons++;
      const melee = String(item.system?.type?.value ?? "").endsWith("M");
      if ( melee && !Array.from(item.system?.properties ?? []).includes("two") ) oneHandedMelee = true;
    }
    else if ( item.type === "equipment" ) {
      const kind = item.system?.type?.value;
      if ( BODY_ARMOR.has(kind) && !armor ) { armor = true; equip.add(item._id); }
      else if ( (kind === "shield") && !shield ) { shield = true; shieldId = item._id; equip.add(item._id); }
    }
  }
  if ( shieldId && weapons && !oneHandedMelee ) equip.delete(shieldId);
  return equip;
}
