export const RULESETS = Object.freeze(["2014", "2024"]);
export const CONTENT_TYPES = Object.freeze([
  "race", "background", "class", "subclass", "feat", "spell",
  "weapon", "equipment", "consumable", "tool", "loot", "container"
]);

export function requireRuleset(ruleset) {
  if (!RULESETS.includes(ruleset)) throw new Error("Choose either 2014 or 2024 rules.");
  return ruleset;
}

// Explicit item designations win over pack defaults. Never infer an edition from a name.
export function contentRules(item, { items = {}, packs = {} } = {}) {
  const override = Object.hasOwn(items, item.uuid) ? items[item.uuid] : undefined;
  if (override !== undefined) return RULESETS.includes(override) ? override : null;
  const declared = item.system?.source?.rules;
  if (RULESETS.includes(declared)) return declared;
  const fallback = packs[item.pack];
  return RULESETS.includes(fallback) ? fallback : null;
}

export function isEligible(item, ruleset, designations) {
  requireRuleset(ruleset);
  return contentRules(item, designations) === ruleset;
}

export class CharacterDraft {
  constructor(ruleset) {
    this.ruleset = requireRuleset(ruleset);
    this.selections = new Map();
  }

  setRuleset(ruleset) {
    requireRuleset(ruleset);
    if (ruleset !== this.ruleset) this.selections.clear();
    this.ruleset = ruleset;
  }

  select(slot, item, designations) {
    if (!item.uuid || !isEligible(item, this.ruleset, designations)) {
      throw new Error(`This choice is not designated for ${this.ruleset} rules.`);
    }
    this.selections.set(slot, item.uuid);
  }

  toJSON() {
    return { schemaVersion: 1, ruleset: this.ruleset, selections: Object.fromEntries(this.selections) };
  }
}
