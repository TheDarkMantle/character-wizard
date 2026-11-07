import { MODULE_ID, STEP_ORDER, TEMPLATE_PATH } from "../constants.mjs";
import { worldRules } from "../content/catalog.mjs";
import { groupSpecies, searchEntries } from "../content/catalog-logic.mjs";
import { buildBoard } from "../advancement/read.mjs";
import { traitOptionLabel } from "../advancement/naming.mjs";
import { blockedLanguageKeys } from "../content/languages.mjs";
import { bodyLines } from "../content/species-info.mjs";
import { customArray, getSetting } from "../settings.mjs";
import { describeNode, fixedGold, GOLD, isModernStyle, planEquipment } from "../equipment/starting.mjs";
import { pickCandidates } from "../equipment/gear.mjs";
import { backgroundFeature } from "../content/background-feature.mjs";
import { describedItems } from "../equipment/described.mjs";
import {
  BIO_KINDS, BIO_MAX, classifyTable, composeValue, entryForRoll, rollFormula as tableRollFormula, tableEntries, tableLinks, togglePick
} from "../content/background-tables.mjs";
import { inventoryItems, packContents, resolveInventory } from "../equipment/inventory.mjs";
import {
  adjustPointBuy, breakdown, isComplete, METHODS, modifier, POINT_BUY, pointBuySpent, remainingValues, rollFormula,
  STANDARD_ARRAY
} from "../abilities/scores.mjs";
import { discoverSlots, runPicks } from "../advancement/simulate.mjs";
import { spellItems } from "../spells/builder.mjs";
import {
  adjustPoints, createBlocker, picksRemaining, pruneSelections, tally, toggleSelection
} from "../advancement/slots.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/** Wizard steps that pick an item from the catalog, mapped to the catalog bucket (item type). */
const PICKER_STEPS = Object.freeze({ class: "class", species: "race", background: "background" });

/** Choice steps, inserted after a picker step when its pick asks for decisions. Mapped to that picker step. */
const CHOICE_STEPS = Object.freeze({
  classChoices: "class", speciesChoices: "species", backgroundChoices: "background"
});
const choiceStepFor = source => Object.keys(CHOICE_STEPS).find(id => CHOICE_STEPS[id] === source);

/** The spells step is a choice step of its own: it is in the step order already and only shows for a spellcaster. */
const SPELLS_STEP = "spells";

/** Which slot source a choice step shows, or undefined for steps that aren't choice steps. */
const choiceSourceOf = step => (step === SPELLS_STEP ? SPELLS_STEP : CHOICE_STEPS[step]);

/** Icons for the step list. */
const STEP_ICONS = Object.freeze({
  class: "fa-shield-halved", species: "fa-person", background: "fa-scroll", abilities: "fa-dice-d20",
  equipment: "fa-sack", spells: "fa-wand-sparkles", details: "fa-feather", review: "fa-clipboard-check",
  classChoices: "fa-list-check", speciesChoices: "fa-list-check", backgroundChoices: "fa-list-check",
  ideals: "fa-heart", personality: "fa-masks-theater"
});

/** Steps that fill in the character's personality and biography details. */
const BIO_STEPS = Object.freeze({ ideals: ["ideal", "bond", "flaw"], personality: ["trait"] });

