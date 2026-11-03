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
 * @property {"item"|"trait"|"size"|"optional-item"|"subclass"|"ability"|"asi"} kind
 * @property {number} count      Picks required.
 * @property {number} [max]      Upper bound when more than `count` picks are allowed (optional grants).
 * @property {string[]} [defaultSelection]  Selection a slot starts with (the standard racial increases, one entry per point).
 * @property {number} [cap]      For "asi" slots: most points one ability can take. Selections repeat an ability once per point.
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
 * Drop blocked options from a trait choice. The count shrinks if fewer options remain than picks were allowed,
 * so a heavily trimmed list can't leave a choice nobody can finish.
 * @param {{ options: string[], count: number }} group
 * @param {Set<string>} blocked  Trait keys the GM has hidden.
 */
export function withoutBlocked(group, blocked) {
  if ( !blocked?.size ) return group;
  const options = group.options.filter(o => !blocked.has(o));
  return { options, count: Math.min(group.count, options.length) };
}

/**
 * Spell index entries matching an ItemChoice restriction. `level` is a spell level as a string ("0" for cantrips,
 * "" for any); the system's relative values ("available") can't be resolved here and match nothing.
 * @param {object[]} spells  Index entries with `system.level` and `system.school`.
 * @param {{ level?: string, school?: Iterable<string> }} [restriction]
 */
export function spellsMatching(spells, { level = "", school = [] } = {}) {
  const schools = new Set(school);
  const wanted = (level === "") ? null : Number(level);
  if ( (wanted !== null) && Number.isNaN(wanted) ) return [];
  return spells.filter(s => ((wanted === null) || (Number(s.system?.level) === wanted))
    && (!schools.size || schools.has(s.system?.school)));
}

/** First entry per name (case-insensitive), so a spell in several compendiums is offered once. */
export function uniqueByName(entries) {
  const seen = new Set();
  return entries.filter(e => {
    const key = String(e.name).toLowerCase();
    if ( seen.has(key) ) return false;
    seen.add(key);
    return true;
  });
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
    if ( slot.kind === "asi" ) {
      const kept = [];
      for ( const v of selections[slot.key] ?? [] ) {
        if ( valid.has(v) && (kept.length < slot.count) && (tally(kept)[v] ?? 0) < slot.cap ) kept.push(v);
      }
      if ( kept.length ) pruned[slot.key] = kept;
      continue;
    }
    const kept = [...new Set(selections[slot.key] ?? [])].filter(v => valid.has(v)).slice(0, slot.max ?? slot.count);
    if ( kept.length ) pruned[slot.key] = kept;
  }
  return pruned;
}

/** Count of each value in a list: ["int", "int", "wis"] → { int: 2, wis: 1 }. */
export function tally(values = []) {
  const counts = {};
  for ( const v of values ) counts[v] = (counts[v] ?? 0) + 1;
  return counts;
}

/**
 * Add or remove one point on an ability in an "asi" slot, respecting the point total and the per-ability cap.
 * @returns {string[]}  The new selection.
 */
export function adjustPoints(slot, selections, ability, delta) {
  const current = selections[slot.key] ?? [];
  if ( delta < 0 ) {
    const index = current.lastIndexOf(ability);
    return index === -1 ? current : current.filter((_, i) => i !== index);
  }
  if ( (current.length >= slot.count) || ((tally(current)[ability] ?? 0) >= slot.cap) ) return current;
  return [...current, ability];
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

/**
 * Why the character can't be created yet, as a lang key suffix, or null when it can.
 * @param {object} state
 * @param {object} state.picks       Picks by step.
 * @param {ChoiceSlot[]} state.slots
 * @param {Record<string, string[]>} state.selections
 * @param {boolean} state.canCreate  Whether this user may create an actor (or has one to build onto).
 * @returns {"NoPermission"|"NeedClass"|"NeedChoices"|null}
 */
export function createBlocker({ picks, slots, selections, canCreate }) {
  if ( !canCreate ) return "NoPermission";
  if ( !picks.class ) return "NeedClass";
  if ( picksRemaining(slots, selections) > 0 ) return "NeedChoices";
  return null;
}

/**
 * The points to spend when a species' fixed ability score increases are customized (Tasha's): the increases added
 * together, with no more on one ability than the largest single increase. High Elf's +2 and +1 are 3 points, 2 per
 * ability. A spendable point (Half-Elf's two +1s) adds to the total.
 * @param {{ fixed?: Record<string, number>, points?: number }} config  ASI advancement configuration.
 * @returns {{ total: number, cap: number, defaults: string[] }}  `defaults` is the standard increases as a selection,
 *   one entry per point ("dex", "dex", "int"); spendable points have no standard answer.
 */
export function standardPoints({ fixed = {}, points = 0 } = {}) {
  const entries = Object.entries(fixed).filter(([, v]) => v > 0);
  const defaults = entries.flatMap(([ability, value]) => Array(value).fill(ability));
  return {
    total: defaults.length + Math.max(0, points),
    cap: Math.max(1, ...entries.map(([, v]) => v)),
    defaults
  };
}
