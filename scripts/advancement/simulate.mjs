import { HeadlessAdvancer } from "./apply.mjs";
import {
  featsMatching, groupTraitSlots, spellsMatching, standardPoints, tally, traitGroups, uniqueByName, withoutBlocked
} from "./slots.mjs";
import { isDraconicAncestry, stripTitlePrefix, traitOptionLabel, traitTitleKey } from "./naming.mjs";
import { matchesRules, rulesFor, subclassesFor } from "../content/catalog-logic.mjs";
import { isCaster, spellSlots } from "../spells/builder.mjs";

/**
 * Discover the choices a set of picks asks for, by running the system's own advancements on a clone.
 *
 * The engine's resolver is where the player's decisions come in. Each time an advancement needs input,
 * the resolver records a slot. If the selections already cover that slot it returns the data `apply()`
 * expects; otherwise it skips the advancement, so features it would have granted (and the choices they
 * carry) show up on a later pass once the player has decided.
 *
 * Nothing is written to any actor here. Rerun after every selection. To build the character, call
 * `runPicks` with the real actor and commit the returned engine.
 *
 * @param {object} options
 * @param {Actor5e|null} options.actor        Level-0 actor to build onto, or null for a throwaway one.
 * @param {Record<string, {uuid: string}>} options.picks   Picks by wizard step: species, class, background.
 * @param {Record<string, string[]>} options.selections    Chosen option values by slot key.
 * @param {{byType: Record<string, object[]>}} options.catalog  Built catalog (for feat searches).
 * @param {{rules: string, untagged: string}} [options.ruleset]  The world's rules, to keep spells to the right edition.
 * @param {Record<string, number>} [options.abilities]  Base ability scores the player set. Applied first, so the species'
 *   and background's increases add to them.
 * @param {string[]} [options.order]  Which picks to apply first. Follows the wizard's step order, so a choice is checked
 *   against what earlier steps already gave the character.
 * @param {boolean} [options.tashas]  Tasha's "Customizing Your Origin": a species' ability score increases can go to any ability.
 * @param {Set<string>} [options.blocked]  Trait keys the GM has hidden from choices (languages). Grants still apply.
 * @returns {Promise<{ slots: import("./slots.mjs").ChoiceSlot[], deferred: string[] }>}
 *   `deferred` lists advancements the wizard doesn't handle yet (spell picks, ability score changes,
 *   unknown types) as "Item: Title".
 */
export async function discoverSlots(options) {
  const { slots, deferred, finals } = await runPicks(options);
  return { slots, deferred, finals };
}

/**
 * Same as `discoverSlots`, but also returns the engine so the caller can `engine.commit()` the result.
 * @returns {Promise<{ slots: import("./slots.mjs").ChoiceSlot[], deferred: string[], engine: HeadlessAdvancer,
 *   finals: Record<string, number> }>}  `finals` are the ability scores once everything has been applied.
 */
