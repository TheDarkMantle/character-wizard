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

/** The item's name: the phrase without its article, cut before a trailing clause. */
function nameOf(phrase) {
  const bare = phrase.replace(/\([^)]*\)/g, " ").replace(/^(an?|the|one|some|two|three)\s+/i, "").replace(/\s+/g, " ").trim();
  const cut = bare.split(/\s+(?:posing|that|which|containing|bearing|you|your|to remember)\b/i)[0].trim();
  // A bare "Token" says nothing; keep the whole phrase when cutting leaves one word.
  const name = cut.includes(" ") ? cut : bare;
  return name.charAt(0).toUpperCase() + name.slice(1);
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
    if ( isMoney(phrase) || isChoice(phrase) || (phrase.length > 90) || /[.;:]/.test(phrase) ) continue;
    const words = tokens(phrase);
    if ( !words.length || words.some(w => owned.some(o => related(o, w))) ) continue;
    if ( result.length >= 12 ) break;
    result.push({ name: nameOf(phrase), description: phrase.charAt(0).toUpperCase() + phrase.slice(1) });
  }
  return result;
}
