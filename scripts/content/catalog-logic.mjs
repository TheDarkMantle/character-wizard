/**
 * Pure catalog logic: no Foundry globals here, so it can be unit tested in Node.
 * The Foundry-facing scanner (catalog.mjs) feeds plain index entries into these functions.
 */
import { CONTENT_TYPES, UNTAGGED } from "../constants.mjs";

/**
 * @typedef {object} CatalogEntry
 * @property {string} uuid            Compendium UUID.
 * @property {string} name
 * @property {string} img
 * @property {string} type            Item type (class, subclass, race, background, feat).
 * @property {string} identifier      system.identifier, or a slug of the name.
 * @property {string} [classIdentifier] For subclasses, the parent class identifier.
 * @property {string} [featType]      For feats, system.type.value (e.g. "feat", "class").
 * @property {string} [groupName]     For species, the base race an importer says this belongs to (D&D Beyond: "Elf").
 * @property {string} [featSubtype]   For feats, system.type.subtype (e.g. "origin", "fightingStyle").
 * @property {{level: number, items: string[]}} [prerequisites]  For feats: the level and (any-of) items required.
 * @property {string|null} rules      "2014", "2024" or null when untagged.
 * @property {string} book            Source book label, if any.
 * @property {string} pack            Pack collection id.
 * @property {string} packLabel
 * @property {string} origin          Where the copy comes from, for telling copies apart: "SRD", "DDB" or the pack label.
 * @property {string} key             Identity key used for de-duplication and blocking.
 */