/** Plain text fields of the last details step, as `system.details` keys. */
const DETAIL_FIELDS = Object.freeze(["age", "height", "weight", "gender", "eyes", "hair", "skin", "faith"]);

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
    this.draft = { name: actor?.name ?? "", picks: {}, choices: {}, abilities: { method: "standard", scores: {}, rolled: null } };
    /** Personality, alignment and the details fields. Picks are entry numbers in the background's tables. */
    this.draft.bio = {
      picks: Object.fromEntries(BIO_KINDS.map(k => [k, []])),
      other: Object.fromEntries(BIO_KINDS.map(k => [k, ""])),
      alignment: "",
      fields: Object.fromEntries([...DETAIL_FIELDS, "appearance"].map(k => [k, ""]))
    };
    /** The background's roll tables by background UUID. */
    this.bioTableCache = new Map();
    /** Ability scores after the species and background bonuses, from the last simulation. */
    this.finals = {};
    /** What the player decided about starting equipment, per source (class, background). */
    this.draft.equipment = { class: {}, background: {} };
    /** Class and background equipment data by UUID, and the gear catalog, loaded when first needed. */
    this.equipmentSources = new Map();
    /** What each pack holds, by UUID, so the choices can list it. */
    this.packContentsCache = new Map();
    this.gear = null;
    this.query = "";
    this.focused = null;
    /** Species groups the player has opened, and the pick last revealed in its group. */
    this.expanded = new Set();
    this.revealed = null;
    /** Slot keys the player has changed, so their standard answer isn't put back. */
    this.touched = new Set();
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
      group: CharacterWizard.#onGroup,
      choose: CharacterWizard.#onChoose,
      toggle: CharacterWizard.#onToggle,
      inspect: CharacterWizard.#onInspect,
      adjust: CharacterWizard.#onAdjust,
      resetPoints: CharacterWizard.#onResetPoints,
      abilityMethod: CharacterWizard.#onAbilityMethod,
      rollGold: CharacterWizard.#onRollGold,
      abilityPoint: CharacterWizard.#onAbilityPoint,
      abilityRoll: CharacterWizard.#onAbilityRoll,
      bioPick: CharacterWizard.#onBioPick,
      bioRoll: CharacterWizard.#onBioRoll,
      create: CharacterWizard.#onCreate
    }
  };

  static PARTS = {
    steps: { template: `${TEMPLATE_PATH}/wizard/steps.hbs` },
    body: { template: `${TEMPLATE_PATH}/wizard/body.hbs`, scrollable: [".charwiz-list", ".charwiz-slots", ".charwiz-preview", ".charwiz-abilities", ".charwiz-bio"] },
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
      if ( id === SPELLS_STEP ) return withChoices.has(SPELLS_STEP) ? [id] : [];
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

  /* -------------------------------------------- */
  /*  Starting equipment                          */
  /* -------------------------------------------- */

  /** Gear from every enabled compendium, loaded the first time the equipment step needs it. */
  async #gearList() {
    this.gear ??= await this.catalog.gear();
    return this.gear;
  }

  /** The GM's compendium order and which compendiums are offered under any rules version. */
  #sourceOrder() {
    const sources = getSetting("contentSources");
    return {
      packOrder: Object.entries(sources).sort(([, a], [, b]) => (a.priority ?? 0) - (b.priority ?? 0)).map(([id]) => id),
      anyRulesPacks: Object.entries(sources).filter(([, source]) => source.anyRules).map(([id]) => id)
    };
  }

  /** A class' or background's starting equipment data, cached by UUID. */
  async #equipmentSource(step) {
    const pick = this.draft.picks[step];
    if ( !pick ) return null;
    if ( !this.equipmentSources.has(pick.uuid) ) {
      const item = await fromUuid(pick.uuid);
      let source = item ? {
        name: item.name,
        entries: item.toObject().system.startingEquipment ?? [],
        wealth: item.system.wealth ?? "",
        rules: item.system.source?.rules ?? "",
        description: item.system.description?.value ?? ""
      } : null;
      if ( source && (step === "background") ) source = await this.#withPouchGold(source);
      this.equipmentSources.set(pick.uuid, source);
    }
    return this.equipmentSources.get(pick.uuid);
  }

  /**
   * A 2014 background's gold is the pouch it starts with ("a pouch containing 10 gp"), never an alternative to the
   * equipment. The system's own backgrounds carry it as a coin pouch item, but others (D&D Beyond imports) only set
   * the amount as `wealth`. If nothing else gives the money, the amount becomes a gold entry.
   */
  async #withPouchGold(source) {
    if ( isModernStyle({ rules: source.rules, worldRules: this.rules }) ) return source;
    const amount = fixedGold(source.wealth);
    if ( !amount ) return source;
    if ( source.entries.some(e => e.type === "currency") ) return { ...source, wealth: "" };
    for ( const entry of source.entries.filter(e => (e.type === "linked") && e.key) ) {
      const linked = await fromUuid(entry.key);
      if ( Object.values(linked?.system?.currency ?? {}).some(v => v > 0) ) return { ...source, wealth: "" };
    }
    const pouch = { _id: "charwiz-pouch", type: "currency", key: "gp", count: amount, group: "", sort: 1e9, requiresProficiency: false };
    return { ...source, wealth: "", entries: [...source.entries, pouch] };
  }

  /**
   * The background's feature when it only exists as text in the description: a 2014 background with no feature item to
   * grant (imports from D&D Beyond). Null when the system grants it, or the description has none.
   */
  async #descriptionFeature() {
    const pick = this.draft.picks.background;
    const item = pick && await fromUuid(pick.uuid);
    if ( !item || isModernStyle({ rules: item.system.source?.rules, worldRules: this.rules }) ) return null;
    if ( item.advancement?.byType?.ItemGrant?.length ) return null;
    const feature = backgroundFeature(item.system.description?.value);
    return feature && { ...feature, img: item.img, uuid: item.uuid };
  }

  /** What the class and background ask about equipment, given what the player has decided so far. */
  async #equipmentPlans() {
    const plans = {};
    let ready = true;
    for ( const step of ["class", "background"] ) {
      const source = await this.#equipmentSource(step);
      if ( !source ) continue;
      const modern = isModernStyle({ rules: source.rules, worldRules: this.rules });
      const state = this.draft.equipment[step];
      const plan = planEquipment({ entries: source.entries, wealth: source.wealth, modern, state });
      plans[step] = { source, plan, state, modern };
      if ( !plan.complete ) ready = false;
    }
    return { plans, ready };
  }

  /** Packs inside an equipment option (the Explorer's Pack of "a dungeoneer's pack or an explorer's pack"), with what they hold. */
  async #packsIn(node) {
    const found = [];
    const walk = n => {
      if ( n.type === "linked" ) {
        const doc = fromUuidSync(n.key);
        if ( doc?.type === "container" ) found.push({ uuid: n.key, name: doc.name });
      }
      n.children?.forEach(walk);
    };
    walk(node);
    const packs = [];
    for ( const { uuid, name } of found ) {
      if ( !this.packContentsCache.has(uuid) ) {
        this.packContentsCache.set(uuid, await packContents(uuid, {
          gear: await this.#gearList(), rules: this.rules, packOrder: this.#sourceOrder().packOrder
        }));
      }
      const { children } = this.packContentsCache.get(uuid);
      if ( children.length ) {
        packs.push({ name, items: children.map(c => `${(c.quantity > 1) ? `${c.quantity}× ` : ""}${c.name}`).join(", ") });
      }
    }
    return packs;
  }

  /** "any martial melee weapon", "shield", "gaming set": what a category entry stands for. */
  #categoryPhrase(category, key) {
    const text = value => game.i18n.localize(typeof value === "string" ? value : (value?.label ?? "")).toLowerCase();
    const has = (label, word) => label.includes(word);
    switch ( category ) {
      case "weapon": {
        const label = text(CONFIG.DND5E.weaponTypes[key] ?? CONFIG.DND5E.weaponProficiencies[key]);
        return !label ? game.i18n.localize("CHARWIZ.Equipment.Weapon") : (has(label, "weapon") ? label : `${label} ${game.i18n.localize("CHARWIZ.Equipment.Weapon")}`);
      }
      case "armor": {
        const label = text(CONFIG.DND5E.armorTypes[key]);
        return !label ? game.i18n.localize("CHARWIZ.Equipment.Armor") : ((key === "shield" || has(label, "armor")) ? label : `${label} ${game.i18n.localize("CHARWIZ.Equipment.Armor")}`);
      }
      case "tool": return text(CONFIG.DND5E.toolTypes[key]) || game.i18n.localize("CHARWIZ.Equipment.Tool");
      default: return text(CONFIG.DND5E.focusTypes[key]?.label) || game.i18n.localize("CHARWIZ.Equipment.Focus");
    }
  }

  /** A short description of one entry: a named item with its count, a currency amount, or a category. */
  #leafLabel(node) {
    const times = (node.count > 1) ? `${node.count}× ` : "";
    if ( node.type === "linked" ) return `${times}${fromUuidSync(node.key)?.name ?? game.i18n.localize("CHARWIZ.Equipment.UnknownItem")}`;
    if ( node.type === "currency" ) return `${node.count} ${(CONFIG.DND5E.currencies[node.key]?.abbreviation ?? node.key).toUpperCase()}`;
    const phrase = this.#categoryPhrase(node.type, node.key);
    return (node.count > 1) ? `${times}${phrase}` : game.i18n.format("CHARWIZ.Equipment.AnyOf", { kind: phrase });
  }

  /** Items a category entry can be filled with. Foci come from the system's list; everything else from the catalog. */
  async #pickOptions(category, key) {
    if ( category === "focus" ) {
      const types = key ? [CONFIG.DND5E.focusTypes[key]] : Object.values(CONFIG.DND5E.focusTypes);
      return types.flatMap(t => Object.values(t?.itemIds ?? {})).map(uuid => ({ uuid, name: fromUuidSync(uuid)?.name ?? uuid }))
        .sort((a, b) => a.name.localeCompare(b.name));
    }
    const { packOrder, anyRulesPacks } = this.#sourceOrder();
    return pickCandidates(await this.#gearList(), {
      category, key, rules: this.rules, untagged: getSetting("untaggedContent"), packOrder, anyRulesPacks
    }).map(g => ({ uuid: g.uuid, name: g.name }));
  }

  /** Everything the chosen equipment adds to the character: item lines (packs opened up) and money. */
  async #inventory(eq) {
    const grants = [];
    const currency = {};
    const picked = new Map();
    for ( const { plan } of Object.values(eq.plans) ) {
      for ( const grant of plan.grants ) {
        if ( grant.type === "item" ) grants.push({ uuid: grant.uuid, count: grant.count, counted: grant.counted });
        else if ( grant.type === "pick" ) for ( const uuid of grant.picked ) picked.set(uuid, (picked.get(uuid) ?? 0) + 1);
        else if ( grant.type === "currency" ) currency[grant.key] = (currency[grant.key] ?? 0) + grant.count;
      }
      if ( plan.gold?.amount ) currency.gp = (currency.gp ?? 0) + plan.gold.amount;
    }
    // Two of the same pick are two pieces; one keeps the item's own quantity.
    for ( const [uuid, count] of picked ) grants.push({ uuid, count, counted: count > 1 });
    const lines = await resolveInventory(grants, {
      gear: await this.#gearList(), rules: this.rules, packOrder: this.#sourceOrder().packOrder
    });
    return { lines, currency };
  }

  /**
   * Things a 2014 background's text lists that the wizard can't add: a trinket, a letter, a token. They have no item to
   * link, and guessing items out of prose adds junk, so the player is reminded to add them by hand.
   * @returns {string[]}
   */
  #manualGear(eq, { lines }) {
    const background = eq.plans.background;
    if ( !background || background.modern || background.plan.gold ) return [];
    const have = lines.flatMap(l => [l.name, ...(l.children ?? []).map(c => c.name)]);
    return describedItems(background.source.description, have).map(i => i.name);
  }

  /** "12 items and 15 gp", for the Review step. */
  #inventoryLine({ lines, currency }) {
    const items = lines.reduce((n, l) => n + 1 + (l.children?.length ?? 0), 0);
    const money = Object.entries(currency).filter(([, v]) => v)
      .map(([k, v]) => `${v} ${(CONFIG.DND5E.currencies[k]?.abbreviation ?? k).toUpperCase()}`).join(", ");
    return items || money ? game.i18n.format("CHARWIZ.Equipment.Summary", { items, money: money || "—" }) : "";
  }

  /** Packs whose contents couldn't be worked out, so the player knows to check the sheet. */
  #inventoryNotes({ lines }) {
    return lines.flatMap(line => {
      if ( line.missing ) return [game.i18n.format("CHARWIZ.Equipment.NoteMissing", { name: line.name })];
      if ( line.source === "none" ) return [game.i18n.format("CHARWIZ.Equipment.NoteEmpty", { name: line.name })];
      if ( line.unresolved?.length ) {
        return [game.i18n.format("CHARWIZ.Equipment.NoteUnmatched", { name: line.name, items: line.unresolved.join(", ") })];
      }
      return [];
    });
  }

  /** Everything the equipment step shows: each source's choices, what's in the inventory, and gold. */
  async #equipmentContext(eq) {
    const list = game.i18n.getListFormatter({ type: "conjunction" });
    const either = game.i18n.getListFormatter({ type: "disjunction" });
    const join = (items, joiner) => (joiner === "or" ? either : list).format(items);
    const sections = [];

    for ( const [step, { source, plan, state, modern }] of Object.entries(eq.plans) ) {
      const fixed = fixedGold(source.wealth) !== null;
      const goldLabel = fixed
        ? game.i18n.format("CHARWIZ.Equipment.GoldFixed", { amount: fixedGold(source.wealth) })
        : game.i18n.format("CHARWIZ.Equipment.GoldRoll", { formula: source.wealth });

      const decisions = await Promise.all(plan.decisions.map(async decision => {
        const options = await Promise.all(decision.options.map(async (option, index) => ({
          id: option.id, letter: modern ? "ABCDEFGH"[index] : "", checked: decision.selected === option.id,
          label: describeNode(option, node => this.#leafLabel(node), join),
          packs: await this.#packsIn(option)
        })));
        if ( decision.includesGold ) {
          options.push({ id: GOLD, letter: modern ? "ABCDEFGH"[options.length] : "", checked: !!state.gold, label: goldLabel });
        }
        return { source: step, id: decision.id, options };
      }));

      const picks = [];
      for ( const grant of plan.grants.filter(g => g.type === "pick") ) {
        const choices = await this.#pickOptions(grant.category, grant.key);
        picks.push({
          source: step, leafId: grant.leafId, label: this.#categoryPhrase(grant.category, grant.key),
          selects: Array.from({ length: grant.need }, (_, index) => ({
            index,
            options: choices.map(c => ({ ...c, selected: c.uuid === state.picks?.[grant.leafId]?.[index] }))
          }))
        });
      }

      sections.push({
        step,
        title: game.i18n.format("CHARWIZ.Equipment.From", { source: game.i18n.localize(`CHARWIZ.Steps.${step}`), name: source.name }),
        empty: !source.entries.length && !source.wealth,
        decisions,
        picks,
        // 2014 equipment is a list with its own choices, so gold is a separate switch rather than an option.
        goldToggle: (!modern && plan.goldFormula) ? { checked: !!state.gold, label: game.i18n.format("CHARWIZ.Equipment.GoldInstead", { formula: source.wealth }) } : null,
        goldRoll: (state.gold && plan.gold && !plan.gold.fixed)
          ? { amount: state.goldAmount ?? null, formula: source.wealth, canRoll: state.goldAmount === undefined } : null
      });
    }

    const inventory = await this.#inventory(eq);
    return {
      sections,
      hasSections: sections.length > 0,
      lines: inventory.lines.map(l => ({
        name: l.name, img: l.img, countLabel: (l.quantity > 1) ? `${l.quantity}× ` : "", missing: l.missing,
        children: (l.children ?? []).map(c => ({ name: c.name, countLabel: (c.quantity > 1) ? `${c.quantity}× ` : "" })),
        unresolved: (l.unresolved ?? []).join(", ")
      })),
      money: Object.entries(inventory.currency).filter(([, v]) => v)
        .map(([k, v]) => `${v} ${(CONFIG.DND5E.currencies[k]?.abbreviation ?? k).toUpperCase()}`).join(", "),
      notes: this.#inventoryNotes(inventory)
    };
  }

  /** An option picked in an OR choice, or "gold" instead. */
  async #chooseEquipment({ source, decision, option }) {
    const state = this.draft.equipment[source];
    if ( option === GOLD ) state.gold = true;
    else {
      state.gold = false;
      state.or = { ...(state.or ?? {}), [decision]: option };
    }
    this.render();
  }

  /** The 2014-style switch for starting gold instead of equipment. */
  async #takeGold(source, checked) {
    this.draft.equipment[source].gold = checked;
    this.render();
  }

  /** An item chosen from a category's dropdown. */
  async #pickEquipment({ source, leaf, index, need }, uuid) {
    const state = this.draft.equipment[source];
    const list = Array.from({ length: Number(need) }, (_, i) => state.picks?.[leaf]?.[i] ?? "");
    list[Number(index)] = uuid;
    state.picks = { ...(state.picks ?? {}), [leaf]: list };
    this.render();
  }

  /** Roll the gold formula once, through chat so everyone sees it and 3D dice animate. */
  static async #onRollGold(event, target) {
    const { source } = target.dataset;
    const state = this.draft.equipment[source];
    const data = await this.#equipmentSource(source);
    if ( !data?.wealth || (state.goldAmount !== undefined) ) return;
    target.disabled = true;
    const roll = await new Roll(data.wealth).evaluate();
    await this.#postRolls([roll], game.i18n.format("CHARWIZ.Equipment.GoldFlavor", { formula: data.wealth }), `<p>${roll.total} gp</p>`);
    state.goldAmount = roll.total;
    this.render();
  }

  /**
   * Post rolls to chat as one message, so everyone sees them and a 3D dice module animates them, then wait for the
   * dice to land. If the message can't be posted the rolls still count.
   */
  async #postRolls(rolls, flavor, content) {
    try {
      const data = {
        speaker: ChatMessage.getSpeaker({ actor: this.actor }), flavor, content, rolls, sound: CONFIG.sounds.dice
      };
      ChatMessage.implementation.applyRollMode?.(data, game.settings.get("core", "rollMode"));
      const message = await ChatMessage.implementation.create(data);
      await game.dice3d?.waitFor3DAnimationByMessageID?.(message.id);
    } catch(err) {
      console.warn(`${MODULE_ID} | Could not post a roll to chat`, err);
    }
  }

  /** Everything the ability scores step shows: methods, the table of scores, and what each method needs. */
  #abilitiesContext() {
    const ids = this.#abilityIds;
    const { method, scores, rolled } = this.draft.abilities;
    const array = this.#abilityArray();
    const sign = n => (n === undefined) ? "" : (n >= 0 ? `+${n}` : `${n}`);
    const isArray = ["standard", "custom", "roll"].includes(method);
    const spent = pointBuySpent(scores, ids);

    const rows = breakdown(scores, this.finals, ids).map(row => {
      const config = CONFIG.DND5E.abilities[row.id];
      const value = scores[row.id];
      return {
        ...row,
        label: config.label,
        bonusLabel: row.bonus ? sign(row.bonus) : "",
        modLabel: sign(row.mod),
        isSelect: isArray,
        isPoints: method === "pointbuy",
        isNumber: method === "manual",
        value: value ?? (method === "pointbuy" ? POINT_BUY.min : ""),
        options: isArray ? remainingValues(array, scores, ids, row.id).map(v => ({ value: v, selected: v === value })) : [],
        canUp: (method === "pointbuy") && (adjustPointBuy(scores, row.id, 1, ids) !== scores),
        canDown: (method === "pointbuy") && (adjustPointBuy(scores, row.id, -1, ids) !== scores)
      };
    });

    return {
      methods: this.#abilityMethods().map(id => ({
        id, active: id === method, label: `CHARWIZ.Abilities.Method.${id}`
      })),
      hint: game.i18n.format(`CHARWIZ.Abilities.Hint.${method}`, {
        values: array.join(", "), budget: POINT_BUY.budget, min: POINT_BUY.min, max: POINT_BUY.max
      }),
      rows,
      isRoll: method === "roll",
      isPointBuy: method === "pointbuy",
      rolled: rolled?.length ? rolled.join(", ") : "",
      hasRolled: !!rolled?.length,
      formula: rollFormula(getSetting("rerollOnes")),
      pointsLeft: POINT_BUY.budget - spent,
      budget: POINT_BUY.budget,
      hasBonus: rows.some(r => r.bonus)
    };
  }

  /** A typed or picked ability score. Blank clears it. */
  async #setScore(id, raw) {
    const value = (raw === "") ? undefined : Number(raw);
    const { scores } = this.draft.abilities;
    if ( Number.isInteger(value) ) scores[id] = value;
    else delete scores[id];
    await this.#refreshSlots();
    this.render();
  }

  /** The picker steps in the order the wizard shows them, which is the order choices are checked in. */
  #pickOrder() {
    return STEP_ORDER[this.rules].filter(id => id in PICKER_STEPS);
  }

  /** Slots belonging to a picker step, with the current selections. */
  #slotsFor(source) {
    return this.slots.filter(s => s.source === source);
  }

  /** The abilities the wizard sets: the six core ones the system has. */
  get #abilityIds() {
    return ["str", "dex", "con", "int", "wis", "cha"].filter(id => id in CONFIG.DND5E.abilities);
  }

  /** Methods on offer. The custom array only appears when the GM has turned it on and entered a usable one. */
  #abilityMethods() {
    return METHODS.filter(id => (id !== "custom") || customArray());
  }

  /** The values to assign for an array method: the standard array, the GM's array, or the player's roll. */
  #abilityArray() {
    switch ( this.draft.abilities.method ) {
      case "standard": return [...STANDARD_ARRAY];
      case "custom": return customArray() ?? [];
      case "roll": return this.draft.abilities.rolled ?? [];
      default: return [];
    }
  }

  #abilitiesReady() {
    const { method, scores } = this.draft.abilities;
    return this.#abilityMethods().includes(method) && isComplete(method, scores, this.#abilityIds, this.#abilityArray());
  }

  /** Base scores to give the engine: the finished set, or whatever has been entered so far. */
  #baseScores() {
    return Object.fromEntries(Object.entries(this.draft.abilities.scores).filter(([id, v]) => Number.isInteger(v)
      && this.#abilityIds.includes(id)));
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
    const choiceSource = choiceSourceOf(step);
    const eq = await this.#equipmentPlans();
    this.bioTables = await this.#bioTables();
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
        done: (choiceSourceOf(id)) ? (this.#remainingFor(choiceSourceOf(id)) === 0)
          : (id === "equipment") ? (eq.ready && !!this.draft.picks.class) : !!this.#pickFor(id)
      })),
      isPicker: step in PICKER_STEPS,
      isChoices: !!choiceSource,
      isDetails: step === "details",
      isBio: step in BIO_STEPS,
      isReview: step === "review",
      isAbilities: step === "abilities",
      isEquipment: step === "equipment",
      first: this.stepIndex === 0,
      last: this.stepIndex === steps.length - 1,
      draft: this.draft,
      query: this.query
    };

    // What stops Next on this step, if anything.
    const remaining = choiceSource ? this.#remainingFor(choiceSource) : 0;
    context.blockLabel = remaining ? game.i18n.format("CHARWIZ.Choices.Left", { count: remaining })
      : ((step === "abilities") && !this.#abilitiesReady()) ? game.i18n.localize("CHARWIZ.Abilities.Incomplete")
        : ((step === "equipment") && !eq.ready) ? game.i18n.localize("CHARWIZ.Equipment.Incomplete") : "";
    context.blocked = !!context.blockLabel;

    if ( context.isBio ) context.bio = await this.#bioContext(step);
    if ( context.isDetails ) context.details = this.#detailsContext();
    if ( context.isAbilities ) context.abilities = this.#abilitiesContext();
    if ( context.isEquipment ) context.equipment = await this.#equipmentContext(eq);

    if ( context.isPicker ) {
      const picked = this.draft.picks[step]?.uuid;
      context.rows = this.#pickerRows(step, picked);
      context.preview = this.focused ? await this.#loadPreview(this.focused) : null;
      context.previewPicked = !!context.preview && context.preview.uuid === picked;
    }

    if ( context.isChoices ) {
      context.itemName = this.draft.picks[(choiceSource === SPELLS_STEP) ? "class" : choiceSource]?.name;
      context.slots = this.#slotsFor(choiceSource).map(slot => this.#prepareSlot(slot));
      context.info = null;
      if ( this.inspected ) {
        const info = await this.#describe(this.inspected);
        const slot = this.slots.find(s => s.key === this.inspected.slotKey);
        // Items, traits, sizes and the like can be chosen from the panel. Point controls can't.
        context.info = info && {
          ...info,
          canChoose: !!slot && (slot.kind !== "asi") && !slot.options.find(o => o.value === this.inspected.value)?.disabled,
          slotKey: slot?.key,
          value: this.inspected.value,
          selected: !!slot && (this.draft.choices[slot.key] ?? []).includes(this.inspected.value)
        };
      }
    }

    if ( context.isReview ) {
      context.summary = Object.keys(PICKER_STEPS).filter(s => steps.includes(s)).map(s => ({
        label: `CHARWIZ.Steps.${s}`, name: this.draft.picks[s]?.name,
        choices: this.#slotsFor(s).map(slot => ({
          title: slot.title,
          picked: this.#summarize(slot)
        })).filter(c => c.picked)
      }));
      const spellSlots = this.#slotsFor(SPELLS_STEP);
      if ( spellSlots.length ) {
        context.summary.push({
          label: `CHARWIZ.Steps.${SPELLS_STEP}`, name: this.draft.picks.class?.name,
          choices: spellSlots.map(slot => ({ title: slot.title, picked: this.#summarize(slot) })).filter(c => c.picked)
        });
      }
      const feature = await this.#descriptionFeature();
      if ( feature ) {
        const entry = context.summary.find(s => s.label === "CHARWIZ.Steps.background");
        entry?.choices.push({ title: game.i18n.localize("CHARWIZ.Review.Feature"), picked: feature.name });
      }
      context.bioLines = [
        ...(this.draft.bio.alignment ? [{ label: game.i18n.localize("CHARWIZ.Bio.alignment"),
          value: game.i18n.localize(CONFIG.DND5E.alignments?.[this.draft.bio.alignment] ?? "") }] : []),
        ...BIO_KINDS.map(kind => ({ label: game.i18n.localize(`CHARWIZ.Bio.${kind}`), value: this.#bioValue(kind, this.bioTables ?? {}) }))
      ].filter(l => l.value).map(l => ({ ...l, value: l.value.replace(/\n/g, " / ") }));
      context.deferred = this.deferred;
      const inventory = await this.#inventory(eq);
      context.manualGear = this.#manualGear(eq, inventory);
      context.equipmentLine = this.#inventoryLine(inventory);
      context.equipmentNotes = this.#inventoryNotes(inventory);
      context.abilityLine = this.#abilitiesReady()
        ? this.#abilityIds.map(id => {
          const final = this.finals[id] ?? this.draft.abilities.scores[id];
          const mod = modifier(final);
          return `${CONFIG.DND5E.abilities[id].abbreviation?.toUpperCase() ?? id.toUpperCase()} ${final} (${mod >= 0 ? "+" : ""}${mod})`;
        }).join(" · ") : "";
      const blocker = createBlocker({
        picks: this.draft.picks, slots: this.slots, selections: this.draft.choices, canCreate: this.#canCreate(),
        abilitiesReady: this.#abilitiesReady(), equipmentReady: eq.ready
      });
      context.blocker = blocker ? `CHARWIZ.Create.Blocked.${blocker}` : null;
      context.createLabel = this.actor ? "CHARWIZ.Create.Build" : "CHARWIZ.Create.Button";
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
    // Personality and details: free text and the alignment.
    for ( const field of this.element.querySelectorAll("[data-bio-other]") ) {
      field.addEventListener("change", () => { this.draft.bio.other[field.dataset.bioOther] = field.value; });
    }
    for ( const field of this.element.querySelectorAll("[data-bio-field]") ) {
      field.addEventListener("change", () => { this.draft.bio.fields[field.dataset.bioField] = field.value.trim(); });
    }
    this.element.querySelector("select[data-bio-alignment]")?.addEventListener("change", event => {
      this.draft.bio.alignment = event.target.value;
    });
    // Starting equipment: a choice between options, a pick from a category, or gold instead.
    for ( const input of this.element.querySelectorAll("input[data-eq-option]") ) {
      input.addEventListener("change", () => this.#chooseEquipment(input.dataset));
    }
    for ( const input of this.element.querySelectorAll("input[data-eq-gold]") ) {
      input.addEventListener("change", () => this.#takeGold(input.dataset.source, input.checked));
    }
    for ( const select of this.element.querySelectorAll("select[data-eq-pick]") ) {
      select.addEventListener("change", () => this.#pickEquipment(select.dataset, select.value));
    }
    // Ability scores typed in or picked from a dropdown.
    for ( const input of this.element.querySelectorAll("[data-ability-input]") ) {
      input.addEventListener("change", event => this.#setScore(input.dataset.ability, event.target.value));
    }
  }

  /* -------------------------------------------- */
  /*  Data                                        */
  /* -------------------------------------------- */

  /** What was chosen in a slot, as text. Ability score points read "Intelligence +2, Wisdom +1". */
  #summarize(slot) {
    const selected = this.draft.choices[slot.key] ?? [];
    const label = v => slot.options.find(o => o.value === v)?.label ?? v;
    if ( slot.kind === "asi" ) {
      return Object.entries(tally(selected)).map(([v, n]) => `${label(v)} +${n}`).join(", ");
    }
    return selected.map(label).join(", ");
  }

  /** Building onto an existing actor needs no permission; making a new one needs Create Actor. */
  #canCreate() {
    return !!this.actor || CONFIG.Actor.documentClass.canUserCreate(game.user);
  }

  /**
   * Rows for the picker list. Species are grouped under their base race; other lists are flat.
   * A group opens when searching, when the player clicks it, and when it holds a newly focused option.
   */
  #pickerRows(step, picked) {
    // Content from a compendium the GM allowed under any rules can be the other edition: say so.
    const mark = e => ({
      ...e, focused: e.uuid === this.focused, picked: e.uuid === picked,
      otherRules: (e.rules && (e.rules !== this.rules)) ? e.rules : ""
    });
    const list = this.catalogData.byType[PICKER_STEPS[step]];
    if ( step !== "species" ) return searchEntries(list, this.query).map(e => ({ entry: mark(e) }));

    const query = this.query.trim().toLowerCase();
    const rows = [];
    for ( const row of groupSpecies(list) ) {
      if ( !row.group ) {
        if ( searchEntries([row.entry], query).length ) rows.push({ entry: mark(row.entry) });
        continue;
      }
      // A group whose own name matches shows all its members; otherwise only the members that match.
      const members = row.group.toLowerCase().includes(query) ? row.entries : searchEntries(row.entries, query);
      if ( !members.length ) continue;
      if ( this.focused && (this.revealed !== this.focused) && row.entries.some(e => e.uuid === this.focused) ) {
        this.expanded.add(row.group);
        this.revealed = this.focused;
      }
      rows.push({
        group: row.group, count: members.length, expanded: !!query || this.expanded.has(row.group),
        containsPick: members.some(e => e.uuid === picked), entries: members.map(mark)
      });
    }
    return rows;
  }

  /** Slot data for the template: selection state and a progress label. */
  #prepareSlot(slot) {
    const selected = this.draft.choices[slot.key] ?? [];
    if ( slot.kind === "asi" ) {
      const counts = tally(selected);
      const full = selected.length >= slot.count;
      return {
        ...slot,
        asi: true,
        hint: slot.defaultSelection ? game.i18n.format("CHARWIZ.Choices.Standard", {
          default: Object.entries(tally(slot.defaultSelection))
            .map(([a, n]) => `${slot.options.find(o => o.value === a)?.label ?? a} +${n}`).join(", ")
        }) : "",
        canReset: !!slot.defaultSelection,
        progress: game.i18n.format("CHARWIZ.Choices.Points", { spent: selected.length, count: slot.count, cap: slot.cap }),
        complete: full,
        options: slot.options.map(o => ({
          ...o,
          points: counts[o.value] ?? 0,
          canRemove: !!counts[o.value],
          canAdd: !full && ((counts[o.value] ?? 0) < slot.cap),
          inspected: o.value === this.inspected?.value
        }))
      };
    }
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
        inspected: o.value === this.inspected?.value
      }))
    };
  }

  /**
   * Name, image and description for a choice option (cached): an item's own description, or for a
   * proficiency, the skill's ability or the weapon, armor or tool it names.
   * @param {{kind: string, value: string}} option
   */
  async #describe({ kind, value }) {
    const cacheKey = `${kind}:${value}`;
    if ( this.descriptions.has(cacheKey) ) return this.descriptions.get(cacheKey);
    const info = (kind === "trait") ? await this.#describeTrait(value)
      : (kind === "size") ? { name: CONFIG.DND5E.actorSizes[value]?.label ?? value, description: "" }
        : ["asi", "ability"].includes(kind) ? {
          name: CONFIG.DND5E.abilities[value]?.label ?? value, kind: game.i18n.localize("CHARWIZ.Choices.AbilityScore"),
          description: ""
        }
        : await this.#describeItem(value);
    this.descriptions.set(cacheKey, info);
    return info;
  }

  async #describeItem(uuid) {
    const item = await fromUuid(uuid);
    if ( !item ) return null;
    return {
      name: item.name, img: item.img,
      description: await this.#enrich(item.system.description?.value, item)
    };
  }

  /** Describe a trait key such as "skills:ath", "weapon:mar:longsword" or "tool:art:smith". */
  async #describeTrait(key) {
    const Trait = dnd5e.documents.Trait;
    const [category, ...rest] = key.split(":");
    const id = rest.at(-1);
    const name = Trait.keyLabel(key) || key;
    const kind = CONFIG.DND5E.traits[category]?.labels?.title ?? "";
    const info = { name, kind, description: "" };

    if ( category === "skills" ) {
      const ability = CONFIG.DND5E.abilities[CONFIG.DND5E.skills[id]?.ability]?.label;
      if ( ability ) info.description = `<p>${game.i18n.format("CHARWIZ.Choices.SkillAbility", { ability })}</p>`;
      return info;
    }
    // Weapons, armor and tools have a base item in the system compendium with the rules text.
    const ids = { weapon: CONFIG.DND5E.weaponIds, armor: CONFIG.DND5E.armorIds, tool: CONFIG.DND5E.toolIds }[category];
    let itemId = ids?.[id];
    if ( itemId && (foundry.utils.getType(itemId) === "Object") ) itemId = itemId.id;
    const item = itemId ? await Trait.getBaseItem(itemId, { fullItem: true }) : null;
    if ( item ) {
      info.img = item.img;
      info.description = await this.#enrich(item.system.description?.value, item);
    }
    return info;
  }

  async #enrich(html, relativeTo) {
    const TextEditor = foundry.applications.ux.TextEditor.implementation;
    return TextEditor.enrichHTML(await this.#withoutHiddenEmbeds(html ?? ""), { relativeTo });
  }

  /**
   * Take out `@Embed[...]` references to journal pages this user can't open. The system's SRD 5.2 backgrounds and
   * classes embed their rules text from a journal in a rules compendium; for a player who can't see that compendium
   * Foundry draws a large lock in its place.
   */
  async #withoutHiddenEmbeds(html) {
    let result = html;
    for ( const match of html.matchAll(/@Embed\[([^\]\s]+)[^\]]*\]/g) ) {
      let visible = false;
      try {
        const document = await fromUuid(match[1]);
        visible = !!document && (document.testUserPermission?.(game.user, "OBSERVER") ?? true);
      } catch(err) {
        console.warn(`${MODULE_ID} | Could not check an embedded page`, err);
      }
      if ( !visible ) result = result.replace(match[0], "");
    }
    return result;
  }

  /**
   * Re-simulate the picks to find which choices they ask for. Selections that no longer fit are dropped,
   * and the simulation repeats until nothing changes, since a choice can grant a feature with choices of its own.
   */
  async #refreshSlots() {
    const token = ++this.refreshToken;
    try {
      for ( let pass = 0; pass < 4; pass++ ) {
        const { slots, deferred, finals } = await discoverSlots({
          actor: this.actor, picks: this.draft.picks, selections: this.draft.choices, catalog: this.catalogData,
          blocked: blockedLanguageKeys(getSetting("blockedLanguages")), tashas: getSetting("tashasAbilityScores"), order: this.#pickOrder(),
          ruleset: { rules: this.rules, untagged: getSetting("untaggedContent") }, abilities: this.#baseScores()
        });
        if ( token !== this.refreshToken ) return;
        // A slot that starts on the standard answer (racial increases) begins with it chosen.
        for ( const slot of slots ) {
          if ( slot.defaultSelection && !this.touched.has(slot.key) && (this.draft.choices[slot.key] === undefined) ) {
            this.draft.choices[slot.key] = [...slot.defaultSelection];
          }
        }
        const pruned = pruneSelections(slots, this.draft.choices);
        const changed = Object.keys(pruned).length !== Object.keys(this.draft.choices).length
          || Object.entries(pruned).some(([k, v]) => v.length !== this.draft.choices[k]?.length);
        this.slots = slots;
        this.deferred = deferred;
        this.finals = finals;
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

  /**
   * The background's roll tables for personality traits, ideals, bonds and flaws, found through the links in its
   * description. Empty for a background that has none (2024 backgrounds), where the player writes their own.
   * @returns {Promise<Record<string, { name: string, entries: object[], formula: string|null }>>}
   */
  async #bioTables() {
    const pick = this.draft.picks.background;
    if ( !pick ) return {};
    if ( !this.bioTableCache.has(pick.uuid) ) {
      const found = {};
      try {
        const item = await fromUuid(pick.uuid);
        for ( const { uuid, label } of tableLinks(item?.system.description?.value) ) {
          const table = await fromUuid(uuid);
          if ( !table || (table.documentName !== "RollTable") ) continue;
          const kind = classifyTable(table.name) ?? classifyTable(label);
          if ( !kind || found[kind] ) continue;
          const entries = tableEntries(Array.from(table.results));
          if ( entries.length ) found[kind] = { name: table.name, entries, formula: tableRollFormula(table.formula, entries) };
        }
      } catch(err) {
        console.warn(`${MODULE_ID} | Could not read the background's tables`, err);
      }
      this.bioTableCache.set(pick.uuid, found);
    }
    return this.bioTableCache.get(pick.uuid);
  }

  /** The text for a sheet field: the table entries picked, then the player's own words. */
  #bioValue(kind, tables) {
    const entries = tables[kind]?.entries ?? [];
    const picked = this.draft.bio.picks[kind].map(i => entries[i]?.text).filter(Boolean);
    return composeValue(picked, this.draft.bio.other[kind]);
  }

  /** What the ideals and personality steps show: a table (if the background has one), a roll button, and "other". */
  async #bioContext(step) {
    const tables = this.bioTables ?? {};
    const localize = key => game.i18n.localize(key);
    const sections = BIO_STEPS[step].map(kind => {
      const table = tables[kind];
      const picks = this.draft.bio.picks[kind];
      return {
        kind, title: localize(`CHARWIZ.Bio.${kind}`), max: BIO_MAX[kind],
        hint: game.i18n.format(BIO_MAX[kind] > 1 ? "CHARWIZ.Bio.PickSeveral" : "CHARWIZ.Bio.PickOne", { count: BIO_MAX[kind] }),
        hasTable: !!table, tableName: table?.name, canRoll: !!table?.formula, formula: table?.formula,
        entries: (table?.entries ?? []).map(e => ({ index: e.index, label: e.label, text: e.text, selected: picks.includes(e.index) })),
        other: this.draft.bio.other[kind]
      };
    });
    const alignment = (step === "personality") ? {
      value: this.draft.bio.alignment,
      options: Object.entries(CONFIG.DND5E.alignments ?? {}).map(([id, label]) => ({
        id, label: localize(label), selected: this.draft.bio.alignment === id
      }))
    } : null;
    return { sections, alignment };
  }

  /** The text fields of the last step. */
  #detailsContext() {
    const fields = this.draft.bio.fields;
    return {
      fields: DETAIL_FIELDS.map(id => ({ id, label: `CHARWIZ.Bio.${id}`, value: fields[id] })),
      appearance: fields.appearance
    };
  }

  /**
   * The personality and biography fields to write to the sheet. Only what the player filled in is set. The biography
   * itself is left for the sheet.
   */
  #detailsData() {
    const tables = this.bioTables ?? {};
    const { fields, alignment } = this.draft.bio;
    const data = {};
    for ( const kind of BIO_KINDS ) {
      const value = this.#bioValue(kind, tables);
      if ( value ) data[kind] = value;
    }
    if ( alignment && CONFIG.DND5E.alignments?.[alignment] ) data.alignment = game.i18n.localize(CONFIG.DND5E.alignments[alignment]);
    for ( const [key, value] of Object.entries(fields) ) if ( value ) data[key] = value;
    return data;
  }

  /** Roll a table through chat and pick the entry it lands on. */
  static async #onBioRoll(event, target) {
    const { kind } = target.dataset;
    const table = (this.bioTables ?? {})[kind];
    if ( !table?.formula ) return;
    const roll = await new Roll(table.formula).evaluate();
    const entry = entryForRoll(table.entries, roll.total);
    await this.#postRolls([roll], game.i18n.format("CHARWIZ.Bio.RollFlavor", { table: table.name }),
      entry ? `<p>${roll.total}: ${foundry.utils.escapeHTML(entry.text)}</p>` : `<p>${roll.total}</p>`);
    if ( entry ) {
      const picks = this.draft.bio.picks[kind];
      this.draft.bio.picks[kind] = picks.includes(entry.index) ? picks : togglePick(picks, entry.index, BIO_MAX[kind]);
    }
    this.render({ parts: ["body", "steps"] });
  }

  /** Pick or drop an entry of a table. */
  static #onBioPick(event, target) {
    const { kind, index } = target.dataset;
    this.draft.bio.picks[kind] = togglePick(this.draft.bio.picks[kind], Number(index), BIO_MAX[kind]);
    this.render({ parts: ["body", "steps"] });
  }

  #pickFor(stepId) {
    if ( stepId in BIO_STEPS ) return BIO_STEPS[stepId].every(k => this.#bioValue(k, this.bioTables ?? {}));
    if ( stepId === "details" ) return this.draft.name;
    if ( stepId === "abilities" ) return this.#abilitiesReady();
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
    const hostId = item.system.identifier || item.identifier;
    // Features this item grants can carry choices of their own (Fighting Style, Weapon Mastery).
    board.choices.push(...await this.#nestedChoices(board.granted));
    const body = (item.type === "race") ? this.#bodyLines(item) : [];
    const preview = {
      uuid,
      name: item.name,
      img: item.img,
      source: item.system.source?.label ?? "",
      description: await TextEditor.enrichHTML(item.system.description?.value ?? "", { relativeTo: item }),
      granted: [...board.granted.map(e => this.#labelEntry(e, hostId)), ...body],
      choices: board.choices.map(e => this.#labelEntry(e, hostId)),
      native: board.native.map(e => this.#labelEntry(e, hostId))
    };
    this.previews.set(uuid, preview);
    return preview;
  }

  /** Speed, senses and creature type from a species item, as "You get" lines. */
  #bodyLines(item) {
    const label = value => game.i18n.localize(typeof value === "string" ? value : (value?.label ?? ""));
    const lines = bodyLines(item.system, {
      movement: key => label(CONFIG.DND5E.movementTypes[key]) || key,
      sense: key => label(CONFIG.DND5E.senses[key]) || key,
      units: units => CONFIG.DND5E.movementUnits?.[units]?.abbreviation ?? units,
      type: type => {
        const base = type.value === "custom" ? type.custom : label(CONFIG.DND5E.creatureTypes[type.value]);
        return base ? `${base}${type.subtype ? ` (${type.subtype})` : ""}` : "";
      }
    });
    const titles = { type: "CHARWIZ.Body.Type", speed: "CHARWIZ.Body.Speed", special: "CHARWIZ.Body.Senses" };
    return lines.map(l => ({ title: titles[l.id] ? game.i18n.localize(titles[l.id]) : l.title, detail: l.detail }));
  }

  /**
   * Choices carried by the features an item grants, found by reading those features' own advancements.
   * @param {object[]} granted  Board entries of kind "granted".
   * @param {number} [depth]
   */
  async #nestedChoices(granted, depth = 0) {
    if ( depth > 1 ) return [];
    const found = [];
    for ( const entry of granted ) {
      for ( const uuid of entry.items ?? [] ) {
        const feature = await fromUuid(uuid);
        // 6.0 keeps an item's advancements as an object keyed by id, not an array.
        const advancement = Object.values(feature?.toObject().system.advancement ?? {});
        if ( !advancement.length ) continue;
        const board = buildBoard(advancement, { fromLevel: 0, toLevel: 1, itemType: feature.type });
        for ( const choice of board.choices ) {
          // Unnamed choices take the feature's name.
          found.push({ ...choice, title: choice.title || feature.name, titleKey: null, via: feature.name });
        }
        found.push(...await this.#nestedChoices(board.granted, depth + 1));
      }
    }
    return found;
  }

  /** Human-readable title, label and detail for a board entry. */
  #labelEntry(entry, hostId) {
    const itemName = uuid => fromUuidSync(uuid)?.name ?? uuid;
    const traitLabel = key => {
      if ( key.startsWith("size:") ) return CONFIG.DND5E.actorSizes[key.slice(5)]?.label ?? key;
      return traitOptionLabel(key, dnd5e.documents.Trait.keyLabel(key) || key, hostId);
    };
    let detail = "";
    if ( entry.items?.length ) detail = entry.items.map(itemName).join(", ");
    else if ( entry.traits?.length ) detail = entry.traits.map(traitLabel).join(", ");
    else if ( entry.choiceType === "trait" ) detail = entry.pool.map(traitLabel).join(", ");
    else if ( entry.choiceType === "item" && entry.pool?.length ) detail = entry.pool.map(itemName).join(", ");
    else if ( entry.choiceType === "item" && entry.restriction?.list?.length ) {
      const names = entry.restriction.list.map(l => dnd5e.registry.spellLists.forType(l)?.name).filter(_ => _);
      detail = game.i18n.format("CHARWIZ.Board.FromSpellList", {
        lists: game.i18n.getListFormatter({ type: "disjunction" }).format(names),
        level: entry.restriction.level === "0" ? game.i18n.localize("CHARWIZ.Board.Cantrip") : ""
      }).trim();
    }
    else if ( entry.choiceType === "item" && entry.restriction?.subtype ) {
      detail = CONFIG.DND5E.featureTypes[entry.restriction.type]?.subtypes?.[entry.restriction.subtype] ?? "";
    }
    if ( entry.abilities ) {
      detail = Object.entries(entry.abilities).map(([id, n]) => `${CONFIG.DND5E.abilities[id]?.label ?? id} +${n}`).join(", ");
    }
    let countLabel = entry.count ? game.i18n.format("CHARWIZ.Board.Choose", { count: entry.count }) : "";
    if ( entry.choiceType === "asi" && entry.points ) {
      const locked = entry.locked ?? [];
      detail = Object.entries(CONFIG.DND5E.abilities).filter(([id]) => !locked.includes(id))
        .map(([, a]) => a.label).join(", ");
      countLabel = game.i18n.format("CHARWIZ.Board.Points", { count: entry.points, cap: entry.cap });
    }
    return {
      ...entry,
      title: entry.title || game.i18n.localize(entry.titleKey ?? "CHARWIZ.Naming.Other"),
      detail,
      countLabel
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
    if ( choiceSourceOf(this.step) && this.#remainingFor(choiceSourceOf(this.step)) ) return;
    if ( (this.step === "abilities") && !this.#abilitiesReady() ) return;
    if ( (this.step === "equipment") && !(await this.#equipmentPlans()).ready ) return;
    this.#setStep(this.stepIndex + 1);
  }

  static #onBack() {
    this.#setStep(this.stepIndex - 1);
  }

  /** Open or close a species group. */
  static #onGroup(event, target) {
    const { group } = target.dataset;
    if ( !this.expanded.delete(group) ) this.expanded.add(group);
    this.render({ parts: ["body"] });
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

  /**
   * Build the character: run the picks and choices through the system's advancements on a clone of the actor
   * and write the result in one update. A new actor is made first and removed again if the build fails.
   */
  static async #onCreate(event, target) {
    const eq = await this.#equipmentPlans();
    const blocker = createBlocker({
      picks: this.draft.picks, slots: this.slots, selections: this.draft.choices, canCreate: this.#canCreate(),
      abilitiesReady: this.#abilitiesReady(), equipmentReady: eq.ready
    });
    if ( blocker ) return;
    target.disabled = true;
    let created = null;
    try {
      let actor = this.actor;
      const name = this.draft.name || actor?.name || game.i18n.localize("CHARWIZ.Create.DefaultName");
      if ( !actor ) actor = created = await Actor.implementation.create({ name, type: "character" });
      const { engine, slots } = await runPicks({
        actor, picks: this.draft.picks, selections: this.draft.choices, catalog: this.catalogData,
        blocked: blockedLanguageKeys(getSetting("blockedLanguages")), tashas: getSetting("tashasAbilityScores"), order: this.#pickOrder(),
        ruleset: { rules: this.rules, untagged: getSetting("untaggedContent") }, abilities: this.#baseScores()
      });
      engine.clone.updateSource({ name });
      engine.clone.updateSource({ "system.details": this.#detailsData() });

      // Cantrips, spells known or prepared, and the spellbook.
      const spells = await spellItems(slots.filter(sl => sl.source === SPELLS_STEP), this.draft.choices);
      if ( spells.length ) engine.clone.updateSource({ items: spells });

      // A background feature the system doesn't grant, taken from the description.
      const feature = await this.#descriptionFeature();
      if ( feature ) {
        engine.clone.updateSource({ items: [{
          _id: foundry.utils.randomID(), name: feature.name, type: "feat", img: feature.img,
          system: { description: { value: feature.html }, type: { value: "background" } },
          flags: { [MODULE_ID]: { fromDescription: true }, dnd5e: { sourceId: feature.uuid } }
        }] });
      }

      // Starting equipment: the chosen items (packs opened up) and any gold.
      const inventory = await this.#inventory(eq);
      const items = await inventoryItems(inventory.lines);
      if ( items.length ) engine.clone.updateSource({ items });
      for ( const [coin, amount] of Object.entries(inventory.currency) ) {
        if ( amount ) engine.clone.updateSource({ [`system.currency.${coin}`]: (engine.clone.system.currency?.[coin] ?? 0) + amount });
      }
      // Hit points were set when the class was applied, before the background's Constitution bonus and feats such as
      // Tough raised the maximum. A new character starts at full health.
      engine.clone.reset();
      const maxHP = engine.clone.system.attributes?.hp?.max;
      if ( maxHP > 0 ) engine.clone.updateSource({ "system.attributes.hp.value": maxHP });
      await engine.commit();
      ui.notifications.info(game.i18n.format("CHARWIZ.Create.Done", { name }));
      await this.close();
      actor.sheet.render({ force: true });
    } catch(err) {
      console.error(`${MODULE_ID} | Could not build the character`, err);
      await created?.delete();
      ui.notifications.error("CHARWIZ.Create.Failed", { localize: true });
      target.disabled = false;
    }
  }

  /** Put an ability score slot back on the species' standard increases. */
  static async #onResetPoints(event, target) {
    const slot = this.slots.find(s => s.key === target.dataset.slot);
    if ( !slot?.defaultSelection ) return;
    this.touched.delete(slot.key);
    this.draft.choices[slot.key] = [...slot.defaultSelection];
    await this.#refreshSlots();
    this.render();
  }

  /** Switch how ability scores are set. The scores start again; a roll already made is kept. */
  static async #onAbilityMethod(event, target) {
    const { method } = target.dataset;
    if ( !this.#abilityMethods().includes(method) ) return;
    const abilities = this.draft.abilities;
    abilities.method = method;
    abilities.scores = (method === "pointbuy")
      ? Object.fromEntries(this.#abilityIds.map(id => [id, POINT_BUY.min])) : {};
    await this.#refreshSlots();
    this.render();
  }

  /** Raise or lower one ability in point buy. */
  static async #onAbilityPoint(event, target) {
    const { ability, delta } = target.dataset;
    const abilities = this.draft.abilities;
    abilities.scores = adjustPointBuy(abilities.scores, ability, Number(delta), this.#abilityIds);
    await this.#refreshSlots();
    this.render();
  }

  /**
   * Roll the six scores once (4d6, drop the lowest; rerolling 1s if the GM allows it). The dice go to chat as a
   * normal roll, so they show up for everyone and a 3D dice module such as Dice So Nice animates them.
   */
  static async #onAbilityRoll(event, target) {
    const abilities = this.draft.abilities;
    if ( abilities.rolled?.length ) return;
    target.disabled = true;
    const formula = rollFormula(getSetting("rerollOnes"));
    const rolls = [];
    for ( let i = 0; i < this.#abilityIds.length; i++ ) rolls.push(await new Roll(formula).evaluate());
    const totals = rolls.map(roll => roll.total).sort((a, b) => b - a);

    await this.#postRolls(rolls, game.i18n.format("CHARWIZ.Abilities.RollFlavor", { formula }), `<p>${totals.join(", ")}</p>`);

    abilities.rolled = totals;
    abilities.scores = {};
    await this.#refreshSlots();
    this.render();
  }

  /** Add or remove a point on an ability in an ability score slot. */
  static async #onAdjust(event, target) {
    const slot = this.slots.find(s => s.key === target.dataset.slot);
    if ( !slot ) return;
    const { value, delta } = target.dataset;
    this.touched.add(slot.key);
    this.draft.choices[slot.key] = adjustPoints(slot, this.draft.choices, value, Number(delta));
    this.inspected = { kind: slot.kind, value };
    await this.#refreshSlots();
    this.render();
  }

  /** Show an option's description without choosing it. */
  static #onInspect(event, target) {
    const slot = this.slots.find(s => s.key === target.dataset.slot);
    if ( !slot ) return;
    this.inspected = { slotKey: slot.key, kind: slot.kind, value: target.dataset.value };
    this.render({ parts: ["body"] });
  }

  /** Select or deselect an option in a choice slot, and show its description. */
  static async #onToggle(event, target) {
    const slot = this.slots.find(s => s.key === target.dataset.slot);
    if ( !slot ) return;
    const { value } = target.dataset;
    if ( slot.options.find(o => o.value === value)?.disabled ) return;
    this.draft.choices[slot.key] = toggleSelection(slot, this.draft.choices, value);
    this.inspected = { slotKey: slot.key, kind: slot.kind, value };
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
    if ( this.step in this.draft.equipment ) this.draft.equipment[this.step] = {};
    // Table entries belong to the background that has the table.
    if ( (this.step === "background") && (this.draft.picks.background?.uuid !== uuid) ) {
      for ( const kind of BIO_KINDS ) this.draft.bio.picks[kind] = [];
    }
    this.draft.picks[this.step] = { uuid, name: entry.name, identifier: entry.identifier };
    return true;
  }
}