export async function runPicks({ actor, picks, selections, catalog, blocked = new Set(), tashas = false, order = ["species", "class", "background"], abilities = {},
  ruleset = { rules: "2024", untagged: "show" } }) {
  const slots = new Map();
  const deferred = new Set();
  let source = null;
  /** Picked item UUID → wizard step it belongs to. */
  const ownerByUuid = new Map(Object.entries(picks).filter(([, p]) => p?.uuid).map(([step, p]) => [p.uuid, step]));

  const addSlot = slot => {
    // A slot with nothing to pick would block Next forever, so report it instead.
    if ( !slot.options.length ) deferred.add(`${slot.itemName}: ${slot.title}`);
    else if ( !slots.has(slot.key) ) slots.set(slot.key, slot);
  };
  const optionFor = (uuid, title = "") => {
    const doc = fromUuidSync(uuid);
    return { value: uuid, uuid, label: stripTitlePrefix(doc?.name ?? uuid, title), img: doc?.img };
  };

  /**
   * Spells an open spell choice can offer, from the system's spell lists, kept to the world's ruleset.
   * Returns null when the restriction can't be resolved here (no list, or a level relative to the character).
   */
  const spellOptions = restriction => {
    const lists = Array.from(restriction.list ?? []);
    if ( !lists.length ) return null;
    if ( ["available", "availableNoCantrips"].includes(restriction.level) ) return null;
    const indexes = lists.flatMap(id => dnd5e.registry.spellLists.forType(id)?.indexes ?? []);
    const inRuleset = indexes.filter(i => matchesRules({ rules: rulesFor(i) }, ruleset.rules, ruleset.untagged));
    return uniqueByName(spellsMatching(inRuleset, { level: restriction.level, school: restriction.school }))
      .map(i => ({ value: i.uuid, uuid: i.uuid, label: i.name, img: i.img }));
  };

  /** @type {import("./apply.mjs").Resolver} */
  const resolve = async (advancement, level) => {
    const type = advancement.constructor.typeName;
    const config = advancement.configuration;
    const item = advancement.item;
    const itemId = item._stats?.compendiumSource ?? item.flags?.dnd5e?.sourceId ?? item.name;
    // The engine runs species advancements while adding the class, so attribute by the item's own pick first.
    const owner = ownerByUuid.get(itemId) ?? source;
    const keyFor = suffix => `${owner}:${itemId}:${advancement.id}:${level}${suffix}`;
    // dnd5e fills an empty name with the type's default ("Item Choice"), so only a different name is the author's.
    const ownTitle = (advancement.name && (advancement.name !== advancement._defaultTitle)) ? advancement.name : "";
    const localize = game.i18n.localize.bind(game.i18n);
    const hostId = item.system.identifier || item.identifier;
    // Unnamed choices are named after the feature that carries them ("Fighting Style", "Primal Order").
    const base = { source: owner, itemName: item.name, hostId, title: ownTitle || item.name };

    switch ( type ) {
      case "ItemChoice": {
        const count = config.choices[level]?.count ?? 0;
        if ( !count ) return false;
        const pool = config.pool.map(p => p.uuid);
        const title = ownTitle || item.name;
        let options;
        if ( config.type === "spell" ) {
          // A class' cantrips and spells belong to the spells step, not the class choices. A class that doesn't cast
          // has no spells step to take them, so those are reported.
          if ( owner === "class" ) {
            if ( !isCaster(item) ) deferred.add(`${item.name}: ${ownTitle || advancement.name}`);
            return false;
          }
          options = pool.length ? pool.map(u => optionFor(u, title)) : spellOptions(config.restriction);
          if ( !options ) { deferred.add(`${item.name}: ${ownTitle || advancement.name}`); return false; }
        } else {
          options = pool.length
            ? pool.map(u => optionFor(u, title))
            : featsMatching(catalog.byType.feat, config.restriction).map(f => optionFor(f.uuid, title));
        }
        const key = keyFor("");
        addSlot({ ...base, key, kind: "item", count, options });
        const chosen = (selections[key] ?? []).filter(v => options.some(o => o.value === v));
        return chosen.length >= count ? { selected: chosen.slice(0, count) } : false;
      }

      case "Trait": {
        const Trait = dnd5e.documents.Trait;
        const mode = config.mode ?? "default";

        // Expertise and weapon mastery build on proficiencies the character already has, so the system's own
        // filtering is right for them.
        if ( mode !== "default" ) {
          const { available } = await advancement.unfulfilledChoices();
          const grouped = groupTraitSlots(available.map(a => Array.from(a.choices.asSet())));
          const groups = grouped.groups.map(g => withoutBlocked(g, blocked));
          if ( !groups.length ) return null;
          const picked = [];
          let complete = true;
          groups.forEach((group, i) => {
            const key = keyFor(`:${i}`);
            const options = group.options.map(value => ({ value, label: Trait.keyLabel(value) || value }));
            addSlot({ ...base, title: ownTitle || localize(traitTitleKey(group.options, mode)), key, kind: "trait",
              count: group.count, options });
            const chosen = (selections[key] ?? []).filter(v => group.options.includes(v)).slice(0, group.count);
            picked.push(...chosen);
            if ( chosen.length < group.count ) complete = false;
          });
          return complete ? { chosen: [...grouped.grants, ...picked] } : false;
        }

        // Proficiencies: what the character already has is greyed out, a duplicate grant or an exhausted choice
        // becomes "pick any other", and the rest is offered as the pool says.
        const held = (await advancement.actorSelected()).selected;
        const slotsIn = Array.from(config.grants ?? [], g => ({ type: "grant", full: [g] }));
        for ( const [idx, choice] of config.choices.entries() ) {
          const full = Array.from((await Trait.mixedChoices(choice.pool)).asSet());
          for ( let n = 0; n < (choice.count ?? 1); n++ ) slotsIn.push({ type: "choice", idx, full });
        }
        const everyKey = {};
        for ( const type of new Set(slotsIn.map(sl => String(sl.full[0] ?? "").split(":")[0]).filter(Boolean)) ) {
          const keys = Array.from((await Trait.choices(type, { prefixed: true })).asSet())
            .filter(k => k.includes(":") && !k.endsWith(":ALL"));
          // Leave out category keys such as "tool:art"; only the individual proficiencies are replacements.
          everyKey[type] = keys.filter(k => !keys.some(o => o.startsWith(`${k}:`)));
        }
        const { grants, groups } = traitGroups({ slots: slotsIn, anyKeys: type => everyKey[type] ?? [], held, blocked });
        const picked = [];
        let complete = true;
        for ( const group of groups ) {
          const key = keyFor(`:${group.id}`);
          const keys = group.options.map(o => o.value);
          // Something picked in an earlier group of this advancement (a tool from a short list, then "another of your
          // choice") can't be picked again, or two picks would become one proficiency.
          for ( const o of group.options ) if ( picked.includes(o.value) ) o.disabled = true;
          const options = group.options.map(o => ({
            value: o.value, disabled: o.disabled, label: traitOptionLabel(o.value, Trait.keyLabel(o.value) || o.value, hostId)
          }));
          const title = isDraconicAncestry(hostId, keys) ? localize("CHARWIZ.Naming.DraconicAncestry")
            : (group.id.startsWith("r:") ? game.i18n.format("CHARWIZ.Naming.AnotherOfKind", { kind: localize(traitTitleKey(keys, mode)) })
              : (ownTitle || localize(traitTitleKey(keys, mode))));
          addSlot({ ...base, title, key, kind: "trait", count: group.count, options });
          const chosen = (selections[key] ?? [])
            .filter(v => group.options.some(o => (o.value === v) && !o.disabled)).slice(0, group.count);
          picked.push(...chosen);
          if ( chosen.length < group.count ) complete = false;
        }
        return complete ? { chosen: [...new Set([...grants, ...picked])] } : false;
      }

      case "ItemGrant": {
        const items = config.items ?? [];
        const optionalItems = items.filter(i => config.optional || i.optional);
        // Granted spells can ask which ability casts them (Magic Initiate: Intelligence, Wisdom or Charisma).
        const abilities = Array.from(config.spell?.ability ?? []);
        let ability;
        if ( abilities.length > 1 ) {
          const abilityKey = keyFor(":ability");
          const abilityOptions = abilities.map(value => ({ value, label: CONFIG.DND5E.abilities[value]?.label ?? value }));
          addSlot({ ...base, title: `${base.title}: ${localize("CHARWIZ.Naming.CastingAbility")}`, key: abilityKey,
            kind: "ability", count: 1, options: abilityOptions });
          ability = (selections[abilityKey] ?? []).find(v => abilities.includes(v));
          if ( !ability ) return false;
        }
        if ( !optionalItems.length ) return ability ? { ability } : null;
        const key = keyFor("");
        const options = optionalItems.map(i => optionFor(i.uuid));
        addSlot({ ...base, key, kind: "optional-item", count: 0, max: options.length, options });
        const chosen = (selections[key] ?? []).filter(v => options.some(o => o.value === v));
        const required = items.filter(i => !optionalItems.includes(i)).map(i => i.uuid);
        return { selected: [...required, ...chosen], ability };
      }

      case "AbilityScoreImprovement": {
        const fixed = Object.fromEntries(Object.entries(config.fixed ?? {}).filter(([, v]) => v));
        const hasFixed = Object.keys(fixed).length > 0;
        const improvable = Object.entries(CONFIG.DND5E.abilities).filter(([id]) => advancement.canImprove(id));

        // Tasha's: a 2014 species' fixed increases become points to spend on any abilities, up to the largest single
        // increase on one. The control starts on the standard increases, so doing nothing keeps them. A species that
        // only has points to spend (Centaur: +2/+1 or +1/+1/+1) already works this way, so it keeps its own control.
        if ( tashas && hasFixed && (item.type === "race") && (item.system.source?.rules !== "2024") ) {
          const { total, cap, defaults } = standardPoints({ fixed, points: config.points });
          const key = keyFor("");
          const options = improvable.map(([value, a]) => ({ value, label: a.label }));
          addSlot({ ...base, title: ownTitle || localize("CHARWIZ.Naming.AbilityScoreIncrease"), key, kind: "asi",
            count: total, cap, defaultSelection: defaults, options });
          const chosen = selections[key] ?? [];
          if ( chosen.length < total ) return false;
          return { type: "asi", assignments: tally(chosen) };
        }

        // Fixed increases (2014 species) apply as they are. The system's own manager does this with `initial: true`.
        if ( !config.points ) return hasFixed ? { type: "asi", assignments: fixed } : null;

        // Spendable points (2024 backgrounds) are a choice.
        const locked = Array.from(config.locked ?? []);
        const options = improvable.filter(([id]) => !locked.includes(id)).map(([value, a]) => ({ value, label: a.label }));
        const key = keyFor("");
        addSlot({ ...base, key, kind: "asi", count: config.points, cap: config.cap ?? config.points, options });
        const chosen = selections[key] ?? [];
        if ( chosen.length < config.points ) return false;
        const assignments = tally(chosen);
        for ( const [id, bonus] of Object.entries(fixed) ) assignments[id] = (assignments[id] ?? 0) + bonus;
        return { type: "asi", assignments };
      }

      case "Size": {
        const sizes = Array.from(config.sizes ?? []);
        if ( sizes.length < 2 ) return null;
        const key = keyFor("");
        const options = sizes.map(value => ({ value, label: CONFIG.DND5E.actorSizes[value]?.label ?? value }));
        addSlot({ ...base, title: ownTitle || localize("CHARWIZ.Naming.Size"), key, kind: "size", count: 1, options });
        const chosen = (selections[key] ?? []).find(v => sizes.includes(v));
        return chosen ? { size: chosen } : false;
      }

      case "HitPoints": return { [level]: level === 1 ? "max" : "avg" };
      case "ScaleValue": return null;

      case "Subclass": {
        // The catalog already applies the world's rules and the GM's blocked subclasses.
        const options = subclassesFor(catalog, item.system.identifier || item.identifier)
          .map(e => ({ value: e.uuid, uuid: e.uuid, label: e.name, img: e.img }));
        const key = keyFor("");
        addSlot({ ...base, title: ownTitle || localize("CHARWIZ.Naming.Subclass"), key, kind: "subclass", count: 1, options });
        const chosen = (selections[key] ?? []).find(v => options.some(o => o.value === v));
        return chosen ? { uuid: chosen } : false;
      }

      default:
        deferred.add(`${item.name}: ${ownTitle || advancement.name}`);
        return false;
    }
  };

  const target = actor ?? new Actor.implementation({ name: "Character Wizard", type: "character" });
  const engine = new HeadlessAdvancer(target, { resolve });
  // Base scores go in before any advancement, so the increases they add (and the cap of 20) work on them.
  const baseScores = Object.fromEntries(Object.entries(abilities).filter(([id, v]) => Number.isInteger(v) && (id in CONFIG.DND5E.abilities)));
  if ( Object.keys(baseScores).length ) {
    engine.clone.updateSource({ system: { abilities: Object.fromEntries(Object.entries(baseScores).map(([id, value]) => [id, { value }])) } });
  }
  // In the wizard's step order, so a later step sees what an earlier one gave (and greys it out).
  for ( const step of order ) {
    const pick = picks[step];
    if ( !pick ) continue;
    const document = await fromUuid(pick.uuid);
    if ( !document ) continue;
    source = step;
    await engine.addItem(document, { levels: 1 });
  }
  // The spells step: what the class picks, worked out from the finished clone (slots, ability scores, what's held).
  for ( const slot of spellSlots({ clone: engine.clone, selections, ruleset }) ) addSlot(slot);
  // Anything the engine had to skip for lack of input would otherwise vanish without a trace.
  for ( const u of engine.unresolved ) deferred.add(`${u.item}: ${u.title}`);
  const finals = Object.fromEntries(Object.keys(CONFIG.DND5E.abilities)
    .map(id => [id, engine.clone.system._source.abilities?.[id]?.value]));
  return { slots: [...slots.values()], deferred: [...deferred], engine, finals };
}
