/**
 * Headless advancement engine (prototype).
 *
 * Mirrors what dnd5e's AdvancementManager does, without its dialogs:
 *  1. Work on a clone of the actor.
 *  2. Add items to the clone and call each advancement's `apply(level, data)` with data
 *     collected by the wizard (or the advancement's own automatic value).
 *  3. Items granted along the way (e.g. an origin feat) get their own advancements run too.
 *  4. Commit everything to the real actor in one bulk update, flagged as an advancement.
 *
 * Because the system's own `apply` methods do the work, the actor ends up with the same
 * advancement values and flags as a native build, so later level-ups and undo keep working.
 */

/**
 * @callback Resolver
 * @param {Advancement} advancement  The advancement being applied (on the clone).
 * @param {number} level             Level being applied.
 * @returns {object|false|null|Promise<object|false|null>}
 *   Data for `apply`, or null/undefined to use the automatic value, or false to skip.
 */

export class HeadlessAdvancer {
  /**
   * @param {Actor5e} actor
   * @param {object} [options]
   * @param {Resolver} [options.resolve]  Supplies the player's choices.
   */
  constructor(actor, { resolve } = {}) {
    this.actor = actor;
    this.clone = actor.clone({}, { keepId: true });
    this.resolve = resolve ?? (() => null);
    /** Advancements that needed input and got none: [{ item, advancement, level, title }]. */
    this.unresolved = [];
    /** Log of what was applied, for debugging. */
    this.log = [];
  }

  /**
   * Add an item (class, species, background, feat) and run its advancements.
   * @param {Item5e} source        Compendium or world item.
   * @param {object} [options]
   * @param {number} [options.levels=1]  For classes: how many class levels to add.
   * @returns {Promise<Item5e>}    The item on the clone.
   */
  async addItem(source, { levels = 1 } = {}) {
    const data = foundry.utils.deepClone(game.items.fromCompendium(source, { keepId: false }));
    data._id = foundry.utils.randomID();
    foundry.utils.setProperty(data, "flags.dnd5e.sourceId", source.uuid);

    if ( data.type === "class" ) {
      data.system.levels = 0;
      if ( !this.clone.system.details.originalClass ) {
        this.clone.updateSource({ "system.details.originalClass": data._id });
      }
    }
    this.clone.updateSource({ items: [data] });
    const item = this.clone.items.get(data._id);

    if ( item.type === "class" ) {
      const start = item.system.levels;
      for ( let classLevel = start + 1; classLevel <= start + levels; classLevel++ ) {
        // Like AdvancementManager#createLevelChangeSteps: species first, then class, subclass, other items.
        const characterLevel = (this.clone.system.details.level ?? 0) + 1;
        const others = this.clone.items.filter(i => (i !== item) && !["class", "subclass"].includes(i.type)
          && i.hasAdvancement && !i.system.advancementClassLinked);
        const species = others.filter(i => i.type === "race");
        for ( const other of species ) await this.#runLevel(other, characterLevel);
        await this.#runLevel(item, classLevel);
        if ( item.subclass ) await this.#runLevel(item.subclass, classLevel);
        for ( const other of others.filter(i => i.type !== "race") ) await this.#runLevel(other, characterLevel);
        item.updateSource({ "system.levels": classLevel });
        this.clone.reset();
      }
    } else {
      const characterLevel = this.clone.system.details.level ?? 0;
      for ( let level = 0; level <= characterLevel; level++ ) await this.#runLevel(item, level);
    }
    return item;
  }

  /** Run all advancements of an item at one level, then any items they granted. */
  async #runLevel(item, level) {
    const before = new Set(this.clone.items.keys());
    for ( const advancement of item.advancement.byLevel[level] ?? [] ) {
      if ( !advancement.appliesToClass ) continue;
      let data = await this.resolve(advancement, level);
      if ( data === false ) continue;
      data ??= await advancement.automaticApplicationValue(level);
      if ( data === false ) {
        this.unresolved.push({ item: item.name, title: advancement.title, type: advancement.constructor.typeName,
          level, advancement });
        continue;
      }
      await advancement.apply(level, data);
      this.log.push(`${item.name} L${level}: ${advancement.title} (${advancement.constructor.typeName})`);
      this.clone.reset();
    }

