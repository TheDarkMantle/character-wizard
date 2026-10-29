import { CompendiumCatalog } from "./catalog.js";
import { CharacterDraft } from "./rules.js";

const MODULE_ID = "character-wizard";

Hooks.once("init", () => {
  game.settings.register(MODULE_ID, "excludedPacks", {
    name: "Excluded compendiums", scope: "world", config: false, type: Array, default: []
  });
  game.settings.register(MODULE_ID, "ruleDesignations", {
    name: "Content rules designations", scope: "world", config: false, type: Object,
    default: { items: {}, packs: {} }
  });
});

Hooks.once("ready", () => {
  if (game.system.id !== "dnd5e") return;
  const catalog = new CompendiumCatalog({
    packs: () => game.packs.values(),
    settings: () => ({
      excludedPacks: game.settings.get(MODULE_ID, "excludedPacks"),
      designations: game.settings.get(MODULE_ID, "ruleDesignations")
    })
  });
  game.modules.get(MODULE_ID).api = Object.freeze({
    catalog,
    createDraft: ruleset => new CharacterDraft(ruleset)
  });
});
