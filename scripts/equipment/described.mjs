/**
 * Equipment a background only describes in its text.
 *
 * Imported 2014 backgrounds list some of their gear as linked items and leave the rest as prose: "a letter from a dead
 * colleague posing a question you have not yet been able to answer", "a scroll of pedigree". This reads the
 * "Equipment:" line of the description and returns what no linked item already covers, so those things still end up on
 * the sheet, as plain loot. It is deliberately cautious: when in doubt (a word in common with an item the character
 * already has) it adds nothing rather than a duplicate.
 */

const STOPWORDS = new Set(["a", "an", "the", "of", "and", "or", "set", "with", "from", "your", "some", "one", "two",
  "that", "which", "posing", "in", "for", "to", "kit", "pair"]);

/** Words that matter when comparing two item names. */
function tokens(text) {
  return String(text).toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/)
    .map(t => t.replace(/s$/, "")).filter(t => t.length > 2 && !STOPWORDS.has(t));
}

/** The text after "Equipment:" up to the end of its line or paragraph. */
function equipmentLine(html) {
  const text = String(html ?? "").replace(/<\/(p|dt|dd|li|div|h\d|br)>|<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ").replace(/[ \t\r]+/g, " ").replace(/ ?\n ?/g, "\n");
  const match = text.match(/equipment:\s*([^\n]+)/i);
  return match ? match[1].trim() : "";
}

/** Split on commas and "and", but not inside brackets: "a favor (a letter, a lock of hair, or a trinket)" is one thing. */
function splitPhrases(line) {
  const parts = [];
  let depth = 0;
  let current = "";
  for ( const ch of line ) {
    if ( ch === "(" ) depth++;
    if ( ch === ")" ) depth = Math.max(0, depth - 1);
    if ( (ch === ",") && !depth ) { parts.push(current); current = ""; } else current += ch;
  }
  parts.push(current);
  return parts.map(p => p.replace(/^\s*and\s+/i, "").trim()).filter(Boolean);
}

/** A pick left to the player ("one of your choice"): the equipment step already offers those. */
const isChoice = phrase => /\b(of )?your choice\b/i.test(phrase);

/** Do two words name the same thing? "staff" and "quarterstaff" do. */
const related = (a, b) => (a === b) || ((a.length > 3) && (b.length > 3) && (a.includes(b) || b.includes(a)));

/** "a pouch containing 10 gp" and the like: money, which the gold entry already covers. */
const isMoney = phrase => /\b\d+\s*(gp|sp|cp|pp|ep)\b/i.test(phrase) || /\b(pouch|purse)\b/i.test(phrase);

/** The item as written, without its article: "scroll case stuffed full of notes from your studies or prayers". */
function nameOf(phrase) {
  const bare = phrase.replace(/^(an?|the|one|some|two|three)\s+/i, "").replace(/\s+/g, " ").trim();
  return bare.charAt(0).toUpperCase() + bare.slice(1);
}

/**
 * @param {string} html            The background's description.
 * @param {Iterable<string>} have  Names of the items the character already gets from this background.
 * @returns {{ name: string, description: string }[]}
 */
export function describedItems(html, have = []) {
  const line = equipmentLine(html);
  if ( !line ) return [];
  // "Choose A or B" style text belongs to 2024 backgrounds, whose gear is structured data.
  if ( /choose\s+a\b/i.test(line) ) return [];
  const owned = Array.from(have, name => tokens(name)).flat();
  const phrases = splitPhrases(line.replace(/\.$/, ""));
  const result = [];
  for ( const phrase of phrases ) {
    // Gear is a short noun phrase. Anything long or with a full stop is prose that wandered in.
    if ( isMoney(phrase) || isChoice(phrase) || (phrase.length > 120) || /[.;:]/.test(phrase) ) continue;
    const words = tokens(phrase);
    if ( !words.length || words.some(w => owned.some(o => related(o, w))) ) continue;
    if ( result.length >= 12 ) break;
    result.push({ name: nameOf(phrase), description: phrase.charAt(0).toUpperCase() + phrase.slice(1) });
  }
  return result;
}

/** Items the equipment step offers as a pick, or that name a kind of item and not one in particular. */
const isCategory = phrase => /focus|holy symbol|gaming set|musical instrument|artisan|\bor\b|\bany\b|your choice|same as above/i.test(phrase);

/** A word without its plural: "pouches" and "pouch", "daggers" and "dagger". */
const stem = word => word.replace(/(ch|sh|ss)es$/, "$1").replace(/s$/, "");

/** The words of an item name that identify it. */
const keywords = text => new Set(String(text).toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/)
  .filter(w => w.length > 2 && !["the", "and", "set", "kit", "pair", "sheets", "sheet", "pints", "flasks", "days"].includes(w)).map(stem));

