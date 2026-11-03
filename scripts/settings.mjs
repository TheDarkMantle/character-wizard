import { MODULE_ID, UNTAGGED } from "./constants.mjs";
import ContentSettings from "./apps/content-settings.mjs";

/** Shorthand for reading a module setting. */
export function getSetting(key) {
  return game.settings.get(MODULE_ID, key);
}

/** Shorthand for writing a module setting. */
export function setSetting(key, value) {
  return game.settings.set(MODULE_ID, key, value);
}

/** Register all module settings. Called during "init". */
export function registerSettings() {
  game.settings.registerMenu(MODULE_ID, "contentSettings", {
    name: "CHARWIZ.Settings.Content.Name",
    label: "CHARWIZ.Settings.Content.Label",
    hint: "CHARWIZ.Settings.Content.Hint",
    icon: "fa-solid fa-book-open",
    type: ContentSettings,
    restricted: true
  });

  // { [packCollection]: { enabled: boolean, priority: number } } — packs not listed are enabled.
  game.settings.register(MODULE_ID, "contentSources", {
    scope: "world",
    config: false,
    type: Object,
    default: {},
    onChange: () => game.modules.get(MODULE_ID)?.api?.catalog.invalidate()
  });

  // Identity keys (see catalog-logic contentKey) of species, subclasses etc. players can't pick.
  game.settings.register(MODULE_ID, "blockedContent", {
    scope: "world",
    config: false,
    type: Array,
    default: []
  });

  // Language paths (for example "exotic:deep" or "ddb:ergot") hidden from language choices in the wizard.
  game.settings.register(MODULE_ID, "blockedLanguages", {
    scope: "world",
    config: false,
    type: Array,
    default: []
  });

  game.settings.register(MODULE_ID, "untaggedContent", {
    name: "CHARWIZ.Settings.Untagged.Name",
    hint: "CHARWIZ.Settings.Untagged.Hint",
    scope: "world",
    config: true,
    type: String,
    default: UNTAGGED.SHOW,
    choices: {
      [UNTAGGED.SHOW]: "CHARWIZ.Settings.Untagged.Show",
      [UNTAGGED.HIDE]: "CHARWIZ.Settings.Untagged.Hide"
    }
  });

  // Tasha's Cauldron of Everything, "Customizing Your Origin". Off by default.
  game.settings.register(MODULE_ID, "tashasAbilityScores", {
    name: "CHARWIZ.Settings.TashasAbilityScores.Name",
    hint: "CHARWIZ.Settings.TashasAbilityScores.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: false
  });

  game.settings.register(MODULE_ID, "allowPlayers", {
    name: "CHARWIZ.Settings.AllowPlayers.Name",
    hint: "CHARWIZ.Settings.AllowPlayers.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });
}
