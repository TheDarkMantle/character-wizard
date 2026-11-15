/**
 * Pure helpers for a 2024 background's origin feat when its data doesn't name one. Imports from D&D Beyond carry an
 * empty "Feat" item grant, but their description says which feat it is ("Feat: Tough").
 */

/** A feat name as a lookup key: lowercase, curly apostrophes straightened, spaces collapsed. */
function nameKey(name = "") {
  return String(name).toLowerCase().replace(/[’‘`]/g, "'").replace(/\s+/g, " ").trim();
}

/**
 * The feat a background's description names on its "Feat:" line.
 * @param {string} html  The background's description.
 * @returns {string}  The name ("Magic Initiate (Cleric)"), or "" when there is no such line.
 */
export function describedFeatName(html) {
  const text = String(html ?? "")
    .replace(/@UUID\[[^\]]*\](?:\{([^}]*)\})?/g, "$1")
    .replace(/<br\s*\/?>|<\/(p|li|div|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&nbsp;/g, " ");
  const line = text.match(/^[ \t]*Feat:[ \t]*(.+?)[ \t]*$/im);
  return line ? line[1].replace(/[.;]+$/, "").trim() : "";
}

/**
 * The catalog feat with a name, preferring an origin feat.
 * @param {{ name: string, featSubtype?: string, uuid: string }[]} feats  Catalog feat entries.
 * @param {string} name
 * @returns {string|null}  Its UUID.
 */
export function featUuidNamed(feats, name) {
  const key = nameKey(name);
  if ( !key ) return null;
  const same = feats.filter(f => nameKey(f.name) === key);
  return (same.find(f => f.featSubtype === "origin") ?? same[0])?.uuid ?? null;
}

/**
 * Put a feat into the item grants of an item's advancements that are named for a feat but grant nothing.
 * @param {object|object[]} advancements  `system.advancement` source data (an object keyed by id, or an array). Edited in place.
 * @param {string} uuid  The feat to grant.
 * @returns {boolean}  Whether any grant was filled.
 */
export function fillEmptyFeatGrants(advancements, uuid) {
  let filled = false;
  for ( const advancement of Object.values(advancements ?? {}) ) {
    if ( (advancement?.type !== "ItemGrant") || !/feat/i.test(advancement.name ?? "") ) continue;
    const config = advancement.configuration ??= {};
    if ( config.items?.length ) continue;
    config.items = [{ uuid, optional: false, sort: 0 }];
    filled = true;
  }
  return filled;
}
