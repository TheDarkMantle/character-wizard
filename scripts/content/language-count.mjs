/**
 * Pure helpers for a language choice whose data asks for fewer languages than the item's own text promises.
 * D&D Beyond imports sometimes carry one pick where the book says two (Deft Explorer: "two additional languages of
 * your choice"; the Eberron Changeling: "Common and two other languages of your choice").
 *
 * The rule is deliberately narrow: it only ever raises a count, only on an item that already has exactly one language
 * choice, only for features, species and backgrounds (a class or subclass description repeats its features' text), and
 * only when the text states the number in one of the book's plain forms.
 */

const NUMBERS = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5 };
const NUMBER = "(a|an|one|two|three|four|five|\\d+)";

/** The forms the books use for "you choose N languages". */
const FORMS = [
  new RegExp(`\\b${NUMBER}\\s+(?:additional|extra|other|more)\\s+languages?\\b`, "gi"),
  new RegExp(`\\b${NUMBER}\\s+languages?\\s+of\\s+your\\s+choice\\b`, "gi"),
  new RegExp(`\\blanguages?\\s*:\\s*(?:any\\s+)?${NUMBER}\\s+of\\s+y\\s?our\\s+choice\\b`, "gi")
];

/** Item types whose own description is about their own grants. */
const TYPES = new Set(["feat", "race", "background"]);

function plain(html) {
  return String(html ?? "")
    .replace(/<section class="secret">[\s\S]*?<\/section>/gi, " ")
    .replace(/@UUID\[[^\]]*\](?:\{([^}]*)\})?/g, "$1")
    .replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&nbsp;/g, " ").replace(/\s+/g, " ");
}

/**
 * How many languages an item's text says you choose.
 * @param {string} html  The item's description.
 * @returns {number}  The largest number found in a recognised form, or 0.
 */
export function describedLanguageChoices(html) {
  const text = plain(html);
  let most = 0;
  for ( const form of FORMS ) {
    for ( const match of text.matchAll(form) ) {
      const word = match[1].toLowerCase();
      most = Math.max(most, NUMBERS[word] ?? Number(word));
    }
  }
  return most;
}

/**
 * Does this item's language choice need raising to match its text?
 * @param {object} item
 * @param {string} item.type
 * @param {string} item.description
 * @param {{ id: string, choices: { count?: number, pool: Iterable<string> }[] }[]} item.traits  Its Trait advancements.
 * @returns {{ advancementId: string, index: number, extra: number, count: number }|null}
 *   `extra` is how many more picks to add to choice `index` of that advancement; `count` is the new total.
 */
export function languageShortfall({ type, description, traits }) {
  if ( !TYPES.has(type) ) return null;
  const isLanguage = choice => Array.from(choice.pool ?? []).length
    && Array.from(choice.pool).every(key => String(key).startsWith("languages:"));
  const found = [];
  for ( const trait of traits ?? [] ) {
    (trait.choices ?? []).forEach((choice, index) => { if ( isLanguage(choice) ) found.push({ trait, choice, index }); });
  }
  if ( found.length !== 1 ) return null;
  const { trait, choice, index } = found[0];
  const current = choice.count ?? 1;
  const wanted = describedLanguageChoices(description);
  if ( !(wanted > current) || !(current >= 1) ) return null;
  return { advancementId: trait.id, index, extra: wanted - current, count: wanted };
}
