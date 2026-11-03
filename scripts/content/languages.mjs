/**
 * Pure helpers for the language list the GM can trim.
 *
 * dnd5e has no notion of a language's "source", but modules that add languages (the D&D Beyond importer adds
 * well over a hundred) put them under their own top-level group in `CONFIG.DND5E.languages`. That group is the
 * closest thing to a source, so the settings window lists languages by group.
 */

/** Prefix of language trait keys: the language at `exotic:deep` is the trait `languages:exotic:deep`. */
export const LANGUAGE_PREFIX = "languages:";

/**
 * @typedef {object} LanguageGroup
 * @property {string} id
 * @property {string} label
 * @property {{ path: string, label: string }[]} languages  `path` is the key below `languages:`, e.g. "exotic:deep".
 */

/**
 * Flatten the language config into groups of selectable languages.
 * Top-level categories become groups; nested categories (Primordial's dialects) are flattened into their group;
 * top-level languages with no category (Thieves' Cant, Druidic) are collected under `otherLabel`.
 * @param {object} config          `CONFIG.DND5E.languages`.
 * @param {(key: string) => string} localize
 * @param {string} otherLabel      Label for the group of uncategorised languages.
 * @returns {LanguageGroup[]}
 */
export function languageGroups(config, localize, otherLabel) {
  const groups = [];
  const other = { id: "other", label: otherLabel, languages: [] };
  const walk = (children, path, into) => {
    for ( const [key, value] of Object.entries(children) ) {
      const here = [...path, key];
      const label = localize(typeof value === "string" ? value : value.label ?? key);
      if ( value?.children ) walk(value.children, here, into);
      else into.languages.push({ path: here.join(":"), label });
    }
  };
  for ( const [key, value] of Object.entries(config ?? {}) ) {
    if ( value?.children ) {
      const group = { id: key, label: localize(value.label ?? key), languages: [] };
      walk(value.children, [key], group);
      group.languages.sort((a, b) => a.label.localeCompare(b.label));
      groups.push(group);
    } else {
      other.languages.push({ path: key, label: localize(typeof value === "string" ? value : value?.label ?? key) });
    }
  }
  if ( other.languages.length ) groups.push(other);
  return groups;
}

/** Trait keys for the blocked language paths, ready to compare with a slot option's value. */
export function blockedLanguageKeys(paths = []) {
  return new Set(Array.from(paths, p => `${LANGUAGE_PREFIX}${p}`));
}
