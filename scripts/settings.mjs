import { MODULE_ID, UNTAGGED } from "./constants.mjs";
import ContentSettings from "./apps/content-settings.mjs";
import { parseArray } from "./abilities/scores.mjs";

/** A sample array, offered as the custom array until the GM changes it. */
export const DEFAULT_CUSTOM_ARRAY = "17, 15, 13, 12, 10, 8";

/**
 * The GM's custom array, or null when it is off or isn't six usable numbers.
 * @returns {number[]|null}
 */
export function customArray() {
  return getSetting("customArrayEnabled") ? parseArray(getSetting("customArray")) : null;
}

/**
 * The array field only takes input while the toggle above it is on. It is read-only rather than disabled, because a
 * disabled field isn't submitted and the saved array would be lost.
 */
function onRenderSettingsConfig(app, html) {
  const root = html instanceof HTMLElement ? html : html[0];
  const toggle = root?.querySelector(`[name="${MODULE_ID}.customArrayEnabled"]`);
  const field = root?.querySelector(`[name="${MODULE_ID}.customArray"]`);
  if ( !toggle || !field ) return;
  const sync = () => {
    field.readOnly = !toggle.checked;
    field.closest(".form-group")?.classList.toggle("charwiz-dimmed", !toggle.checked);
  };
  toggle.addEventListener("change", sync);
  sync();
}

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

  // Ability scores. The custom array is off by default; its field holds a sample array until changed.
  game.settings.register(MODULE_ID, "customArrayEnabled", {
    name: "CHARWIZ.Settings.CustomArrayEnabled.Name",
    hint: "CHARWIZ.Settings.CustomArrayEnabled.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: false
  });

  game.settings.register(MODULE_ID, "customArray", {
    name: "CHARWIZ.Settings.CustomArray.Name",
    hint: "CHARWIZ.Settings.CustomArray.Hint",
    scope: "world",
    config: true,
    type: String,
    default: DEFAULT_CUSTOM_ARRAY,
    onChange: value => {
      if ( !parseArray(value) && game.user.isGM ) ui.notifications.warn("CHARWIZ.Settings.CustomArray.Invalid", { localize: true });
    }
  });

  game.settings.register(MODULE_ID, "rerollOnes", {
    name: "CHARWIZ.Settings.RerollOnes.Name",
    hint: "CHARWIZ.Settings.RerollOnes.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: false
  });

  Hooks.on("renderSettingsConfig", onRenderSettingsConfig);

  game.settings.register(MODULE_ID, "allowPlayers", {
    name: "CHARWIZ.Settings.AllowPlayers.Name",
    hint: "CHARWIZ.Settings.AllowPlayers.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });
}
