import { getSetting } from "../settings.mjs";
import { matchesRules, rulesFor } from "../content/catalog-logic.mjs";
import { spellsMatching, uniqueByName } from "../advancement/slots.mjs";
import {
  expandedSpellNames, greyHeld, heldNames, highestSpellLevel, offerUnlisted, planSpells, spellsBetween, spellsNamed
} from "./plan.mjs";

/**
 * The spells step, Foundry side: reads what a spellcasting class picks off the (prepared) clone of the actor,
 * builds the choice slots, and later turns the selections into spell items.
 */

/** Prefix of the slot keys, so they never clash with a picker step's keys ("class:...", "species:..."). */
const KEY = "spells";

/** Is the compendium a spell comes from switched on in the GM's content settings? */
function inEnabledPack(uuid) {
  const collection = foundry.utils.parseUuid(uuid)?.collection;
  const pack = collection?.collection;
  if ( !(collection instanceof foundry.documents.collections.CompendiumCollection) ) return true;
  return getSetting("contentSources")[pack]?.enabled !== false;
}

/**
 * Every spell the class may pick: its spell list (from any compendium or world journal the system has read lists from),
 * plus any spell in the world's Items folder that no list claims, since those are homebrew. Kept to the world's
 * rules and to enabled compendiums, with one copy of each name.
 */
export function classSpells(identifier, ruleset) {
  const registry = dnd5e.registry.spellLists;
  const listed = registry.forType("class", identifier)?.indexes ?? [];
  const unlisted = game.items.filter(i => (i.type === "spell") && offerUnlisted(true, registry.forSpell(i.uuid).size));
  const fits = i => matchesRules({ rules: rulesFor(i) }, ruleset.rules, ruleset.untagged) && inEnabledPack(i.uuid);
  return uniqueByName([...listed, ...unlisted].filter(fits));
}

/**
 * Spells a patron or similar feature adds to the class' list ("The Great Old One lets you choose from an expanded list
 * of spells when you learn a warlock spell"). The system's own lists cover its SRD subclasses; imports only describe the
 * list in a table, so the names are read from the feature's description and looked up among every class' spells.
 * @param {Actor5e} clone
 * @param {{rules: string, untagged: string}} ruleset
 */
export function expandedSpells(clone, ruleset) {
  const registry = dnd5e.registry.spellLists;
  const found = [];
  // The system's subclass spell lists, for a subclass that has one.
  for ( const subclass of clone.items.filter(i => i.type === "subclass") ) {
    const id = subclass.system.identifier || subclass.identifier;
    for ( const key of new Set([id, id?.replace(/^the-/, "")]) ) {
      if ( key ) found.push(...(registry.forType("subclass", key)?.indexes ?? []));
    }
  }
  // Lists described in text.
  const describesExpansion = i => /expanded spell/i.test(i.name)
    || ((i.type === "subclass") && /expanded (list|spell)/i.test(i.system.description?.value ?? ""));
  const names = clone.items.filter(describesExpansion).flatMap(i => expandedSpellNames(i.system.description?.value));
  if ( names.length ) {
    const everything = registry.options.filter(o => o.type === "class").flatMap(o => registry.forType(o.value)?.indexes ?? []);
    const world = game.items.filter(i => i.type === "spell");
    found.push(...spellsNamed([...everything, ...world], names));
  }
  const fits = i => matchesRules({ rules: rulesFor(i) }, ruleset.rules, ruleset.untagged) && inEnabledPack(i.uuid);
  return uniqueByName(found.filter(fits));
}

/** "Cantrip · Evocation" or "Level 1 · Evocation". */
function describeSpell(spell) {
  const level = Number(spell.system?.level ?? 0);
  const school = CONFIG.DND5E.spellSchools?.[spell.system?.school]?.label;
  const head = level ? game.i18n.format("CHARWIZ.Spells.Level", { level }) : game.i18n.localize("CHARWIZ.Spells.Cantrip");
  return school ? `${head} · ${school}` : head;
}

const toOption = spell => ({
  value: spell.uuid, uuid: spell.uuid, label: spell.name, img: spell.img, detail: describeSpell(spell)
});

/** What a class needs, read from its data on the clone. */
function readClass(cls, clone) {
  const casting = cls.system.spellcasting;
  const scale = id => Number(cls.scaleValues?.[id]?.value ?? 0) || 0;
  const slots = Object.fromEntries(Array.from({ length: 9 }, (_, i) => [i + 1, clone.system.spells?.[`spell${i + 1}`]?.max ?? 0]));
  const pact = clone.system.spells?.pact;
  let maxLevel = highestSpellLevel(slots, (pact?.max > 0) ? (pact.level ?? 0) : 0);
  // A pact caster's slots are all one level. If the system doesn't report it yet, a 1st-level warlock has 1st-level slots.
  if ( (casting.type === "pact") && !maxLevel ) maxLevel = 1;
  const maxPrepared = Number(casting.preparation?.max) || scale("max-prepared");
  // A prepared caster always has at least one spell prepared, even with a negative ability modifier.
  const prepared = (casting.preparation?.formula || maxPrepared) ? Math.max(1, maxPrepared) : 0;
  return {
    identifier: cls.system.identifier || cls.identifier,
    level: cls.system.levels || 1,
    cantrips: scale("cantrips-known"),
    known: scale("spells-known"),
    prepared,
    maxLevel,
    method: (casting.type === "pact") ? "pact" : "spell"
  };
}

