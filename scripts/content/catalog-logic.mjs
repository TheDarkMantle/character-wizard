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
 * @property {string|null} rules      "2014", "2024" or null when untagged.
 * @property {string} book            Source book label, if any.
 * @property {string} pack            Pack collection id.
 * @property {string} packLabel
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
export function contentKey({ type, identifier, classIdentifier }) {
  if ( type === "subclass" ) return `subclass:${classIdentifier || "unknown"}:${identifier}`;
  return `${type}:${identifier}`;
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
    groupName: raw.type === "race" ? (raw.flags?.ddbimporter?.groupName || undefined) : undefined,
    rules: rulesFor(raw),
    book: system.source?.book ?? "",
    pack: pack.collection,
    packLabel: pack.label
  };
  entry.key = contentKey(entry);
  return entry;
}

/**
 * Should this entry be offered under the given rules?
 * @param {CatalogEntry} entry
 * @param {"2014"|"2024"} rules
 * @param {string} untagged   UNTAGGED.SHOW or UNTAGGED.HIDE
 */
export function matchesRules(entry, rules, untagged = UNTAGGED.SHOW) {
  if ( entry.rules === null ) return untagged === UNTAGGED.SHOW;
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
 * @param {boolean} [options.includeBlocked]   Keep blocked entries (flagged) — for the GM settings view.
 * @returns {{ byType: Record<string, CatalogEntry[]>, duplicates: number, blockedCount: number }}
 */
export function buildCatalog(entries, { rules, untagged = UNTAGGED.SHOW, packOrder = [], blocked = [],
  includeBlocked = false } = {}) {
  const blockedSet = new Set(blocked);
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
    if ( !matchesRules(entry, rules, untagged) ) continue;
    const isBlocked = blockedSet.has(entry.key);
    if ( isBlocked && !includeBlocked ) { blockedCount++; continue; }
    const dedupeKey = `${entry.key}|${entry.rules ?? "untagged"}`;
    const current = winners.get(dedupeKey);
    if ( current ) {
      duplicates++;
      if ( rank(entry.pack) >= rank(current.pack) ) continue;
    }
    winners.set(dedupeKey, { ...entry, blocked: isBlocked });
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
  return list.filter(e => `${e.name} ${e.book} ${e.packLabel}`.toLowerCase().includes(q));
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