/** The item an equipment phrase names, without its count or notes: "20 Arrows" and "Book (history)" -> "Arrows", "Book". */
function itemOf(phrase) {
  return phrase.replace(/@UUID\[[^\]]*\](?:\{([^}]*)\})?/g, "$1").replace(/&Reference\[[^\]]*\](?:\{[^}]*\})?/g, "")
    .replace(/\([^)]*\)/g, "").replace(/^\s*\d+\s*/, "").replace(/\s+/g, " ").trim();
}

/**
 * The items a 2024 class or background names in its "(A) ..." equipment text that the character's inventory doesn't have.
 * Imports sometimes leave one out of their data (a Guide without its Quiver, a Wizard without its Spellbook), and the text
 * is the only place the omission shows. Picks the equipment step offers (a focus, a gaming set, an instrument) are not
 * missing; money is not an item. Nothing is ever created from this: it is a reminder.
 * @param {string} html            The class' or background's description.
 * @param {Iterable<string>} have  Names of the items the character got, packs' contents included.
 * @returns {string[]}  The missing items as the text names them.
 */
export function missingItems(html, have = []) {
  const text = String(html ?? "").replace(/<\/(p|dt|dd|li|div|h\d|td|th|tr)>|<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&");
  const option = text.match(/\(A\)\s*([^;\n]+)/)?.[1];
  if ( !option ) return [];
  const owned = Array.from(have, name => keywords(name));
  const missing = [];
  for ( const phrase of splitPhrases(option) ) {
    if ( isMoney(phrase) || /\b\d+\s*gp\b/i.test(phrase) || isCategory(phrase) ) continue;
    const name = itemOf(phrase);
    const wanted = keywords(name);
    if ( !wanted.size ) continue;
    const found = owned.some(o => [...wanted].every(w => o.has(w)) || ([...o].length && [...o].every(w => wanted.has(w))));
    if ( !found && !missing.includes(name) ) missing.push(name);
  }
  return missing;
}

/**
 * The lines of a class' "Starting Equipment" list, for a class whose data has no structured equipment (imports of
 * Tasha's Artificer, for one). The text is only shown to the player as a reminder; it is never turned into items.
 * @param {string} html  The class' description.
 * @returns {string[]}
 */
export function classEquipmentLines(html) {
  const text = String(html ?? "");
  // The heading itself, since the words also turn up in running text ("if you forgo this starting equipment").
  const heading = text.search(/<h\d[^>]*>\s*starting equipment/i);
  const at = (heading === -1) ? text.search(/starting equipment/i) : heading;
  if ( at === -1 ) return [];
  // From the heading to the next heading: the list in between is the equipment.
  const next = text.slice(at + 20).search(/<h\d/i);
  const body = (next === -1) ? text.slice(at) : text.slice(at, at + 20 + next);
  const list = body.match(/<(ul|ol)[\s>][\s\S]*?<\/\1>/i)?.[0] ?? "";
  const lines = Array.from(list.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi), m => plainText(m[1])).filter(Boolean);
  return lines.slice(0, 12);
}

/**
 * The gold a 2024 class or background offers in place of its equipment, when the data lacks it (`wealth` is empty) but
 * the description states it: "Choose A or B: (A) Greataxe ...; or (B) 75 GP". Only an option that is nothing but gold counts.
 * @param {string} html  The class' or background's description.
 * @returns {string}  The amount ("75"), or "" when the description has none.
 */
export function describedGold(html) {
  const text = plainText(String(html ?? ""));
  const found = Array.from(text.matchAll(/\bor \(([A-D])\)\s*([\d,]+)\s*GP\b/gi), m => m[2].replace(/,/g, ""));
  return found.at(-1) ?? "";
}

function plainText(fragment) {
  return String(fragment).replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
}
