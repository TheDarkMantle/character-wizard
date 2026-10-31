import { MODULE_ID, STEP_ORDER, TEMPLATE_PATH } from "../constants.mjs";
import { worldRules } from "../content/catalog.mjs";
import { searchEntries } from "../content/catalog-logic.mjs";
import { buildBoard } from "../advancement/read.mjs";
import { discoverSlots } from "../advancement/simulate.mjs";
import { picksRemaining, pruneSelections, toggleSelection } from "../advancement/slots.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/** Wizard steps that pick an item from the catalog, mapped to the catalog bucket (item type). */
const PICKER_STEPS = Object.freeze({ class: "class", species: "race", background: "background" });

/** Choice steps, inserted after a picker step when its pick asks for decisions. Mapped to that picker step. */
const CHOICE_STEPS = Object.freeze({
  classChoices: "class", speciesChoices: "species", backgroundChoices: "background"
});
const choiceStepFor = source => Object.keys(CHOICE_STEPS).find(id => CHOICE_STEPS[id] === source);

/** Icons for the step list. */
const STEP_ICONS = Object.freeze({
  class: "fa-shield-halved", species: "fa-person", background: "fa-scroll", abilities: "fa-dice-d20",
  equipment: "fa-sack", spells: "fa-wand-sparkles", details: "fa-feather", review: "fa-clipboard-check",
  classChoices: "fa-list-check", speciesChoices: "fa-list-check", backgroundChoices: "fa-list-check"
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
    this.stepId = STEP_ORDER[this.rules][0];
    /** Choice slots found by simulating the current picks, and advancements the wizard can't handle yet. */
    this.slots = [];
    this.deferred = [];
    this.inspected = null;
    this.descriptions = new Map();
    this.refreshToken = 0;
    this.draft = { name: actor?.name ?? "", picks: {}, choices: {} };
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
      choose: CharacterWizard.#onChoose,
      toggle: CharacterWizard.#onToggle
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

  /** Base steps for the ruleset plus a choice step after each pick that asks for decisions. */
  get steps() {
    const withChoices = new Set(this.slots.map(s => s.source));
    return STEP_ORDER[this.rules].flatMap(id => {
      const choiceStep = choiceStepFor(id);
      return (choiceStep && withChoices.has(id)) ? [id, choiceStep] : [id];
    });
  }

  get stepIndex() {
    return Math.max(0, this.steps.indexOf(this.stepId));
  }

  get step() {
    return this.stepId;
  }

  /** Slots belonging to a picker step, with the current selections. */
  #slotsFor(source) {
    return this.slots.filter(s => s.source === source);
  }

  #remainingFor(source) {
    return picksRemaining(this.#slotsFor(source), this.draft.choices);
  }

  /* -------------------------------------------- */
  /*  Rendering                                   */
  /* -------------------------------------------- */

  /** @override */
  async _prepareContext(options) {
    this.catalogData ??= await this.catalog.build();
    const steps = this.steps;
    // If the current choice step has nothing left to ask, fall back to the picker it belongs to.
    if ( !steps.includes(this.stepId) ) this.stepId = CHOICE_STEPS[this.stepId] ?? steps[0];
    const step = this.step;
    const choiceSource = CHOICE_STEPS[step];
    const context = {
      rules: this.rules,
      step,
      stepLabel: `CHARWIZ.Steps.${step}`,
      steps: steps.map((id, index) => ({
        id, index,
        label: `CHARWIZ.Steps.${id}`,
        icon: STEP_ICONS[id],
        active: id === step,
        sub: id in CHOICE_STEPS,
        done: (id in CHOICE_STEPS) ? (this.#remainingFor(CHOICE_STEPS[id]) === 0) : !!this.#pickFor(id)
      })),
      isPicker: step in PICKER_STEPS,
      isChoices: !!choiceSource,
      isDetails: step === "details",
      isReview: step === "review",
      isPending: ["abilities", "equipment", "spells"].includes(step),
      first: this.stepIndex === 0,
      last: this.stepIndex === steps.length - 1,
      remaining: choiceSource ? this.#remainingFor(choiceSource) : 0,
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

    if ( context.isChoices ) {
      context.itemName = this.draft.picks[choiceSource]?.name;
      context.slots = this.#slotsFor(choiceSource).map(slot => this.#prepareSlot(slot));
      context.info = this.inspected ? await this.#describe(this.inspected) : null;
    }

    if ( context.isReview ) {
      context.summary = Object.keys(PICKER_STEPS).filter(s => steps.includes(s)).map(s => ({
        label: `CHARWIZ.Steps.${s}`, name: this.draft.picks[s]?.name,
        choices: this.#slotsFor(s).map(slot => ({
          title: slot.title,
          picked: (this.draft.choices[slot.key] ?? [])
            .map(v => slot.options.find(o => o.value === v)?.label ?? v).join(", ")
        })).filter(c => c.picked)
      }));
      context.deferred = this.deferred;
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

  /** Slot data for the template: selection state and a progress label. */
  #prepareSlot(slot) {
    const selected = this.draft.choices[slot.key] ?? [];
    const optional = slot.count === 0;
    return {
      ...slot,
      progress: optional
        ? game.i18n.format("CHARWIZ.Choices.Optional", { selected: selected.length, max: slot.max })
        : game.i18n.format("CHARWIZ.Choices.Progress", { selected: selected.length, count: slot.count }),
      complete: selected.length >= slot.count,
      options: slot.options.map(o => ({
        ...o,
        selected: selected.includes(o.value),
        inspected: !!o.uuid && (o.uuid === this.inspected)
      }))
    };
  }

  /** Name, image and enriched description for an item option (cached). */
  async #describe(uuid) {
    if ( this.descriptions.has(uuid) ) return this.descriptions.get(uuid);
    const item = await fromUuid(uuid);
    if ( !item ) return null;
    const TextEditor = foundry.applications.ux.TextEditor.implementation;
    const info = {
      name: item.name, img: item.img,
      description: await TextEditor.enrichHTML(item.system.description?.value ?? "", { relativeTo: item })
    };
    this.descriptions.set(uuid, info);
    return info;
  }

  /**
   * Re-simulate the picks to find which choices they ask for. Selections that no longer fit are dropped,
   * and the simulation repeats until nothing changes, since a choice can grant a feature with choices of its own.
   */
  async #refreshSlots() {
    const token = ++this.refreshToken;
    try {
      for ( let pass = 0; pass < 4; pass++ ) {
        const { slots, deferred } = await discoverSlots({
          actor: this.actor, picks: this.draft.picks, selections: this.draft.choices, catalog: this.catalogData
        });
        if ( token !== this.refreshToken ) return;
        const pruned = pruneSelections(slots, this.draft.choices);
        const changed = Object.keys(pruned).length !== Object.keys(this.draft.choices).length
          || Object.entries(pruned).some(([k, v]) => v.length !== this.draft.choices[k]?.length);
        this.slots = slots;
        this.deferred = deferred;
        this.draft.choices = pruned;
        if ( !changed ) break;
      }
    } catch(err) {
      console.error(`${MODULE_ID} | Could not work out the choices for these picks`, err);
      ui.notifications.warn("CHARWIZ.Notify.ChoicesFailed", { localize: true });
      this.slots = [];
      this.deferred = [];
    }
  }

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
    const steps = this.steps;
    this.stepId = steps[Math.clamp(index, 0, steps.length - 1)];
    this.query = "";
    this.inspected = null;
    this.focused = this.draft.picks[this.step]?.uuid ?? null;
    this.render();
  }

  static #onGoto(event, target) {
    this.#setStep(Number(target.dataset.index));
  }

  /**
   * Next: if an option is highlighted but "Choose" wasn't clicked, take it as the choice.
   * (Only the Next button does this — jumping via the step list leaves picks untouched.)
   */
  static async #onNext() {
    if ( (this.step in PICKER_STEPS) && this.focused && (this.focused !== this.draft.picks[this.step]?.uuid) ) {
      if ( this.#pick(this.focused) ) await this.#refreshSlots();
    }
    if ( CHOICE_STEPS[this.step] && this.#remainingFor(CHOICE_STEPS[this.step]) ) return;
    this.#setStep(this.stepIndex + 1);
  }

  static #onBack() {
    this.#setStep(this.stepIndex - 1);
  }

  static #onFocus(event, target) {
    this.focused = target.dataset.uuid;
    this.render({ parts: ["body"] });
  }

  static async #onChoose(event, target) {
    if ( !this.#pick(target.dataset.uuid) ) return;
    await this.#refreshSlots();
    this.render();
  }

  /** Select or deselect an option in a choice slot, and show its description. */
  static async #onToggle(event, target) {
    const slot = this.slots.find(s => s.key === target.dataset.slot);
    if ( !slot ) return;
    const { value, uuid } = target.dataset;
    this.draft.choices[slot.key] = toggleSelection(slot, this.draft.choices, value);
    this.inspected = uuid || null;
    await this.#refreshSlots();
    this.render();
  }

  /**
   * Record a pick for the current step.
   * @param {string} uuid
   * @returns {boolean} Whether the pick was valid.
   */
  #pick(uuid) {
    const entry = this.catalogData.byType[PICKER_STEPS[this.step]]?.find(e => e.uuid === uuid);
    if ( !entry ) return false;
    if ( this.draft.picks[this.step]?.uuid !== uuid ) {
      // A different pick invalidates every choice made for the old one.
      for ( const key of Object.keys(this.draft.choices) ) {
        if ( key.startsWith(`${this.step}:`) ) delete this.draft.choices[key];
      }
    }
    this.draft.picks[this.step] = { uuid, name: entry.name, identifier: entry.identifier };
    return true;
  }
}
