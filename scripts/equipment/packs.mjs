/**
 * Pure logic for equipment packs.
 *
 * In dnd5e's compendiums an "Explorer's Pack" is an empty container: the items inside it are only named in its
 * description. A pack is expanded in this order, so a third-party pack can describe its own contents:
 *   1. items actually stored inside the container (handled by the caller, which can see the compendium);
 *   2. the description, either `@UUID[...]{Name}` links or a plain "Backpack, Bedroll, 2 flasks of Oil, ..." list;
 *   3. a built-in table of the 2014 SRD packs, whose description lists nothing.
 */

/**
 * @typedef {object} PackLine
 * @property {number} qty
 * @property {boolean} explicit   The text gave a number ("10 Torches"), as opposed to just naming the item.
 * @property {string[]} names   Names to look for, best first (the full phrase, then what follows "of").
 * @property {string} [uuid]    Set when the description links to the item.
 */

/** Units that measure an item rather than count it: "50 feet of rope" is one rope. */
const MEASURES = /^(feet|foot|ft|yards?|miles?|inch(?:es)?|pounds?|lbs?|ounces?|oz|pints?|gallons?|quarts?)$/i;

const WORD_NUMBERS = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };

/**
 * Read a pack's contents from its description.
 * @param {string} html  The item's description.
 * @returns {PackLine[]}  Empty when the description doesn't list items.
 */
export function parsePackDescription(html = "") {
  // Keep item links as tokens through the text clean-up.
  const links = [];
  let text = String(html).replace(/@UUID\[([^\]]+)\](?:\{([^}]*)\})?/g, (_, uuid, name) => {
    links.push({ uuid, name: name ?? "" });
    return `⟦${links.length - 1}⟧`;
  });
  text = text.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/[’‘]/g, "'")
    .replace(/\s+/g, " ").trim();

  // "An Explorer's Pack contains the following items: ..." — take what follows the colon.
  const colon = text.indexOf(":");
  if ( colon === -1 ) return [];
  const list = text.slice(colon + 1).replace(/\.\s*$/, "");

  const lines = [];
  // Items are separated by commas, or by "and" when it introduces another counted item ("... clothes and a crowbar").
  // A comma inside a number ("1,000 ball bearings") doesn't separate anything.
  const separator = /\s*(?:(?<!\d),|,(?!\d)|;)\s*|\s+and\s+(?=(?:an?|one|two|three|four|five|six|seven|eight|nine|ten|\d)\s)/i;
  for ( let phrase of list.split(separator) ) {
    phrase = phrase.replace(/^\s*(and|plus)\s+/i, "").replace(/\.$/, "").trim();
    if ( !phrase ) continue;
    const line = parsePhrase(phrase, links);
    if ( line ) lines.push(line);
  }
  return lines;
}

