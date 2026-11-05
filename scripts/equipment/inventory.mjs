import { builtInPack, fillQuivers, matchItemName, parsePackDescription } from "./packs.mjs";
import { quantityFor } from "./starting.mjs";
import { rankedGear } from "./gear.mjs";

/**
 * Foundry-side equipment: expand packs, resolve what a character is granted into inventory lines, and turn those
 * lines into item data.
 *
 * @typedef {object} InventoryLine
 * @property {string} uuid
 * @property {string} name
 * @property {string} img
 * @property {number} count          How many separate copies (a pack is made once each).
 * @property {number} quantity       The item\'s quantity on the character: the stated count, or its own stack size.
 * @property {InventoryLine[]} [children]   What is inside, for a pack.
 * @property {string[]} [unresolved]        Names in a pack's description that matched no item.
 * @property {string} [source]              Where a pack's contents came from: contents, description, table or none.
 * @property {boolean} [missing]            The item couldn't be found, so it can't be granted.
 */

/** Compendium id and document id of a compendium UUID. */
function locate(uuid) {
  const parsed = foundry.utils.parseUuid(uuid);
  return { pack: parsed?.collection?.collection ?? null, id: parsed?.documentId ?? null };
}

/**
 * What is in a pack. Contents stored inside the container come first, then the pack's description (item links or a
 * plain list), then the built-in table of 2014 SRD packs.
 * @param {string} uuid                                    The container item.
 * @param {object} context
 * @param {import("./gear.mjs").GearEntry[]} context.gear
 * @param {string} context.rules                           The world's rules.
 * @param {string[]} [context.packOrder]
 * @returns {Promise<{ children: InventoryLine[], unresolved: string[], source: string }>}
 */
export async function packContents(uuid, { gear, rules, packOrder = [] }) {
  const { pack, id } = locate(uuid);
  // `explicit` is false when the text only names the item, so it keeps its own quantity (a stack of 20 bolts).
  const line = (itemUuid, count, explicit = true) => {
    const doc = fromUuidSync(itemUuid);
    const quantity = quantityFor({ count, counted: explicit, native: doc?.system?.quantity });
    return { uuid: itemUuid, name: doc?.name ?? itemUuid, img: doc?.img, count: quantity, quantity, missing: !doc };
  };

  // 1. Items actually stored in the container.
  const stored = gear.filter(g => id && (g.container === id) && (g.pack === pack));
  if ( stored.length ) return { children: stored.map(g => line(g.uuid, g.quantity)), unresolved: [], source: "contents" };

  // 2. The description, 3. the built-in table.
  const doc = await fromUuid(uuid);
  let source = "description";
  let lines = parsePackDescription(doc?.system?.description?.value ?? "");
  if ( !lines.length && (doc?.system?.source?.rules !== "2024") ) {
    lines = builtInPack(doc?.system?.identifier ?? "");
    source = "table";
  }
  if ( !lines.length ) return { children: [], unresolved: [], source: "none" };

  const candidates = rankedGear(gear, { rules, packOrder, preferPack: pack });
  const children = [];
  const unresolved = [];
  for ( const wanted of lines ) {
    if ( wanted.uuid && fromUuidSync(wanted.uuid) ) { children.push(line(wanted.uuid, wanted.qty, wanted.explicit)); continue; }
    const match = matchItemName(wanted.names, candidates);
    if ( match ) children.push(line(match.uuid, wanted.qty, wanted.explicit));
    else unresolved.push(wanted.names.at(-1));
  }
  return { children, unresolved, source };
}

/**
 * Turn the items a character is granted into inventory lines, with packs opened up. The same item granted twice
 * (two sources both give a backpack) stays two lines, as it would in a real inventory.
 * @param {{ uuid: string, count: number }[]} grants
 * @param {object} context  As for `packContents`.
 * @returns {Promise<InventoryLine[]>}
 */
export async function resolveInventory(grants, context) {
  const lines = [];
  for ( const grant of grants ) {
    const doc = fromUuidSync(grant.uuid);
    const count = grant.count ?? 1;
    const quantity = quantityFor({ count, counted: !!grant.counted, native: doc?.system?.quantity });
    const line = { uuid: grant.uuid, name: doc?.name ?? grant.uuid, img: doc?.img, count, quantity, missing: !doc };
    if ( doc?.type === "container" ) Object.assign(line, await packContents(grant.uuid, context));
    lines.push(line);
  }
  return fillQuivers(lines);
}

/** Item data from a compendium item, ready to add to an actor. */
async function itemData(uuid, { quantity = 1, container = null } = {}) {
  const source = await fromUuid(uuid);
  if ( !source ) return null;
  const data = foundry.utils.deepClone(game.items.fromCompendium(source, { keepId: false }));
  data._id = foundry.utils.randomID();
  foundry.utils.setProperty(data, "flags.dnd5e.sourceId", source.uuid);
  data.system.quantity = quantity;
  data.system.container = container;
  return data;
}

/**
 * Item data for every line, with a pack's contents stored inside it.
 * @param {InventoryLine[]} lines
 * @returns {Promise<object[]>}
 */
export async function inventoryItems(lines) {
  const items = [];
  for ( const line of lines ) {
    if ( line.missing ) continue;
    const isPack = line.children !== undefined;
    // Several of something stack, except a pack, which is made once for each.
    for ( let n = 0; n < (isPack ? line.count : 1); n++ ) {
      const data = await itemData(line.uuid, { quantity: isPack ? 1 : line.quantity });
      if ( !data ) continue;
      items.push(data);
      for ( const child of line.children ?? [] ) {
        if ( child.missing ) continue;
        const inner = await itemData(child.uuid, { quantity: child.quantity, container: data._id });
        if ( inner ) items.push(inner);
      }
    }
  }
  return items;
}