/** Does this class cast spells at all? */
export function isCaster(cls) {
  const progression = cls.system.spellcasting?.progression;
  return !!progression && (progression !== "none");
}

/**
 * The choice slots the spells step shows, one set per spellcasting class on the clone.
 * @param {object} input
 * @param {Actor5e} input.clone  The simulated actor, after every pick has been applied.
 * @param {Record<string, string[]>} input.selections
 * @param {{rules: string, untagged: string}} input.ruleset
 * @returns {import("../advancement/slots.mjs").ChoiceSlot[]}
 */
export function spellSlots({ clone, selections, ruleset }) {
  const out = [];
  // What the character already has (a species' cantrip, a feat's spell) can't be taken a second time.
  const held = heldNames(clone.items.filter(i => i.type === "spell"));
  const localize = key => game.i18n.localize(key);
  for ( const cls of clone.items.filter(i => (i.type === "class") && isCaster(i)) ) {
    const info = readClass(cls, clone);
    const plan = planSpells(info);
    if ( plan.mode === "none" && !plan.cantrips ) continue;
    // A patron's expanded list adds to the class' own.
    const pool = uniqueByName([...classSpells(info.identifier, ruleset), ...expandedSpells(clone, ruleset)]);
    const base = { source: "spells", itemName: cls.name, hostId: info.identifier, kind: "item" };
    const add = (role, title, hint, count, options) => {
      const key = `${KEY}:${info.identifier}:${role}`;
      out.push({ ...base, key, title, hint, count, options: greyHeld(options.map(toOption), held),
        spell: { identifier: info.identifier, method: info.method, role } });
    };

    if ( plan.cantrips ) {
      add("cantrips", localize("CHARWIZ.Spells.Cantrips"), localize("CHARWIZ.Spells.CantripsHint"), plan.cantrips,
        spellsMatching(pool, { level: "0" }));
    }
    const leveled = spellsBetween(pool, 1, info.maxLevel);
    if ( plan.mode === "known" ) {
      add("spells", localize("CHARWIZ.Spells.Known"), localize("CHARWIZ.Spells.KnownHint"), plan.spells, leveled);
    } else if ( plan.mode === "prepared" ) {
      add("spells", localize("CHARWIZ.Spells.Prepared"), localize("CHARWIZ.Spells.PreparedHint"), plan.spells, leveled);
    } else if ( plan.mode === "spellbook" ) {
      add("book", localize("CHARWIZ.Spells.Book"), localize("CHARWIZ.Spells.BookHint"), plan.spells, leveled);
      // Preparing comes from the spellbook, so it can't start until some spells are in it.
      const book = new Set(selections[`${KEY}:${info.identifier}:book`] ?? []);
      const inBook = leveled.filter(s => book.has(s.uuid));
      if ( inBook.length ) {
        add("prepared", localize("CHARWIZ.Spells.Prepared"), localize("CHARWIZ.Spells.PreparedFromBookHint"),
          Math.min(plan.prepared, plan.spells), inBook);
      }
    }
  }
  return out;
}

/**
 * Item data for the chosen spells, ready to add to the actor. Spellbook spells are added too, prepared only
 * if the player prepared them; every other spell is prepared.
 * @param {import("../advancement/slots.mjs").ChoiceSlot[]} slots  The spells step's slots.
 * @param {Record<string, string[]>} selections
 * @returns {Promise<object[]>}
 */
export async function spellItems(slots, selections) {
  const prepared = new Set(slots.filter(s => s.spell?.role === "prepared").flatMap(s => selections[s.key] ?? []));
  const seen = new Set();
  const items = [];
  for ( const slot of slots ) {
    const { role, identifier, method } = slot.spell ?? {};
    if ( !role || (role === "prepared") ) continue;
    for ( const uuid of selections[slot.key] ?? [] ) {
      if ( seen.has(uuid) ) continue;
      seen.add(uuid);
      const source = await fromUuid(uuid);
      if ( !source ) continue;
      const data = foundry.utils.deepClone(game.items.fromCompendium(source, { keepId: false }));
      data._id = foundry.utils.randomID();
      foundry.utils.setProperty(data, "flags.dnd5e.sourceId", uuid);
      const ready = (role === "spells") || ((role === "book") && prepared.has(uuid));
      foundry.utils.mergeObject(data, { system: { method, prepared: ready ? 1 : 0, sourceItem: `class:${identifier}` } });
      items.push(data);
    }
  }
  return items;
}
