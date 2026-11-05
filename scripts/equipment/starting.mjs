/**
 * Pure logic for starting equipment: turn a class or background's `startingEquipment` tree and `wealth` into the
 * decisions the player makes and the items they end up with.
 *
 * dnd5e only defines this data (and an editor for it); it never grants it. The shapes here follow its
 * `EquipmentEntryData`: `OR` and `AND` groups, specific `linked` items (key is a UUID), category entries
 * (`weapon`, `armor`, `tool`, `focus`, where the key names the category), and `currency`.
 */

/** Entry types that ask the player to pick actual items from a category. */
export const CATEGORY_TYPES = Object.freeze(["weapon", "armor", "tool", "focus"]);

/** Id of the "take gold instead" option. */
export const GOLD = "__gold";

/** Id of the synthetic option holding a background's fixed list when it is offered against gold. */
export const ITEMS = "__items";

/**
 * @typedef {object} EquipmentNode
 * @property {string} id
 * @property {string} type       OR, AND, linked, currency, weapon, armor, tool or focus.
 * @property {number} count      Defaults to 1.
 * @property {boolean} counted    The entry states a count. Without one, an item keeps its own quantity (a stack of 20 bolts).
 * @property {string} [key]      Category key, currency, or item UUID for "linked".
 * @property {boolean} [requiresProficiency]
 * @property {EquipmentNode[]} children
 */

/**
 * Build the tree from the flat entry list.
 * @param {object[]} entries  `system.startingEquipment`.
 * @returns {EquipmentNode[]}  The top-level nodes, in order.
 */
export function buildTree(entries = []) {
  const list = Array.from(entries, e => ({
    id: e._id, group: e.group || null, sort: e.sort ?? 0, type: e.type, count: e.count ?? 1,
    counted: (e.count !== null) && (e.count !== undefined),
    key: e.key || undefined, requiresProficiency: !!e.requiresProficiency, children: []
  }));
  const byId = new Map(list.map(n => [n.id, n]));
  const roots = [];
  for ( const node of list.sort((a, b) => a.sort - b.sort) ) {
    const parent = node.group ? byId.get(node.group) : null;
    if ( parent ) parent.children.push(node);
    else roots.push(node);
  }
  return roots;
}

/** Modern (2024) equipment reads "A, B or gold"; legacy (2014) is a list with separate choices. */
export function isModernStyle({ rules, worldRules }) {
  return (rules === "2024") || (!rules && (worldRules === "2024"));
}

/** A gold amount that needs no roll ("155"), or null when it is a dice formula ("5d4 * 10"). */
export function fixedGold(wealth) {
  const text = String(wealth ?? "").trim();
  return /^\d+$/.test(text) ? Number(text) : null;
}

/**
 * @typedef {object} EquipmentState  What the player has decided for one source (class or background).
 * @property {boolean} [gold]                      Take gold instead of equipment.
 * @property {number} [goldAmount]                 Rolled gold, for a formula.
 * @property {Record<string, string>} [or]         Chosen child id for each OR group (or the synthetic one).
 * @property {Record<string, string[]>} [picks]    Item UUIDs chosen for each category entry.
 */

/**
 * @typedef {object} Decision
 * @property {string} id
 * @property {EquipmentNode[]} options
 * @property {boolean} includesGold  The player may also take gold instead.
 * @property {string|null} selected  Chosen option id, or GOLD.
 */

/**
 * Work out what a source asks of the player and what it grants so far.
 * @param {object} input
 * @param {object[]} input.entries   Starting equipment entries.
 * @param {string} [input.wealth]    Gold alternative: a number or dice formula.
 * @param {boolean} input.modern     Modern or legacy presentation.
 * @param {EquipmentState} [input.state]
 * @returns {{ decisions: Decision[], grants: object[], gold: object|null, goldFormula: string|null, complete: boolean }}
 *   `grants` are `{ type: "item", uuid, count }`, `{ type: "pick", leafId, category, key, need, picked }` and
 *   `{ type: "currency", key, count }`. `gold` is the gold taken instead of equipment, when that was chosen.
 */
