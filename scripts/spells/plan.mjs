/**
 * Pure helpers for the spells step: how many spells a class picks, and which spells to offer.
 * The Foundry side (`builder.mjs`) reads the numbers off the class and the actor and feeds them in here.
 */

/** Spells a Wizard writes into the spellbook at 1st level (the system doesn't store this). */
export const WIZARD_BOOK = 6;

/** Extra spellbook spells per Wizard level after the first. */
const WIZARD_BOOK_PER_LEVEL = 2;

/**
 * @typedef {object} SpellPlan
 * @property {"none"|"known"|"prepared"|"spellbook"} mode
 * @property {number} cantrips  Cantrips to pick.
 * @property {number} spells    Leveled spells to pick: spells known, spells prepared, or the spellbook.
 * @property {number} prepared  Spellbook casters only: how many of the spellbook to prepare.
 */

/**
 * Work out what a spellcasting class picks at creation.
 * - A class with a "spells known" figure (2014 Bard, Sorcerer, Warlock) picks that many.
 * - A Wizard fills a spellbook and then prepares some of it.
 * - Other prepared casters (Cleric, Druid, and every 2024 caster) pick the spells they have prepared.
 * @param {object} input
 * @param {string} input.identifier    Class identifier.
 * @param {number} [input.level=1]     Class level.
 * @param {number} [input.cantrips=0]  Cantrips known.
 * @param {number} [input.known=0]     Spells known (a scale value some classes have).
 * @param {number} [input.prepared=0]  Spells the class can prepare.
 * @param {number} [input.maxLevel=0]  Highest spell level the character has slots for.
 * @returns {SpellPlan}
 */
export function planSpells({ identifier, level = 1, cantrips = 0, known = 0, prepared = 0, maxLevel = 0 }) {
  const cantripCount = Math.max(0, Math.floor(cantrips));
  const empty = { mode: "none", cantrips: cantripCount, spells: 0, prepared: 0 };
  if ( maxLevel < 1 ) return empty;
  if ( identifier === "wizard" ) {
    const book = WIZARD_BOOK + (WIZARD_BOOK_PER_LEVEL * Math.max(0, level - 1));
    return { mode: "spellbook", cantrips: cantripCount, spells: book, prepared: Math.min(book, Math.max(0, Math.floor(prepared))) };
  }
  if ( known > 0 ) return { mode: "known", cantrips: cantripCount, spells: Math.floor(known), prepared: 0 };
  if ( prepared > 0 ) return { mode: "prepared", cantrips: cantripCount, spells: Math.floor(prepared), prepared: 0 };
  return empty;
}

/** The highest spell level with slots, from a map of slot maximums by level ({ 1: 2, 2: 0 }) and the pact slot level. */
export function highestSpellLevel(slotMaximums = {}, pactLevel = 0) {
  const levels = Object.entries(slotMaximums).filter(([, max]) => max > 0).map(([level]) => Number(level));
  return Math.max(0, pactLevel, ...levels);
}

/** Spells of one level range, sorted by level then name. */
export function spellsBetween(spells, min, max) {
  const level = s => Number(s.system?.level ?? 0);
  return spells.filter(s => (level(s) >= min) && (level(s) <= max))
    .sort((a, b) => (level(a) - level(b)) || String(a.name).localeCompare(String(b.name)));
}

/** Lowercase names of everything the character already has, for greying out repeats. */
export function heldNames(items = []) {
  return new Set(Array.from(items, i => String(i.name).toLowerCase()));
}

/**
 * Mark options the character already has (a cantrip from their species, a spell a feat gave) as disabled.
 * @param {{ label: string, disabled?: boolean }[]} options
 * @param {Set<string>} held  From `heldNames`.
 */
export function greyHeld(options, held) {
  return options.map(o => (held.has(String(o.label).toLowerCase()) ? { ...o, disabled: true } : o));
}

/**
 * Should a spell outside every spell list be offered? Spells in the world's Items folder are usually homebrew
 * and have no list, so they are offered to every caster. A spell on some other class' list is not.
 * @param {boolean} inWorld     Whether the spell is a world item.
 * @param {number} listCount    How many spell lists contain it.
 */
export function offerUnlisted(inWorld, listCount) {
  return inWorld && (listCount === 0);
}

/** A spell name as a lookup key: lowercase, curly apostrophes straightened, spaces collapsed. */
export function spellKey(name = "") {
  return String(name).toLowerCase().replace(/[’‘`]/g, "'").replace(/\s+/g, " ").trim();
}

/**
 * Spell names from a patron's "Expanded Spell List" description. Imports lay it out as a table of spell level and
 * spells ("1st | dissonant whispers, Tasha's hideous laughter"); the rows with a level in the first cell are read.
 * @param {string} html  The feature's (or subclass') description.
 * @returns {string[]}   Spell names as keys (see `spellKey`).
 */
export function expandedSpellNames(html) {
  // The system's own lists link each spell (@UUID[...]{Burning Hands}); only the link's label is the name.
  const plain = fragment => String(fragment).replace(/@UUID\[[^\]]*\](?:\{([^}]*)\})?/g, "$1")
    .replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
  const names = [];
  for ( const row of String(html ?? "").matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi) ) {
    const cells = Array.from(row[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi), m => plain(m[1]));
    if ( (cells.length < 2) || !/^\d+(st|nd|rd|th)?([- ]level)?$/i.test(cells[0]) ) continue;
    for ( const name of cells[1].split(",") ) if ( name.trim() ) names.push(spellKey(name));
  }
  return [...new Set(names)];
}

/** The spells whose names are in a list of keys, one per name. */
export function spellsNamed(spells, keys) {
  const wanted = new Set(keys);
  const found = new Map();
  for ( const spell of spells ) {
    const key = spellKey(spell.name);
    if ( wanted.has(key) && !found.has(key) ) found.set(key, spell);
  }
  return [...found.values()];
}
