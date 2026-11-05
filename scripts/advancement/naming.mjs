/**
 * Pure helpers for naming things on the features board.
 *
 * dnd5e 6.0 renamed an advancement's `title` to `name` and fills in the type's default name when the stored
 * one is empty, so the stored name is the only reliable signal. Where there is none, these helpers pick a
 * descriptive fallback (as a lang key) from what the advancement actually does.
 */

/**
 * Drop a redundant "Title: " from an option's name. Every fighting style is called "Fighting Style: Archery" and so on,
 * which reads badly in a list already headed "Fighting Style".
 * @param {string} label  The option's name.
 * @param {string} title  The choice's title.
 */
export function stripTitlePrefix(label, title) {
  const clean = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const match = String(label).match(/^([^:]+):\s*(.+)$/);
  return (match && clean(match[1]) === clean(title)) ? match[2].trim() : label;
}

/** The advancement's own name from raw source data. Accepts the pre-6.0 `title` too. */
export function advancementName(adv) {
  return String(adv?.name || adv?.title || "").trim();
}

const TRAIT_CATEGORIES = new Set(["saves", "skills", "armor", "weapon", "tool", "languages", "dr", "di", "dv", "ci"]);

/**
 * Lang key for a Trait advancement part, from the keys it grants or offers.
 * @param {string[]} keys   Trait keys, e.g. ["saves:str", "saves:con"].
 * @param {string} [mode]   Trait mode (default, expertise, mastery, ...).
 */
export function traitTitleKey(keys = [], mode = "default") {
  if ( mode === "expertise" ) return "CHARWIZ.Naming.Expertise";
  if ( mode === "mastery" ) return "CHARWIZ.Naming.WeaponMastery";
  const categories = new Set(Array.from(keys, k => String(k).split(":")[0]));
  if ( categories.size === 1 ) {
    const [category] = categories;
    if ( TRAIT_CATEGORIES.has(category) ) return `CHARWIZ.Naming.Trait.${category}`;
  }
  return "CHARWIZ.Naming.Trait.mixed";
}

/** Lang key for an unnamed ItemGrant, by the kind of item that owns it. */
const GRANT_KEYS = Object.freeze({
  class: "CHARWIZ.Naming.ClassFeatures", subclass: "CHARWIZ.Naming.ClassFeatures",
  race: "CHARWIZ.Naming.SpeciesTraits", background: "CHARWIZ.Naming.BackgroundFeatures"
});

/** Lang keys for other unnamed advancement types. */
const TYPE_KEYS = Object.freeze({
  Size: "CHARWIZ.Naming.Size",
  HitPoints: "CHARWIZ.Naming.HitPoints",
  AbilityScoreImprovement: "CHARWIZ.Naming.AbilityScoreImprovement",
  Subclass: "CHARWIZ.Naming.Subclass",
  ScaleValue: "CHARWIZ.Naming.ScaleValue",
  ItemChoice: "CHARWIZ.Naming.Choice"
});

/**
 * Fallback lang key for an advancement with no name of its own. Null for Trait, which is named per part
 * with `traitTitleKey`, and for types nothing is known about.
 */
export function fallbackTitleKey(adv, { itemType } = {}) {
  if ( adv.type === "ItemGrant" ) return GRANT_KEYS[itemType] ?? "CHARWIZ.Naming.Features";
  if ( (adv.type === "AbilityScoreImprovement") && (itemType === "race") ) return "CHARWIZ.Naming.AbilityScoreIncrease";
  return TYPE_KEYS[adv.type] ?? null;
}

/**
 * 2024 Dragonborn models Draconic Ancestry as a plain damage resistance choice, so the dragon colours the
 * player is picking between don't appear in the data. This is the Draconic Ancestors table from the species.
 */
const DRAGON_COLOURS = Object.freeze({
  "dr:acid": ["Black", "Copper"],
  "dr:cold": ["Silver", "White"],
  "dr:fire": ["Brass", "Gold", "Red"],
  "dr:lightning": ["Blue", "Bronze"],
  "dr:poison": ["Green"]
});

/** Is this the species whose damage resistance choice is really a dragon ancestry? */
export function isDraconicAncestry(hostIdentifier, keys = []) {
  return (hostIdentifier === "dragonborn") && Array.from(keys).length > 0
    && Array.from(keys).every(k => k in DRAGON_COLOURS);
}

/**
 * Option label, adding the dragon colours for a Dragonborn ancestry choice.
 * @param {string} key              Trait key, e.g. "dr:fire".
 * @param {string} label            The system's label for the key, e.g. "Fire".
 * @param {string} [hostIdentifier] Identifier of the item that asks, e.g. "dragonborn".
 */
export function traitOptionLabel(key, label, hostIdentifier) {
  const colours = (hostIdentifier === "dragonborn") ? DRAGON_COLOURS[key] : null;
  return colours ? `${label} (${colours.join(", ")})` : label;
}
