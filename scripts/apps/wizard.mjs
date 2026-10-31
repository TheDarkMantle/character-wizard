import { MODULE_ID, STEP_ORDER, TEMPLATE_PATH } from "../constants.mjs";
import { worldRules } from "../content/catalog.mjs";
import { searchEntries } from "../content/catalog-logic.mjs";
import { buildBoard } from "../advancement/read.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/** Wizard steps that pick an item from the catalog, mapped to the catalog bucket (item type). */
const PICKER_STEPS = Object.freeze({ class: "class", species: "race", background: "background" });

/** Icons for the step list. */
const STEP_ICONS = Object.freeze({
  class: "fa-shield-halved", species: "fa-person", background: "fa-scroll", abilities: "fa-dice-d20",
  equipment: "fa-sack", spells: "fa-wand-sparkles", details: "fa-feather", review: "fa-clipboard-check"
});

/**
 * The character creation wizard.
 * Holds every choice in a draft; nothing is written to an actor until the final step.
 */
export default class CharacterWizard extends HandlebarsApplicationMixin(ApplicationV2) {
  constructor({ actor = null, catalog, ...options } = {}) {
    super(options);
    this.actor = actor;
    this.catalog = catalog ?? game.modules.get(MODULE_ID).api.catalog;
    this.rules = worldRules();
    this.steps = STEP_ORDER[this.rules];
    this.stepIndex = 0;
    this.draft = { name: actor?.name ?? "", picks: {} };
    this.query = "";
    this.focused = null;
    /** @type {Map<string, object>} Preview data by UUID. */
    this.previews = new Map();
    this.catalogData = null;
  }

  static DEFAULT_OPTIONS = {
    classes: ["charwiz", "charwiz-wizard"],
    window: { icon: "fa-solid fa-hat-wizard", resizable: true },
    position: { width: 960, height: 720 },
    actions: {
      goto: CharacterWizard.#onGoto,
      next: CharacterWizard.#onNext,
      back: CharacterWizard.#onBack,
      focus: CharacterWizard.#onFocus,
      choose: CharacterWizard.#onChoose
    }
  };

  static PARTS = {
    steps: { template: `${TEMPLATE_PATH}/wizard/steps.hbs` },
    body: { template: `${TEMPLATE_PATH}/wizard/body.hbs`, scrollable: [".charwiz-list", ".charwiz-preview"] },
    footer: { template: `${TEMPLATE_PATH}/wizard/footer.hbs` }
  };

  /** @override */
  get title() {
    const base = game.i18n.localize("CHARWIZ.Title");
    return this.actor ? `${base}: ${this.actor.name}` : base;
  }

  get step() {
    return this.steps[this.stepIndex];
  }

  /* -------------------------------------------- */
  /*  Rendering                                   */
  /* -------------------------------------------- */

  /** @override */
  async _prepareContext(options) {
    this.catalogData ??= await this.catalog.build();
    const step = this.step;
    const context = {
      rules: this.rules,
      step,
      stepLabel: `CHARWIZ.Steps.${step}`,
      steps: this.steps.map((id, index) => ({
        id, index,
        label: `CHARWIZ.Steps.${id}`,
        icon: STEP_ICONS[id],
        active: index === this.stepIndex,
        done: !!this.#pickFor(id)
      })),
      isPicker: step in PICKER_STEPS,
      isDetails: step === "details",
      isReview: step === "review",
      isPending: ["abilities", "equipment", "spells"].includes(step),
      first: this.stepIndex === 0,
      last: this.stepIndex === this.steps.length - 1,
      draft: this.draft,
      query: this.query
    };

    if ( context.isPicker ) {
      const picked = this.draft.picks[step]?.uuid;
      context.entries = searchEntries(this.catalogData.byType[PICKER_STEPS[step]], this.query)
        .map(e => ({ ...e, focused: e.uuid === this.focused, picked: e.uuid === picked }));
      context.preview = this.focused ? await this.#loadPreview(this.focused) : null;
      context.previewPicked = !!context.preview && context.preview.uuid === picked;
    }

    if ( context.isReview ) {
      context.summary = Object.keys(PICKER_STEPS).filter(s => this.steps.includes(s)).map(s => ({
        label: `CHARWIZ.Steps.${s}`, name: this.draft.picks[s]?.name
      }));
    }
    return context;
  }

