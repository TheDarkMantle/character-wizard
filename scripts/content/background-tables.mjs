/**
 * Pure helpers for the personality steps: the roll tables a background points at (personality traits, ideals, bonds,
 * flaws), turned into plain lists the wizard can show and roll on.
 *
 * Backgrounds don't hold these tables themselves. The system's backgrounds, and the D&D Beyond imports, link
 * them from their description as `@UUID[...RollTable...]{label}`.
 */

/** The four things a background offers a table for, in the order the sheet shows them. */
export const BIO_KINDS = Object.freeze(["trait", "ideal", "bond", "flaw"]);

/** How many entries each kind may take: a character has two personality traits and one of the rest. */
export const BIO_MAX = Object.freeze({ trait: 2, ideal: 1, bond: 1, flaw: 1 });

/** Dice a table can reasonably be rolled with. */
const DICE = new Set([2, 3, 4, 6, 8, 10, 12, 20, 100]);

/** Roll table links in a description: [{ uuid, label }]. */
export function tableLinks(html = "") {
  const links = [];
  for ( const match of String(html).matchAll(/@UUID\[([^\]]*RollTable[^\]]*)\](?:\{([^}]*)\})?/g) ) {
    links.push({ uuid: match[1], label: (match[2] ?? "").trim() });
  }
  return links;
}

/** Which kind of table a name describes ("Background: Sage: Personality Trait" → "trait"), or null. */
export function classifyTable(name = "") {
  const text = String(name).toLowerCase();
  if ( /personality|\btraits?\b/.test(text) ) return "trait";
  if ( /\bideals?\b/.test(text) ) return "ideal";
  if ( /\bbonds?\b/.test(text) ) return "bond";
  if ( /\bflaws?\b/.test(text) ) return "flaw";
  return null;
}

const plain = html => String(html ?? "").replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();

/**
 * Entries of a table, in order.
 * @param {{ range: number[], description?: string, name?: string }[]} results  A roll table's results.
 * @returns {{ index: number, low: number, high: number, label: string, text: string }[]}
 */
export function tableEntries(results = []) {
  return Array.from(results, r => ({ low: r.range?.[0] ?? 0, high: r.range?.[1] ?? r.range?.[0] ?? 0, text: plain(r.description) || plain(r.name) }))
    .filter(e => e.text)
    .sort((a, b) => a.low - b.low)
    .map((e, index) => ({ ...e, index, label: (e.low === e.high) ? `${e.low}` : `${e.low}–${e.high}` }));
}

/**
 * The formula to roll for a table, or null when it isn't an ordinary die (so no roll button is offered).
 * Uses the table's own formula when it is one die, otherwise the die that matches its highest number.
 */
export function rollFormula(formula, entries) {
  const top = Math.max(0, ...entries.map(e => e.high));
  const own = String(formula ?? "").replace(/\s+/g, "").match(/^1d(\d+)$/i);
  const size = own ? Number(own[1]) : top;
  return (DICE.has(size) && (size === top)) ? `1d${size}` : null;
}

/** The entry a roll lands on, or undefined. */
export function entryForRoll(entries, total) {
  return entries.find(e => (total >= e.low) && (total <= e.high));
}

/**
 * The text for a sheet field: the table entries picked, then whatever the player wrote themselves.
 * @param {string[]} picked  Texts of the chosen entries.
 * @param {string} [other]   Free-form text.
 */
export function composeValue(picked = [], other = "") {
  return [...picked, String(other ?? "").trim()].filter(Boolean).join("\n");
}

/**
 * Toggle an entry in a field's picks. A field with room for one swaps; a full field with room for more replaces its
 * last pick, so rolling again always does something.
 * @param {number[]} picks
 * @param {number} index
 * @param {number} max
 */
export function togglePick(picks = [], index, max = 1) {
  if ( picks.includes(index) ) return picks.filter(i => i !== index);
  if ( max === 1 ) return [index];
  return (picks.length >= max) ? [...picks.slice(0, max - 1), index] : [...picks, index];
}
