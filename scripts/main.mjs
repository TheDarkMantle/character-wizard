import { MODULE_ID } from "./constants.mjs";
import { registerSettings } from "./settings.mjs";
import { registerEntryPoints } from "./integration/entry-points.mjs";
import { ContentCatalog } from "./content/catalog.mjs";
import CharacterWizard from "./apps/wizard.mjs";
import { HeadlessAdvancer, spikeFighter } from "./advancement/apply.mjs";

Hooks.once("init", () => {
  if ( game.system.id !== "dnd5e" ) return;
  registerSettings();
  registerEntryPoints();

  const catalog = new ContentCatalog();
  game.modules.get(MODULE_ID).api = Object.freeze({
    /** The content catalog (compendium scan). */
    catalog,
    /**
     * Open the creation wizard.
     * @param {object} [options]
     * @param {Actor} [options.actor]  Existing level-0 character to build onto. Omit to create a new actor.
     */
    open({ actor } = {}) {
      return new CharacterWizard({ actor, catalog }).render({ force: true });
    },
    /** Prototype engine that applies advancements without dialogs. */
    HeadlessAdvancer,
    /** Test: build a level 1 Fighter with no dialogs. GM only, run from the console. */
    spike: spikeFighter
  });
});

// Rescan when compendium contents change.
for ( const hook of ["createItem", "updateItem", "deleteItem"] ) {
  Hooks.on(hook, item => {
    if ( item.pack ) game.modules.get(MODULE_ID)?.api?.catalog.invalidate();
  });
}
