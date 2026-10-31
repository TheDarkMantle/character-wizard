/**
 * Pure helpers for "choice slots": the places where an advancement needs a decision from the player.
 * The simulation (simulate.mjs) discovers slots from the system's own advancements; this file only
 * shapes, groups and counts them, so it can be unit tested without Foundry.
 */

/**
 * @typedef {object} SlotOption
 * @property {string} value      What gets stored in the selection (item UUID, trait key, size id).
 * @property {string} label
 * @property {string} [img]
 * @property {string} [uuid]     For item options: the item to describe.
 */

/**
 * @typedef {object} ChoiceSlot
 * @property {string} key        Stable across simulations; selections are stored under it.
 * @property {"class"|"species"|"background"} source  Which picker step it belongs to.
 * @property {string} itemName   Item whose advancement asks (a class, species, or a feat it granted).
 * @property {string} title      Advancement title, for example "Primal Order".
 * @property {"item"|"trait"|"size"|"optional-item"|"subclass"} kind
 * @property {number} count      Picks required.
 * @property {number} [max]      Upper bound when more than `count` picks are allowed (optional grants).
 * @property {SlotOption[]} options
 */

/**
 * Split the slots returned by a Trait advancement's `unfulfilledChoices()` into fixed grants and real choices.
 * A slot with exactly one possible key is a grant; slots with the same pool are one choice with a count.
 * @param {string[][]} available  One array of possible keys per slot.
 * @returns {{ grants: string[], groups: { options: string[], count: number }[] }}
 */
export function groupTraitSlots(available) {
  const grants = [];
  const groups = new Map();
  for ( const keys of available ) {
    if ( keys.length === 1 ) {
      if ( !grants.includes(keys[0]) ) grants.push(keys[0]);
      continue;
    }
    if ( !keys.length ) continue;
    const options = [...keys].sort();
    const signature = options.join("|");
    const group = groups.get(signature);
    if ( group ) group.count++;
    else groups.set(signature, { options, count: 1 });
  }
  return { grants, groups: [...groups.values()] };
}

/**
 * Feats matching an ItemChoice restriction. `restriction.type` is the feat type (`system.type.value`)
 * and `restriction.subtype` the feat subtype (`system.type.subtype`), as in dnd5e's `_validateItemType`.
 * @param {object[]} feats        Catalog feat entries ({ featType, featSubtype }).
 * @param {{type?: string, subtype?: string}} [restriction]
 */
export function featsMatching(feats, restriction = {}) {
  return feats.filter(f => (!restriction.type || (f.featType === restriction.type))
    && (!restriction.subtype || (f.featSubtype === restriction.subtype)));
}

/** Keep only selections that still point at an option of a current slot, and no more than the slot allows. */
export function pruneSelections(slots, selections = {}) {
  const pruned = {};
  for ( const slot of slots ) {
    const valid = new Set(slot.options.map(o => o.value));
    const kept = [...new Set(selections[slot.key] ?? [])].filter(v => valid.has(v)).slice(0, slot.max ?? slot.count);
    if ( kept.length ) pruned[slot.key] = kept;
  }
  return pruned;
}

/** Picks still needed across slots. Optional slots (max > count) never block. */
export function picksRemaining(slots, selections = {}) {
  return slots.reduce((n, slot) => n + Math.max(0, slot.count - (selections[slot.key]?.length ?? 0)), 0);
}

/** Toggle a value in a slot's selection. Single-pick slots swap; multi-pick slots stop at the limit. */
export function toggleSelection(slot, selections, value) {
  const current = selections[slot.key] ?? [];
  const limit = slot.max ?? slot.count;
  if ( current.includes(value) ) return current.filter(v => v !== value);
  if ( limit === 1 ) return [value];
  return current.length >= limit ? current : [...current, value];
}