export function planEquipment({ entries, wealth, modern, state = {} }) {
  const roots = buildTree(entries);
  const hasWealth = !!String(wealth ?? "").trim();
  const result = { decisions: [], grants: [], gold: null, goldFormula: hasWealth ? String(wealth).trim() : null, complete: true };
  const or = state.or ?? {};
  const picks = state.picks ?? {};

  const resolve = node => {
    switch ( node.type ) {
      case "AND": node.children.forEach(resolve); break;
      case "OR": {
        result.decisions.push({ id: node.id, options: node.children, includesGold: false, selected: or[node.id] ?? null });
        const chosen = node.children.find(c => c.id === or[node.id]);
        if ( chosen ) resolve(chosen);
        else result.complete = false;
        break;
      }
      case "linked": result.grants.push({ type: "item", uuid: node.key, count: node.count, counted: node.counted }); break;
      case "currency": result.grants.push({ type: "currency", key: node.key, count: node.count }); break;
      default:
        if ( CATEGORY_TYPES.includes(node.type) ) {
          // The list can have blanks while the player fills in the selects out of order.
          const picked = (picks[node.id] ?? []).filter(Boolean);
          result.grants.push({ type: "pick", leafId: node.id, category: node.type, key: node.key, need: node.count, picked });
          if ( picked.length < node.count ) result.complete = false;
        }
    }
  };

  // Gold taken instead of the whole kit.
  const takeGold = () => {
    const amount = fixedGold(wealth) ?? state.goldAmount ?? null;
    result.gold = { formula: String(wealth).trim(), amount, fixed: fixedGold(wealth) !== null };
    if ( amount === null ) result.complete = false;
  };

  if ( modern && roots.length ) {
    // "Choose A or B": a single top-level OR is the choice; a plain list is option A against gold.
    const single = (roots.length === 1) && (roots[0].type === "OR");
    if ( single || hasWealth ) {
      const options = single ? roots[0].children : [{ id: ITEMS, type: "AND", count: 1, children: roots }];
      const id = single ? roots[0].id : ITEMS;
      const decision = { id, options, includesGold: hasWealth, selected: state.gold ? GOLD : (or[id] ?? null) };
      result.decisions.push(decision);
      if ( state.gold && hasWealth ) takeGold();
      else {
        const chosen = options.find(o => o.id === or[id]);
        if ( chosen ) resolve(chosen);
        else result.complete = false;
      }
      return result;
    }
  }

  // Legacy: each top-level OR is its own choice, anything else is simply granted; gold replaces the lot.
  if ( state.gold && hasWealth ) { takeGold(); return result; }
  roots.forEach(resolve);
  return result;
}

/**
 * Describe a node in words, for an option's label.
 * @param {EquipmentNode} node
 * @param {(node: EquipmentNode) => string} leafLabel  Names a linked item, category or currency.
 * @param {(items: string[], joiner: "and"|"or") => string} [join]  List formatter.
 * @returns {string}
 */
export function describeNode(node, leafLabel, join = (items, joiner) => items.join(joiner === "or" ? " or " : ", ")) {
  switch ( node.type ) {
    case "AND": return join(node.children.map(c => describeNode(c, leafLabel, join)).filter(Boolean), "and");
    case "OR": return join(node.children.map(c => describeNode(c, leafLabel, join)).filter(Boolean), "or");
    default: return leafLabel(node);
  }
}

/**
 * How many of an item to give. An entry that states a count means that many pieces ("20 Arrows"); one that doesn't
 * means the item as it is stored, which may be a stack ("Bolts" is a stack of 20).
 * @param {{ count: number, counted: boolean, native?: number }} input  `native` is the item's own quantity.
 */
export function quantityFor({ count, counted, native = 1 }) {
  return counted ? count : (native || 1);
}
