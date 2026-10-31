/** Module identifier, matches module.json "id". */
export const MODULE_ID = "character-wizard";

/** Base path for module templates. */
export const TEMPLATE_PATH = `modules/${MODULE_ID}/templates`;

/** dnd5e "rulesVersion" setting values mapped to the source.rules values used on items. */
export const RULES = Object.freeze({
  modern: "2024",
  legacy: "2014"
});

/**
 * Item types the wizard cares about, grouped by what they're for.
 * "race" is the dnd5e item type for species.
 */
export const CONTENT_TYPES = Object.freeze(["class", "subclass", "race", "background", "feat"]);

/**
 * Extra index fields needed on top of what dnd5e already indexes
 * (dnd5e adds system.identifier, system.source and system.container).
 * Never request a child of an already-indexed parent (e.g. "system.source.rules"):
 * Foundry's projection cannot combine a parent and its child.
 */
export const INDEX_FIELDS = Object.freeze(["system.classIdentifier", "system.type"]);

/** What to do with content that has no 2014/2024 rules tag. */
export const UNTAGGED = Object.freeze({
  SHOW: "show",
  HIDE: "hide"
});

/** Creation step order per rules version (PHB order). */
export const STEP_ORDER = Object.freeze({
  2024: ["class", "background", "species", "abilities", "equipment", "spells", "details", "review"],
  2014: ["species", "class", "abilities", "background", "equipment", "spells", "details", "review"]
});