/** Lowercase, hyphenated slug. Mirrors the style of dnd5e identifiers. */
export function slugify(text = "") {
  return String(text)
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().trim()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** The 2014/2024 tag on an index entry, or null if missing/unknown. */
export function rulesFor(entry) {
  const rules = entry?.system?.source?.rules;
  return (rules === "2014" || rules === "2024") ? rules : null;
}

/**
 * Identity key: same key = "the same option" across packs.
 * Subclasses include their class so "Champion" for Fighter can't clash with a homebrew "Champion" elsewhere.
 */
export function contentKey({ type, identifier, classIdentifier, pack }) {
  if ( type === "subclass" ) return `subclass:${classIdentifier || "unknown"}:${identifier}`;
  // Classes are told apart by compendium: the SRD Ranger and a D&D Beyond Ranger are separate options, each
  // blockable and shown to players, because the copies can differ (Tasha's features built in, for instance).
  if ( type === "class" ) return `class:${identifier}@${pack ?? ""}`;
  return `${type}:${identifier}`;
}

/**
 * Where a copy of an item comes from, in a word players know. The system's own compendiums hold the SRD, D&D Beyond
 * imports are recognised by the importer's flag (or "ddb" in the pack id), and anything else is named by its pack.
 * @param {object} source
 * @param {string} source.pack        Pack collection id.
 * @param {string} source.packLabel
 * @param {boolean} [source.ddb]      The item carries the D&D Beyond importer's flag.
 * @returns {string}
 */
export function originLabel({ pack = "", packLabel = "", ddb = false }) {
  if ( pack.startsWith("dnd5e.") ) return "SRD";
  if ( ddb || /ddb/i.test(pack) ) return "DDB";
  return packLabel || pack;
}

/**
 * A feat's prerequisites. Official content fills in `system.prerequisites`; imports often only have the text
 * ("5th Level Warlock, Pact of the Blade"), so the level and a named Pact are read from that when the data is empty.
 */
export function featPrerequisites(system = {}) {
  const data = system.prerequisites ?? {};
  const text = String(system.requirements ?? "");
  const level = Number(data.level) || Number(text.match(/(\d+)(?:st|nd|rd|th)[- ]level/i)?.[1]) || 0;
  let items = Array.from(data.items ?? []);
  if ( !items.length ) items = Array.from(text.matchAll(/pact of the (\w+)/gi), m => `pact-of-the-${m[1].toLowerCase()}`);
  return { level, items };
}

/**
 * Turn a raw compendium index entry into a CatalogEntry.
 * @param {object} raw     Index entry (with system.* fields requested).
 * @param {object} pack    { collection, label }
 * @returns {CatalogEntry|null}
 */
export function normalizeEntry(raw, pack) {
  if ( !raw || !CONTENT_TYPES.includes(raw.type) ) return null;
  const system = raw.system ?? {};
  const identifier = system.identifier || slugify(raw.name);
  const entry = {
    uuid: raw.uuid ?? `Compendium.${pack.collection}.Item.${raw._id}`,
    name: raw.name,
    img: raw.img,
    type: raw.type,
    identifier,
    classIdentifier: raw.type === "subclass" ? (system.classIdentifier || "") : undefined,
    featType: raw.type === "feat" ? (system.type?.value ?? "") : undefined,
    featSubtype: raw.type === "feat" ? (system.type?.subtype ?? "") : undefined,
    prerequisites: raw.type === "feat" ? featPrerequisites(system) : undefined,
    groupName: raw.type === "race" ? (raw.flags?.ddbimporter?.groupName || undefined) : undefined,
    rules: rulesFor(raw),
    book: system.source?.book ?? "",
    pack: pack.collection,
    packLabel: pack.label,
    origin: originLabel({ pack: pack.collection, packLabel: pack.label, ddb: raw.flags?.ddbimporter?.id !== undefined })
  };
  entry.key = contentKey(entry);
  return entry;
}

/**
 * Should this entry be offered under the given rules?
 * @param {CatalogEntry} entry
 * @param {"2014"|"2024"} rules
 * @param {string} untagged   What to do with content that has no rules tag: UNTAGGED.LEGACY (2014 only), SHOW (either) or HIDE.
 */
export function matchesRules(entry, rules, untagged = UNTAGGED.SHOW) {
  if ( entry.rules === null ) return (untagged === UNTAGGED.SHOW) || ((untagged === UNTAGGED.LEGACY) && (rules === "2014"));
  return entry.rules === rules;
}

/**
 * Build the catalog from normalized entries.
 * - Filters by rules version and blocked keys.
 * - De-duplicates by key + rules, keeping the copy from the highest-priority pack
 *   (lowest index in packOrder; packs not listed come after, in scan order).
 * @param {CatalogEntry[]} entries
 * @param {object} options
 * @param {"2014"|"2024"} options.rules
 * @param {string} [options.untagged]
 * @param {string[]} [options.packOrder]   Pack ids, highest priority first.
 * @param {Iterable<string>} [options.blocked]  Keys the GM has blocked.
 * @param {Iterable<string>} [options.anyRulesPacks]  Packs whose content is offered whatever its rules tag says (homebrew
 *   or older material the GM wants to use under the other ruleset).
 * @param {boolean} [options.includeBlocked]   Keep blocked entries (flagged) — for the GM settings view.
 * @param {Record<string, string>} [options.labels]   Names the GM gave copies (by key), replacing their automatic origin.
 * @returns {{ byType: Record<string, CatalogEntry[]>, duplicates: number, blockedCount: number }}
 */
export function buildCatalog(entries, { rules, untagged = UNTAGGED.SHOW, packOrder = [], blocked = [],
  includeBlocked = false, anyRulesPacks = [], labels = {} } = {}) {
  const blockedSet = new Set(blocked);
  const anyRules = new Set(anyRulesPacks);
  const scanOrder = new Map();
  entries.forEach(e => { if ( !scanOrder.has(e.pack) ) scanOrder.set(e.pack, scanOrder.size); });
  const rank = pack => {
    const i = packOrder.indexOf(pack);
    return i === -1 ? packOrder.length + (scanOrder.get(pack) ?? 0) : i;
  };

  const winners = new Map();
  let duplicates = 0;
  let blockedCount = 0;
  for ( const entry of entries ) {
    if ( !anyRules.has(entry.pack) && !matchesRules(entry, rules, untagged) ) continue;
    const isBlocked = blockedSet.has(entry.key);
    if ( isBlocked && !includeBlocked ) { blockedCount++; continue; }
    const dedupeKey = `${entry.key}|${entry.rules ?? "untagged"}`;
    const current = winners.get(dedupeKey);
    if ( current ) {
      duplicates++;
      if ( rank(entry.pack) >= rank(current.pack) ) continue;
    }
    winners.set(dedupeKey, { ...entry, origin: labels[entry.key]?.trim() || entry.origin, blocked: isBlocked });
  }

  // If an untagged copy and a tagged copy of the same thing both survive, prefer the tagged one.
  const tagged = new Set([...winners.values()].filter(e => e.rules).map(e => e.key));
  const byType = Object.fromEntries(CONTENT_TYPES.map(t => [t, []]));
  for ( const entry of winners.values() ) {
    if ( !entry.rules && tagged.has(entry.key) ) { duplicates++; continue; }
    byType[entry.type].push(entry);
  }
  for ( const list of Object.values(byType) ) list.sort((a, b) => a.name.localeCompare(b.name));
  return { byType, duplicates, blockedCount };
}

/** Subclasses for a class identifier. */
export function subclassesFor(catalog, classIdentifier) {
  return catalog.byType.subclass.filter(s => s.classIdentifier === classIdentifier);
}

/** Filter a list by a free-text query against name, book and pack label. */
export function searchEntries(list, query = "") {
  const q = query.trim().toLowerCase();
  if ( !q ) return list;
  return list.filter(e => `${e.name} ${e.book} ${e.packLabel} ${e.origin ?? ""}`.toLowerCase().includes(q));
}

/**
 * Names for the picker. A class that is offered from more than one compendium gets its origin added
 * ("Ranger (SRD)", "Ranger (DDB)") so the copies can be told apart; a lone copy keeps its plain name.
 * @param {CatalogEntry[]} classes
 * @returns {Map<string, string>}  Display name by uuid.
 */
export function classDisplayNames(classes) {
  const counts = new Map();
  for ( const c of classes ) counts.set(c.identifier, (counts.get(c.identifier) ?? 0) + 1);
  return new Map(classes.map(c => [c.uuid, (counts.get(c.identifier) > 1 && c.origin) ? `${c.name} (${c.origin})` : c.name]));
}

/**
 * Base races used to group species that carry no group of their own (the system's SRD species). A species whose
 * name ends in one of these, or in a group name found on other species, is grouped under it.
 */
const BASE_RACES = Object.freeze(["Dwarf", "Elf", "Gnome", "Halfling", "Dragonborn", "Genasi", "Tiefling", "Human"]);

const stripNote = name => String(name).replace(/\s*\([^)]*\)\s*$/, "").trim();