  /** @override */
  _onRender(context, options) {
    super._onRender(context, options);
    const search = this.element.querySelector("input[name=query]");
    search?.addEventListener("input", foundry.utils.debounce(event => {
      this.query = event.target.value;
      this.render({ parts: ["body"] }).then(() => {
        const input = this.element.querySelector("input[name=query]");
        input?.focus();
        input?.setSelectionRange(input.value.length, input.value.length);
      });
    }, 200));
    this.element.querySelector("input[name=name]")?.addEventListener("change", event => {
      this.draft.name = event.target.value.trim();
    });
  }

  /* -------------------------------------------- */
  /*  Data                                        */
  /* -------------------------------------------- */

  #pickFor(stepId) {
    if ( stepId === "details" ) return this.draft.name;
    return this.draft.picks[stepId];
  }

  /**
   * Load an item and prepare its preview: enriched description and a read-only features board.
   * @param {string} uuid
   */
  async #loadPreview(uuid) {
    if ( this.previews.has(uuid) ) return this.previews.get(uuid);
    const item = await fromUuid(uuid);
    if ( !item ) return null;
    const TextEditor = foundry.applications.ux.TextEditor.implementation;
    const isClass = item.type === "class";
    const board = buildBoard(item.toObject().system.advancement ?? [], {
      fromLevel: isClass ? 1 : 0,
      toLevel: 1,
      itemType: item.type
    });
    const preview = {
      uuid,
      name: item.name,
      img: item.img,
      source: item.system.source?.label ?? "",
      description: await TextEditor.enrichHTML(item.system.description?.value ?? "", { relativeTo: item }),
      granted: board.granted.map(e => this.#labelEntry(e)),
      choices: board.choices.map(e => this.#labelEntry(e)),
      native: board.native.map(e => this.#labelEntry(e))
    };
    this.previews.set(uuid, preview);
    return preview;
  }

  /** Human-readable label and detail for a board entry. */
  #labelEntry(entry) {
    const itemName = uuid => fromUuidSync(uuid)?.name ?? uuid;
    const traitLabel = key => {
      if ( key.startsWith("size:") ) return CONFIG.DND5E.actorSizes[key.slice(5)]?.label ?? key;
      return dnd5e.documents.Trait.keyLabel(key) || key;
    };
    let detail = "";
    if ( entry.items?.length ) detail = entry.items.map(itemName).join(", ");
    else if ( entry.traits?.length ) detail = entry.traits.map(traitLabel).join(", ");
    else if ( entry.choiceType === "trait" ) detail = entry.pool.map(traitLabel).join(", ");
    else if ( entry.choiceType === "item" && entry.pool?.length ) detail = entry.pool.map(itemName).join(", ");
    return {
      ...entry,
      detail,
      countLabel: entry.count ? game.i18n.format("CHARWIZ.Board.Choose", { count: entry.count }) : ""
    };
  }

  /* -------------------------------------------- */
  /*  Actions                                     */
  /* -------------------------------------------- */

  #setStep(index) {
    this.stepIndex = Math.clamp(index, 0, this.steps.length - 1);
    this.query = "";
    this.focused = this.draft.picks[this.step]?.uuid ?? null;
    this.render();
  }

  static #onGoto(event, target) {
    this.#setStep(Number(target.dataset.index));
  }

  static #onNext() {
    this.#setStep(this.stepIndex + 1);
  }

  static #onBack() {
    this.#setStep(this.stepIndex - 1);
  }

  static #onFocus(event, target) {
    this.focused = target.dataset.uuid;
    this.render({ parts: ["body"] });
  }

  static #onChoose(event, target) {
    const uuid = target.dataset.uuid;
    const entry = this.catalogData.byType[PICKER_STEPS[this.step]].find(e => e.uuid === uuid);
    if ( !entry ) return;
    this.draft.picks[this.step] = { uuid, name: entry.name, identifier: entry.identifier };
    this.render();
  }
}