/** One item in a list, for example "2 flasks of Oil", "10 Torches" or "a bedroll". */
function parsePhrase(phrase, links) {
  let link = null;
  const text = phrase.replace(/⟦(\d+)⟧/, (_, i) => { link = links[Number(i)]; return link.name || "__"; }).trim();

  let qty = 1;
  let rest = text;
  let measured = false;
  let explicit = false;

  const word = rest.match(/^(a|an|one|two|three|four|five|six|seven|eight|nine|ten)\s+(.*)$/i);
  const number = rest.match(/^(\d[\d,]*)\s+(.*)$/);
  if ( number ) {
    qty = Number(number[1].replace(/,/g, ""));
    rest = number[2];
    explicit = true;
  } else if ( word ) {
    qty = WORD_NUMBERS[word[1].toLowerCase()];
    rest = word[2];
    explicit = qty > 1;
  }

  // "flasks of oil", "days of rations", "feet of rope", "set of fine clothes".
  const of = rest.match(/^([\w'-]+)\s+of\s+(.*)$/i);
  const names = [];
  if ( of ) {
    if ( MEASURES.test(of[1]) ) { measured = true; qty = 1; explicit = false; }
    names.push(rest, of[2]);
  } else names.push(rest);
  if ( measured ) names.shift();

  const cleaned = names.map(n => n.replace(/⟦\d+⟧/g, "").trim()).filter(Boolean);
  if ( !cleaned.length && !link ) return null;
  return { qty, explicit, names: link?.name ? [link.name, ...cleaned] : cleaned, ...(link ? { uuid: link.uuid } : {}) };
}

/** A name stripped for comparison: lowercase, no punctuation or bracketed notes, singular words. */
export function normalizeName(name = "") {
  return String(name).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/\([^)]*\)/g, " ").replace(/[^a-z0-9 ]+/g, " ").split(/\s+/).filter(Boolean)
    .map(singular).join(" ");
}

function singular(word) {
  if ( word.length < 4 ) return word;
  if ( word.endsWith("ies") ) return `${word.slice(0, -3)}y`;
  if ( /(ches|shes|xes|sses)$/.test(word) ) return word.slice(0, -2);
  if ( word.endsWith("s") && !word.endsWith("ss")) return word.slice(0, -1);
  return word;
}

/**
 * Find the item a name refers to. Word order and extra notes don't matter, so "hempen rope" finds
 * "Rope, Hempen (50 feet)". Exact word sets win; otherwise the candidate with the fewest extra words.
 * @param {string[]} names                       Names to try, best first.
 * @param {{ name: string, rank?: number }[]} candidates  Mundane gear. Lower `rank` is preferred.
 * @returns {object|null}
 */
export function matchItemName(names, candidates) {
  const prepared = candidates.map(c => ({ c, words: new Set(normalizeName(c.name).split(" ")), rank: c.rank ?? 0 }));
  for ( const name of names ) {
    const wanted = normalizeName(name).split(" ").filter(Boolean);
    if ( !wanted.length ) continue;
    const exact = prepared.filter(p => (p.words.size === wanted.length) && wanted.every(w => p.words.has(w)));
    if ( exact.length ) return exact.sort((a, b) => a.rank - b.rank)[0].c;
    const subset = prepared.filter(p => wanted.every(w => p.words.has(w)));
    if ( subset.length ) return subset.sort((a, b) => (a.words.size - b.words.size) || (a.rank - b.rank))[0].c;
  }
  return null;
}

/**
 * Contents of the 2014 SRD packs (SRD 5.1), whose compendium items list nothing. Each line is
 * `[quantity, ...names]`, in the same form the description parser produces.
 * @type {Record<string, [number, ...string[]][]>}
 */
export const SRD_PACKS_2014 = Object.freeze({
  "burglars-pack": [[1, "backpack"], [1, "ball bearings"], [1, "string"], [1, "bell"], [5, "candle"], [1, "crowbar"],
    [1, "hammer"], [10, "piton"], [1, "hooded lantern", "lantern hooded"], [2, "oil", "flask of oil"], [5, "rations"],
    [1, "tinderbox"], [1, "waterskin"], [1, "hempen rope", "rope"]],
  "diplomats-pack": [[1, "chest"], [2, "map or scroll case", "case map or scroll"], [1, "fine clothes", "clothes fine"],
    [1, "ink", "bottle of ink"], [1, "ink pen"], [1, "lamp"], [2, "oil", "flask of oil"], [5, "paper", "sheet of paper"],
    [1, "perfume", "vial of perfume"], [1, "sealing wax"], [1, "soap"]],
  "dungeoneers-pack": [[1, "backpack"], [1, "crowbar"], [1, "hammer"], [10, "piton"], [10, "torch"], [1, "tinderbox"],
    [10, "rations"], [1, "waterskin"], [1, "hempen rope", "rope"]],
  "entertainers-pack": [[1, "backpack"], [1, "bedroll"], [2, "costume", "clothes costume"], [5, "candle"], [5, "rations"],
    [1, "waterskin"], [1, "disguise kit"]],
  "explorers-pack": [[1, "backpack"], [1, "bedroll"], [1, "mess kit"], [1, "tinderbox"], [10, "torch"], [10, "rations"],
    [1, "waterskin"], [1, "hempen rope", "rope"]],
  "priests-pack": [[1, "backpack"], [1, "blanket"], [10, "candle"], [1, "tinderbox"], [1, "alms box"],
    [2, "block of incense", "incense"], [1, "censer"], [1, "vestments"], [2, "rations"], [1, "waterskin"]],
  "scholars-pack": [[1, "backpack"], [1, "book of lore", "book"], [1, "ink", "bottle of ink"], [1, "ink pen"],
    [10, "parchment", "sheet of parchment"], [1, "little bag of sand", "sand"], [1, "small knife", "knife"]]
});

/**
 * The built-in contents of a known pack, as parser-style lines.
 * @param {string} identifier  The pack item's identifier, for example "explorers-pack".
 * @returns {PackLine[]}  Empty for an unknown pack.
 */
export function builtInPack(identifier) {
  return (SRD_PACKS_2014[identifier] ?? []).map(([qty, ...names]) => ({ qty, explicit: qty > 1, names }));
}
