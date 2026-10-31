import { MODULE_ID, TEMPLATE_PATH } from "../constants.mjs";
import { getSetting, setSetting } from "../settings.mjs";
import { candidatePacks, worldRules } from "../content/catalog.mjs";
import { subclassesFor } from "../content/catalog-logic.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * GM settings window: which compendiums feed the wizard (and in what priority),
 * and which species and subclasses players are not allowed to pick.
 */
export default class ContentSettings extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "charwiz-content-settings",
    tag: "form",
    classes: ["charwiz", "charwiz-settings"],
    window: { title: "CHARWIZ.Settings.Content.Name", icon: "fa-solid fa-book-open", resizable: true },
    position: { width: 640, height: 720 },
    form: { handler: ContentSettings.#onSubmit, closeOnSubmit: true },
    actions: {
      movePack: ContentSettings.#onMovePack,
      rescan: ContentSettings.#onRescan
    }
  };

  static PARTS = {
    tabs: { template: "templates/generic/tab-navigation.hbs" },
    sources: { template: `${TEMPLATE_PATH}/settings/sources.hbs`, scrollable: [""] },
    species: { template: `${TEMPLATE_PATH}/settings/species.hbs`, scrollable: [""] },
    subclasses: { template: `${TEMPLATE_PATH}/settings/subclasses.hbs`, scrollable: [""] },
    footer: { template: "templates/generic/form-footer.hbs" }
  };

  static TABS = {
    main: {
      tabs: [
        { id: "sources", icon: "fa-solid fa-book", label: "CHARWIZ.Settings.Content.Tabs.Sources" },
        { id: "species", icon: "fa-solid fa-person", label: "CHARWIZ.Settings.Content.Tabs.Species" },
        { id: "subclasses", icon: "fa-solid fa-shield-halved", label: "CHARWIZ.Settings.Content.Tabs.Subclasses" }
      ],
      initial: "sources"
    }
  };

  /** Working copy of pack order, so moving packs up and down doesn't save until Submit. */
  #packOrder = null;

  get catalog() {
    return game.modules.get(MODULE_ID).api.catalog;
  }

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const sources = getSetting("contentSources");
    const allEntries = await this.catalog.entries({ includeDisabled: true });
    const counts = allEntries.reduce((acc, e) => { acc[e.pack] = (acc[e.pack] ?? 0) + 1; return acc; }, {});

    if ( !this.#packOrder ) {
      this.#packOrder = candidatePacks()
        .filter(p => counts[p.collection])
        .map(p => p.collection)
        .sort((a, b) => (sources[a]?.priority ?? Infinity) - (sources[b]?.priority ?? Infinity));
    }
    const packs = this.#packOrder.map((id, index) => ({
      id,
      index,
      rank: index + 1,
      label: game.packs.get(id)?.metadata.label ?? id,
      source: game.packs.get(id)?.metadata.packageName ?? "",
      count: counts[id] ?? 0,
      enabled: sources[id]?.enabled !== false,
      first: index === 0,
      last: index === this.#packOrder.length - 1
    }));

    const catalog = await this.catalog.build({ includeBlocked: true });
    const species = catalog.byType.race.map(e => ({ ...e, allowed: !e.blocked }));
    const subclassGroups = catalog.byType.class.map(cls => ({
      name: cls.name,
      subclasses: subclassesFor(catalog, cls.identifier).map(e => ({ ...e, allowed: !e.blocked }))
    })).filter(g => g.subclasses.length);

    return {
      ...context,
      rules: worldRules(),
      packs,
      species,
      subclassGroups,
      unavailable: this.catalog.unavailable,
      buttons: [{ type: "submit", icon: "fa-solid fa-save", label: "CHARWIZ.Settings.Save" }]
    };
  }

  /** @override */
  async _preparePartContext(partId, context, options) {
    context = await super._preparePartContext(partId, context, options);
    if ( context.tabs?.[partId] ) context.tab = context.tabs[partId];
    return context;
  }

  /** Move a pack up or down in priority. */
  static #onMovePack(event, target) {
    const index = Number(target.dataset.index);
    const offset = target.dataset.direction === "up" ? -1 : 1;
    const other = index + offset;
    if ( other < 0 || other >= this.#packOrder.length ) return;
    [this.#packOrder[index], this.#packOrder[other]] = [this.#packOrder[other], this.#packOrder[index]];
    this.render({ parts: ["sources"] });
  }

  /** Rescan compendiums. */
  static #onRescan() {
    this.catalog.invalidate();
    this.#packOrder = null;
    this.render();
  }

  /** Save sources, priorities and blocks. */
  static async #onSubmit(event, form, formData) {
    // Pack ids and content keys contain "." and ":", so read the checkboxes from the DOM
    // rather than through form field names (which Foundry would expand into nested objects).
    const enabled = new Set(Array.from(form.querySelectorAll("input[data-pack-id]:checked"), i => i.dataset.packId));
    const sources = {};
    this.#packOrder.forEach((id, priority) => {
      sources[id] = { enabled: enabled.has(id), priority };
    });

    // Unchecked "allowed" boxes become blocks; blocks for content not shown here are kept.
    const blocked = new Set(getSetting("blockedContent"));
    for ( const input of form.querySelectorAll("input[data-block-key]") ) {
      if ( input.checked ) blocked.delete(input.dataset.blockKey);
      else blocked.add(input.dataset.blockKey);
    }

    await setSetting("contentSources", sources);
    await setSetting("blockedContent", Array.from(blocked));
    this.catalog.invalidate();
    ui.notifications.info("CHARWIZ.Settings.Saved", { localize: true });
  }
}
