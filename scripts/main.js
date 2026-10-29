import { CompendiumCatalog } from "./catalog.js";
import { CharacterDraft } from "./rules.js";
import { CharacterWizard } from "./wizard.js";

const MODULE_ID = "character-wizard";

Hooks.once("init", () => {
  game.settings.registerMenu(MODULE_ID, "openWizard", {
    name: "Character Wizard", label: "Open Character Wizard",
    hint: "Explore compendium choices and build a character draft.",
    icon: "fa-solid fa-hat-wizard", type: CharacterWizard, restricted: false
  });
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
    createDraft: ruleset => new CharacterDraft(ruleset),
    open: () => new CharacterWizard({ catalog }).render({ force: true })
  });
});

Hooks.on("renderActorDirectory", (_app, html) => {
  if (game.system.id !== "dnd5e") return;
  const root = html instanceof HTMLElement ? html : html[0];
  const header = root?.querySelector(".directory-header");
  if (!header || header.querySelector(".cw-launch")) return;
  const button = document.createElement("button");
  button.type = "button";
  button.className = "cw-launch";
  button.innerHTML = '<i class="fa-solid fa-hat-wizard" aria-hidden="true"></i> Character Wizard';
  button.addEventListener("click", () => game.modules.get(MODULE_ID).api.open());
  header.append(button);
});
