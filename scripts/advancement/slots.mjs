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
 * @property {boolean} [disabled]  Shown but not choosable, for example a skill the character already has.
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
 * @property {SlotOption[]} options  Options with `disabled: true` are shown greyed out and can't be chosen.
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
 * Work out the choices a default-mode Trait advancement gives the player.
 *
 * A fixed proficiency the character doesn't have yet is simply granted. If they already have it (from the class, say)
 * it becomes a replacement: pick any other of that kind. A choice offers its own pool with the proficiencies already
 * held greyed out, and if the whole pool is held it also becomes "pick any other". Whatever is left with no real
 * decision (as many options as picks) is granted without asking.
 *
 * @param {object} input
 * @param {{ type: "grant"|"choice", idx?: number, full: string[] }[]} input.slots  One per unfulfilled pick: the keys
 *   it may offer (a grant offers itself), before anything the character holds is removed.
 * @param {(type: string) => string[]} input.anyKeys  Every key of a trait type, for replacements.
 * @param {Set<string>} [input.held]     Keys the character already has.
 * @param {Set<string>} [input.blocked]  Keys the GM hid from choices (never removes a fixed grant).
 * @returns {{ grants: string[], groups: { id: string, count: number, options: { value: string, disabled: boolean }[] }[] }}
 */
export function traitGroups({ slots, anyKeys, held = new Set(), blocked = new Set() }) {
  const grants = new Set();
  const buckets = new Map();
  for ( const slot of slots ) {
    let replacement = false;
    if ( slot.type === "grant" ) {
      if ( !held.has(slot.full[0]) ) { grants.add(slot.full[0]); continue; }
      replacement = true;
    } else if ( slot.full.every(k => held.has(k)) ) replacement = true;

    const type = String(slot.full[0] ?? "").split(":")[0];
    const pool = replacement ? anyKeys(type) : slot.full;
    const id = replacement ? `r:${type}` : `c${slot.idx}`;
    const bucket = buckets.get(`${id}|${[...pool].sort().join("|")}`) ?? { id, pool, count: 0 };
    bucket.count++;
    buckets.set(`${id}|${[...pool].sort().join("|")}`, bucket);
  }

  const groups = [];
  for ( const { id, pool, count } of buckets.values() ) {
    const options = pool.filter(k => !blocked.has(k)).map(value => ({ value, disabled: held.has(value) }));
    const free = options.filter(o => !o.disabled);
    const picks = Math.min(count, free.length);
    if ( !picks ) continue;
    // As many options as picks: nothing to decide.
    if ( free.length <= picks ) { free.forEach(o => grants.add(o.value)); continue; }
    groups.push({ id, count: picks, options });
  }
  // Something granted outright can't also be picked.
  for ( const group of groups ) for ( const o of group.options ) if ( grants.has(o.value) ) o.disabled = true;
  return { grants: [...grants], groups };
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
 * @param {{level: number, held: Set<string>}} [character]  When given, feats whose prerequisites aren't met are left out.
 */
export function featsMatching(feats, restriction = {}, character = null) {
  return feats.filter(f => (!restriction.type || (f.featType === restriction.type))
    && (!restriction.subtype || (f.featSubtype === restriction.subtype))
    && (!character || meetsPrerequisites(f, character)));
}

/**
 * Does the character meet a feat's prerequisites? Eldritch Invocations are the case that matters at 1st level: most
 * need a higher level or a Pact Boon, and none of those should be offered yet.
 * @param {{ prerequisites?: { level?: number, items?: string[] } }} feat  Catalog feat entry.
 * @param {{ level: number, held: Set<string> }} character  The character's level and the identifiers of what they have
 *   (both "pact-of-the-blade" and "feat:pact-of-the-blade" forms).
 * @returns {boolean}
 */
export function meetsPrerequisites(feat, { level, held }) {
  const { level: needed = 0, items = [] } = feat.prerequisites ?? {};
  if ( needed > level ) return false;
  // The listed items are alternatives: having any one is enough.
  return !items.length || items.some(i => held.has(i));
}

/** Keep only selections that still point at an option of a current slot, and no more than the slot allows. */
export function pruneSelections(slots, selections = {}) {
  const pruned = {};
  for ( const slot of slots ) {
    const valid = new Set(slot.options.filter(o => !o.disabled).map(o => o.value));
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
 * @param {boolean} [state.abilitiesReady=true]  Whether the ability scores are set.
 * @param {boolean} [state.equipmentReady=true]  Whether the starting equipment choices are made.
 * @returns {"NoPermission"|"NeedClass"|"NeedChoices"|"NeedAbilities"|"NeedEquipment"|null}
 */
export function createBlocker({ picks, slots, selections, canCreate, abilitiesReady = true, equipmentReady = true }) {
  if ( !canCreate ) return "NoPermission";
  if ( !picks.class ) return "NeedClass";
  if ( picksRemaining(slots, selections) > 0 ) return "NeedChoices";
  if ( !abilitiesReady ) return "NeedAbilities";
  if ( !equipmentReady ) return "NeedEquipment";
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
