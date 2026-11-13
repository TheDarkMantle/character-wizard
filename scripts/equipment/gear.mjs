/**
 * Pure logic for the gear catalog: which compendium items count as ordinary equipment, which belong to a starting
 * equipment category ("any martial melee weapon"), and how copies of the same item in several compendiums collapse.
 */
import { matchesRules, slugify } from "../content/catalog-logic.mjs";

/** Item types that can appear in starting equipment. */
export const GEAR_TYPES = Object.freeze(["weapon", "equipment", "tool", "consumable", "loot", "container"]);

/**
 * @typedef {object} GearEntry
 * @property {string} uuid
 * @property {string} name
 * @property {string} img
 * @property {string} type         Item type.
 * @property {string} typeValue    `system.type.value` (martialM, light, game, ...).
 * @property {string} baseItem     `system.type.baseItem` (longsword, chainmail, ...), the same across compendiums.
 * @property {string} identifier
 * @property {string|null} rules   "2014", "2024" or null.
 * @property {string|null} container  Id of the container this item is stored in, within its compendium.
 * @property {number} quantity
 * @property {boolean} mundane     No rarity and not marked magical.
 * @property {string} pack
 * @property {string} packLabel
 */

/** No rarity and no "magical" property: an ordinary item rather than something found as treasure. */
export function isMundane(raw) {
  const rarities = raw?.system?.rarities;
  const hasRarity = Array.isArray(rarities) ? rarities.length > 0
    : (rarities instanceof Set ? rarities.size > 0 : !!rarities && Object.keys(rarities).length > 0);
  const properties = raw?.system?.properties;
  const magical = Array.isArray(properties) ? properties.includes("mgc")
    : (properties instanceof Set ? properties.has("mgc") : !!properties?.mgc);
  return !hasRarity && !magical;
}

/**
 * Is this a weapon item that isn't a real weapon? Monster modules store attacks, spells and traits as weapon items
 * ("Wind Blast", "Bell", "Big Meaty Feast"). Real weapons, including the SRD's and the imports' standard ones, name
 * the kind of weapon they are (`baseItem`: longsword, club); these don't.
 */
export function isMonsterAttack(raw) {
  return (raw?.type === "weapon") && !raw?.system?.type?.baseItem;
}

/**
 * Turn a raw compendium index entry into a gear entry.
 * @param {object} raw
 * @param {{ collection: string, label: string }} pack
 * @returns {GearEntry|null}  Null for anything that isn't gear.
 */
export function normalizeGear(raw, pack) {
  if ( !raw || !GEAR_TYPES.includes(raw.type) ) return null;
  const system = raw.system ?? {};
  const rules = system.source?.rules;
  return {
    uuid: raw.uuid ?? `Compendium.${pack.collection}.Item.${raw._id}`,
    name: raw.name,
    img: raw.img,
    type: raw.type,
    typeValue: system.type?.value ?? "",
    baseItem: system.type?.baseItem ?? "",
    identifier: system.identifier || slugify(raw.name),
    rules: (rules === "2014" || rules === "2024") ? rules : null,
    container: system.container || null,
    quantity: Number(system.quantity) || 1,
    // Monster attacks stored as weapons are not gear a character can start with.
    mundane: isMundane(raw) && !isMonsterAttack(raw),
    pack: pack.collection,
    packLabel: pack.label
  };
}

/** Weapon types a category key stands for: a specific type (martialM), or simple/martial in general. */
const WEAPON_GROUPS = Object.freeze({
  sim: ["simpleM", "simpleR"], mar: ["martialM", "martialR"],
  simple: ["simpleM", "simpleR"], martial: ["martialM", "martialR"]
});

/**
 * Does an item belong to a starting equipment category?
 * @param {GearEntry} entry
 * @param {"weapon"|"armor"|"tool"} category
 * @param {string} [key]  Category key. Blank means any item of that kind.
 */
export function inCategory(entry, category, key = "") {
  switch ( category ) {
    case "weapon":
      if ( entry.type !== "weapon" ) return false;
      if ( !key ) return /^(simple|martial)/.test(entry.typeValue);
      return (WEAPON_GROUPS[key] ?? [key]).includes(entry.typeValue);
    case "armor":
      if ( entry.type !== "equipment" ) return false;
      if ( !key ) return ["light", "medium", "heavy", "shield"].includes(entry.typeValue);
      return entry.typeValue === key;
    case "tool":
      return (entry.type === "tool") && (!key || (entry.typeValue === key));
    default: return false;
  }
}

/**
 * Sort key for copies of the same item: the world's rules first, then untagged, then the other edition; ties by the
 * GM's compendium order.
 */
function rankOf(entry, { rules, packOrder }) {
  const rulesRank = (entry.rules === rules) ? 0 : (entry.rules === null ? 1 : 2);
  const packRank = packOrder.indexOf(entry.pack);
  return rulesRank * 1000 + (packRank === -1 ? 999 : packRank);
}

/**
 * Ordinary gear a player can choose from for a category, one entry per base item.
 * @param {GearEntry[]} gear
 * @param {object} options
 * @param {"weapon"|"armor"|"tool"} options.category
 * @param {string} [options.key]
 * @param {"2014"|"2024"} options.rules
 * @param {string} [options.untagged]
 * @param {string[]} [options.packOrder]       Compendium ids, highest priority first.
 * @param {string[]} [options.anyRulesPacks]   Compendiums offered whatever their rules tag says.
 * @returns {GearEntry[]}  Sorted by name.
 */
export function pickCandidates(gear, { category, key = "", rules, untagged = "show", packOrder = [], anyRulesPacks = [] }) {
  const any = new Set(anyRulesPacks);
  const best = new Map();
  for ( const entry of gear ) {
    if ( !entry.mundane || !inCategory(entry, category, key) ) continue;
    if ( !any.has(entry.pack) && !matchesRules(entry, rules, untagged) ) continue;
    const id = `${entry.type}:${entry.baseItem || entry.identifier || slugify(entry.name)}`;
    const current = best.get(id);
    if ( !current || (rankOf(entry, { rules, packOrder }) < rankOf(current, { rules, packOrder })) ) best.set(id, entry);
  }
  return [...best.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Ordinary gear in the order to prefer it when matching a name from a pack's contents: the pack's own compendium
 * first, then the world's rules, then the GM's compendium order. Every copy is kept, since a name is matched against
 * all of them.
 * @returns {(GearEntry & { rank: number })[]}
 */
export function rankedGear(gear, { rules, packOrder = [], preferPack = null }) {
  return gear.filter(g => g.mundane).map(g => ({
    ...g, rank: ((g.pack === preferPack) ? 0 : 5000) + rankOf(g, { rules, packOrder })
  }));
}
