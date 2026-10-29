import { CONTENT_TYPES, contentRules, isEligible, requireRuleset } from "./rules.js";

const INDEX_FIELDS = ["type", "system.source.rules", "system.source.book", "system.identifier", "system.classIdentifier"];

export class CompendiumCatalog {
  constructor({ packs, settings, warn = console.warn }) {
    this.packs = packs;
    this.settings = settings;
    this.warn = warn;
  }

  async discover({ ruleset, type, search = "" } = {}) {
    requireRuleset(ruleset);
    const { excludedPacks = [], designations = {} } = this.settings();
    const results = [];
    const unavailable = [];
    let unclassified = 0;
    const query = search.trim().toLocaleLowerCase();
    for (const pack of this.packs()) {
      if (pack.documentName !== "Item" || !pack.visible || excludedPacks.includes(pack.collection)) continue;
      if (pack.metadata.system && pack.metadata.system !== "dnd5e") continue;
      try {
        const index = await pack.getIndex({ fields: INDEX_FIELDS });
        for (const entry of index) {
          if (!CONTENT_TYPES.includes(entry.type) || (type && entry.type !== type)) continue;
          const item = {
            ...entry,
            uuid: `Compendium.${pack.collection}.Item.${entry._id}`,
            pack: pack.collection,
            packLabel: pack.metadata.label
          };
          if (!contentRules(item, designations)) unclassified++;
          if (!isEligible(item, ruleset, designations)) continue;
          if (query && !`${item.name} ${item.packLabel}`.toLocaleLowerCase().includes(query)) continue;
          results.push(item);
        }
      } catch (error) {
        unavailable.push(pack.collection);
        this.warn(`Character Wizard: could not index ${pack.collection}`, error);
      }
    }
    results.sort((a, b) => a.name.localeCompare(b.name) || a.packLabel.localeCompare(b.packLabel) || a.uuid.localeCompare(b.uuid));
    return { items: results, unavailable, unclassified };
  }

  // Re-read the document and permissions before accepting a selection.
  async resolve(uuid, ruleset) {
    requireRuleset(ruleset);
    const { excludedPacks = [], designations = {} } = this.settings();
    for (const pack of this.packs()) {
      if (pack.documentName !== "Item" || !pack.visible || excludedPacks.includes(pack.collection)) continue;
      if (pack.metadata.system && pack.metadata.system !== "dnd5e") continue;
      const prefix = `Compendium.${pack.collection}.Item.`;
      if (!uuid.startsWith(prefix)) continue;
      const id = uuid.slice(prefix.length);
      if (!id || id.includes(".")) break;
      const doc = await pack.getDocument(id);
      if (!doc || !CONTENT_TYPES.includes(doc.type)) break;
      const item = { ...doc.toObject(), uuid, pack: pack.collection };
      if (!isEligible(item, ruleset, designations)) break;
      return doc;
    }
    throw new Error("This content is unavailable or does not match the selected rules.");
  }
}
