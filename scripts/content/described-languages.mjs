/**
 * Pure helpers for a feature whose text says "You know Draconic" but whose data grants no language. The D&D Beyond import of
 * the 2024 Cult of the Dragon Initiate feat has no advancement at all, so a character with the feat never learned Draconic.
 *
 * Narrow on purpose: features only, only the plain "You know <language>" wording, only a language the system lists, and
 * never when the item's data already grants or offers that language. A language the character already has is handled by the
 * wizard's own duplicate rule ("pick any other"), which is also what such a feature's text says.
 */

export const LANGUAGE_ADVANCEMENT_ID = "cwLanguages00001";

/** A name as a lookup key: lowercase, curly apostrophes straightened. */
const nameKey = name => String(name ?? "").toLowerCase().replace(/[’‘`]/g, "'").replace(/\s+/g, " ").trim();

function plain(html) {
  return String(html ?? "")
    .replace(/<section class="secret">[\s\S]*?<\/section>/gi, " ")
    .replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&nbsp;/g, " ").replace(/\s+/g, " ");
}

/**
 * The languages an item's text says you know.
 * @param {string} html
 * @param {{ path: string, label: string }[]} languages  The system's languages (`path` is the key below "languages:").
 * @returns {string[]}  Trait keys such as "languages:exotic:draconic", without repeats.
 */
export function describedLanguages(html, languages) {
  const text = plain(html);
  const found = [];
  // Longest names first, so "Common Sign Language" isn't read as "Common".
  const byLength = [...languages].sort((a, b) => b.label.length - a.label.length);
  for ( const match of text.matchAll(/\byou\s+(?:also\s+)?know\s+([^.;,]+)/gi) ) {
    const phrase = nameKey(match[1]);
    const language = byLength.find(l => phrase === nameKey(l.label) || phrase.startsWith(`${nameKey(l.label)} `));
    if ( language ) found.push(`languages:${language.path}`);
  }
  return [...new Set(found)];
}

/**
 * The Trait advancement to add to an item whose text names languages its data doesn't grant.
 * @param {object} item
 * @param {string} item.type
 * @param {string} item.description
 * @param {{ grants?: string[], choices?: { pool: Iterable<string> }[] }[]} item.traits  Its Trait advancements.
 * @param {{ path: string, label: string }[]} item.languages
 * @returns {object|null}  Advancement source data, or null when nothing should be added.
 */
export function languageGrantAdvancement({ type, description, traits, languages }) {
  if ( type !== "feat" ) return null;
  // Older data names a language by a short alias ("languages:druidic" for "languages:exotic:druidic"), so compare by the
  // language's own name, the last part of the key.
  const last = key => String(key).split(":").pop();
  const offered = new Set();
  for ( const trait of traits ?? [] ) {
    for ( const key of trait.grants ?? [] ) offered.add(last(key));
    for ( const choice of trait.choices ?? [] ) for ( const key of choice.pool ?? [] ) offered.add(last(key));
  }
  const missing = describedLanguages(description, languages).filter(key => !offered.has(last(key)));
  if ( !missing.length ) return null;
  return {
    _id: LANGUAGE_ADVANCEMENT_ID, type: "Trait", level: 0, name: "", hint: "",
    configuration: { mode: "default", allowReplacements: false, grants: missing, choices: [] },
    value: {}
  };
}
