import { INDEX_FIELDS, MODULE_ID, RULES } from "../constants.mjs";
import { getSetting } from "../settings.mjs";
import { buildCatalog, normalizeEntry } from "./catalog-logic.mjs";

/**
 * The world's rules version as a source.rules value ("2014" or "2024").
 * Reads dnd5e's own "rulesVersion" world setting ("modern" / "legacy").
 * @returns {"2014"|"2024"}
 */
export function worldRules() {
  const version = game.settings.get("dnd5e", "rulesVersion");
  return RULES[version] ?? "2024";
}

/**
 * Item compendiums this user can see that could hold dnd5e content.
 * @returns {CompendiumCollection[]}
 */
export function candidatePacks() {
  return game.packs.filter(pack => (pack.documentName === "Item")
    && pack.visible
    && (!pack.metadata.system || pack.metadata.system === "dnd5e"));
}

/**
 * Scans compendium indexes and builds the option catalog.
 * Only lightweight index data is loaded; full documents are fetched when something is picked.
 */
export class ContentCatalog {
  /** @type {import("./catalog-logic.mjs").CatalogEntry[]|null} */
  #entries = null;

  /** Packs that failed to index during the last scan. */
  unavailable = [];

  /** Clear the cache so the next request rescans. */
  invalidate() {
    this.#entries = null;
  }

  /**
   * All normalized entries from every candidate pack (cached).
   * @param {object} [options]
   * @param {boolean} [options.includeDisabled]  Include packs the GM has disabled (for the settings view).
   */
  async entries({ includeDisabled = false } = {}) {
    if ( !this.#entries ) await this.#scan();
    if ( includeDisabled ) return this.#entries;
    const sources = getSetting("contentSources");
    return this.#entries.filter(e => sources[e.pack]?.enabled !== false);
  }

  async #scan() {
    const entries = [];
    this.unavailable = [];
    for ( const pack of candidatePacks() ) {
      try {
        const index = await pack.getIndex({ fields: INDEX_FIELDS });
        for ( const raw of index ) {
          const entry = normalizeEntry(raw, { collection: pack.collection, label: pack.metadata.label });
          if ( entry ) entries.push(entry);
        }
      } catch(err) {
        this.unavailable.push(pack.collection);
        console.warn(`${MODULE_ID} | Could not index ${pack.collection}`, err);
      }
    }
    this.#entries = entries;
  }

  /**
   * The catalog players see: filtered to the world's rules, GM blocks applied, duplicates removed.
   * @param {object} [options]
   * @param {boolean} [options.includeBlocked]
   */
  async build({ includeBlocked = false } = {}) {
    const sources = getSetting("contentSources");
    const packOrder = Object.entries(sources)
      .sort(([, a], [, b]) => (a.priority ?? 0) - (b.priority ?? 0))
      .map(([id]) => id);
    return buildCatalog(await this.entries(), {
      rules: worldRules(),
      untagged: getSetting("untaggedContent"),
      packOrder,
      blocked: getSetting("blockedContent"),
      includeBlocked
    });
  }
}
