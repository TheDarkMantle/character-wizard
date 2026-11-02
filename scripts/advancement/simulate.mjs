import { HeadlessAdvancer } from "./apply.mjs";
import { featsMatching, groupTraitSlots, tally } from "./slots.mjs";
import { isDraconicAncestry, traitOptionLabel, traitTitleKey } from "./naming.mjs";
import { subclassesFor } from "../content/catalog-logic.mjs";

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
 * @returns {Promise<{ slots: import("./slots.mjs").ChoiceSlot[], deferred: string[] }>}
 *   `deferred` lists advancements the wizard doesn't handle yet (spell picks, ability score changes,
 *   unknown types) as "Item: Title".
 */
export async function discoverSlots(options) {
  const { slots, deferred } = await runPicks(options);
  return { slots, deferred };
}

/**
 * Same as `discoverSlots`, but also returns the engine so the caller can `engine.commit()` the result.
 * @returns {Promise<{ slots: import("./slots.mjs").ChoiceSlot[], deferred: string[], engine: HeadlessAdvancer }>}
 */
export async function runPicks({ actor, picks, selections, catalog }) {
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
  const optionFor = uuid => {
    const doc = fromUuidSync(uuid);
    return { value: uuid, uuid, label: doc?.name ?? uuid, img: doc?.img };
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
        if ( config.type === "spell" ) { deferred.add(`${item.name}: ${ownTitle || advancement.name}`); return false; }
        const pool = config.pool.map(p => p.uuid);
        const options = pool.length
          ? pool.map(optionFor)
          : featsMatching(catalog.byType.feat, config.restriction).map(f => optionFor(f.uuid));
        const key = keyFor("");
        addSlot({ ...base, key, kind: "item", count, options });
        const chosen = (selections[key] ?? []).filter(v => options.some(o => o.value === v));
        return chosen.length >= count ? { selected: chosen.slice(0, count) } : false;
      }

      case "Trait": {
        const { available } = await advancement.unfulfilledChoices();
        const { grants, groups } = groupTraitSlots(available.map(a => Array.from(a.choices.asSet())));
        if ( !groups.length ) return null;
        const picked = [];
        let complete = true;
        groups.forEach((group, i) => {
          const key = keyFor(`:${i}`);
          const options = group.options.map(value => ({
            value, label: traitOptionLabel(value, dnd5e.documents.Trait.keyLabel(value) || value, hostId)
          }));
          const title = isDraconicAncestry(hostId, group.options) ? localize("CHARWIZ.Naming.DraconicAncestry")
            : (ownTitle || localize(traitTitleKey(group.options, config.mode)));
          addSlot({ ...base, title, key, kind: "trait", count: group.count, options });
          const chosen = (selections[key] ?? []).filter(v => group.options.includes(v)).slice(0, group.count);
          picked.push(...chosen);
          if ( chosen.length < group.count ) complete = false;
        });
        return complete ? { chosen: [...grants, ...picked] } : false;
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
        // Fixed bonuses (2014 species) apply on their own. Spendable points (2024 backgrounds) are a choice.
        if ( !config.points ) return null;
        const locked = Array.from(config.locked ?? []);
        const options = Object.entries(CONFIG.DND5E.abilities)
          .filter(([id]) => advancement.canImprove(id) && !locked.includes(id))
          .map(([value, a]) => ({ value, label: a.label }));
        const key = keyFor("");
        addSlot({ ...base, key, kind: "asi", count: config.points, cap: config.cap ?? config.points, options });
        const chosen = selections[key] ?? [];
        if ( chosen.length < config.points ) return false;
        const assignments = tally(chosen);
        for ( const [id, bonus] of Object.entries(config.fixed ?? {}) ) if ( bonus ) assignments[id] = (assignments[id] ?? 0) + bonus;
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
  // Same order as the spike and the system's manager: species, class, then background.
  for ( const step of ["species", "class", "background"] ) {
    const pick = picks[step];
    if ( !pick ) continue;
    const document = await fromUuid(pick.uuid);
    if ( !document ) continue;
    source = step;
    await engine.addItem(document, { levels: 1 });
  }
  // Anything the engine had to skip for lack of input would otherwise vanish without a trace.
  for ( const u of engine.unresolved ) deferred.add(`${u.item}: ${u.title}`);
  return { slots: [...slots.values()], deferred: [...deferred], engine };
}