    // Items granted at this level that have their own advancements (e.g. an origin feat with choices).
    const added = [...this.clone.items.keys()].filter(id => !before.has(id));
    for ( const id of added ) {
      const granted = this.clone.items.get(id);
      if ( !granted?.hasAdvancement || ["class", "subclass"].includes(granted.type) ) continue;
      const characterLevel = this.clone.system.details.level ?? 0;
      for ( let l = 0; l <= Math.max(level, characterLevel); l++ ) await this.#runLevel(granted, l);
    }
  }

  /** Write the clone's state to the real actor in one update. */
  async commit() {
    const updates = this.clone.toObject();
    const items = updates.items;
    delete updates.items;
    const existing = new Set(this.actor.items.keys());
    const toCreate = items.filter(i => !existing.has(i._id));
    const toUpdate = items.filter(i => existing.has(i._id));
    const keep = new Set(items.map(i => i._id));
    const toDelete = [...existing].filter(id => !keep.has(id));
    await this.actor.performBulkUpdate(
      { actor: updates, create: toCreate, delete: toDelete, item: toUpdate },
      { isAdvancement: true, updateOptions: { diff: false, recursive: false } }
    );
    return this.actor;
  }
}

/**
 * Spike: build a level 1 Fighter in the world's ruleset with no dialogs, to prove the engine works.
 * Run in the browser console as GM:  game.modules.get("character-wizard").api.spike()
 * Picks the first valid options for every choice and creates "Spike Fighter (2014|2024)".
 */
export async function spikeFighter({ classIdentifier = "fighter" } = {}) {
  const api = game.modules.get("character-wizard").api;
  const catalog = await api.catalog.build();
  const pickFirst = list => list[0] && fromUuid(list[0].uuid);

  const classItem = await pickFirst(catalog.byType.class.filter(c => c.identifier === classIdentifier));
  if ( !classItem ) throw new Error(`No "${classIdentifier}" class found for this world's rules.`);
  const species = await pickFirst(catalog.byType.race);
  const background = await pickFirst(catalog.byType.background);

  /** @type {Resolver} */
  const resolve = async (advancement, level) => {
    const type = advancement.constructor.typeName;
    const config = advancement.configuration;
    switch ( type ) {
      case "Trait": {
        // One entry per slot (grants included), smallest pools first.
        const { available } = await advancement.unfulfilledChoices();
        const chosen = [];
        for ( const { choices } of available ) {
          const key = Array.from(choices.asSet()).find(k => !chosen.includes(k));
          if ( key ) chosen.push(key);
        }
        return { chosen };
      }
      case "ItemChoice": {
        const count = config.choices[level]?.count ?? 0;
        let pool = config.pool.map(p => p.uuid);
        if ( !pool.length ) pool = catalog.byType.feat
          .filter(f => (!config.restriction.type || f.featType === config.restriction.type)
            && (!config.restriction.subtype || f.featSubtype === config.restriction.subtype))
          .map(f => f.uuid);
        return { selected: pool.slice(0, count) };
      }
      case "AbilityScoreImprovement": {
        // 2024 backgrounds: +2/+1 to the first two allowed abilities. Anything else: automatic or skip.
        if ( !config.points ) return null;
        const allowed = Object.keys(CONFIG.DND5E.abilities).filter(a => advancement.canImprove(a));
        return { type: "asi", assignments: { [allowed[0]]: 2, [allowed[1]]: 1 } };
      }
      case "Size": return { size: Array.from(config.sizes ?? [])[0] ?? "med" };
      case "HitPoints": return level === 1 ? { 1: "max" } : { [level]: "avg" };
      default: return null;
    }
  };

  const rules = game.settings.get("dnd5e", "rulesVersion") === "modern" ? "2024" : "2014";
  const actor = await Actor.implementation.create({ name: `Spike Fighter (${rules})`, type: "character" });
  const engine = new HeadlessAdvancer(actor, { resolve });
  if ( species ) await engine.addItem(species);
  await engine.addItem(classItem, { levels: 1 });
  if ( background ) await engine.addItem(background);
  await engine.commit();

  console.group("Character Wizard spike");
  console.log("Applied:", engine.log);
  console.log("Needed input but got none:", engine.unresolved.map(u => `${u.item} L${u.level}: ${u.title} (${u.type})`));
  console.log("Actor:", actor);
  console.groupEnd();
  actor.sheet.render(true);
  return { actor, log: engine.log, unresolved: engine.unresolved };
}