/**
 * Arrange species for the picker: subraces under their base race ("Dwarf" > "Hill Dwarf", "Mountain Dwarf").
 * The group comes from the importer's `groupName` when there is one, otherwise from the name. A group with a
 * single member isn't worth a level, so it stays a plain entry.
 * @param {CatalogEntry[]} entries
 * @returns {({ group: string, entries: CatalogEntry[] } | { entry: CatalogEntry })[]}  Sorted by display name.
 */
export function groupSpecies(entries) {
  const known = new Map(BASE_RACES.map(r => [r.toLowerCase(), r]));
  for ( const e of entries ) if ( e.groupName ) known.set(e.groupName.toLowerCase(), e.groupName);

  const groups = new Map();
  for ( const entry of entries ) {
    const base = stripNote(entry.name);
    const last = base.split(/\s+/).at(-1).toLowerCase();
    const group = entry.groupName || known.get(base.toLowerCase()) || known.get(last) || null;
    const list = groups.get(group ?? `\0${entry.key}`) ?? [];
    list.push(entry);
    groups.set(group ?? `\0${entry.key}`, list);
  }

  const rows = [];
  for ( const [group, members] of groups ) {
    if ( group.startsWith("\0") || (members.length === 1) ) rows.push(...members.map(entry => ({ entry })));
    else rows.push({ group, entries: members });
  }
  const label = row => ("group" in row) ? row.group : row.entry.name;
  return rows.sort((a, b) => label(a).localeCompare(label(b)));
}
