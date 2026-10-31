/**
 * Turn an item's advancement data into "granted" entries and "choice" slots for the features board.
 * Works on plain source data (item.toObject().system.advancement) so it can be unit tested without Foundry.
 *
 * Shapes follow dnd5e 6.0 advancement data:
 *  - ItemGrant:  configuration.items [{ uuid, optional }], configuration.optional, level
 *  - ItemChoice: configuration.choices { [level]: { count, replacement } }, configuration.pool [{ uuid }],
 *                configuration.restriction { type, subtype, list, level }
 *  - Trait:      configuration.grants [key], configuration.choices [{ count, pool [key] }], configuration.mode, level
 *  - AbilityScoreImprovement, Subclass, Size, HitPoints, ScaleValue
 */

const MAX_LEVEL = 20;

/** Levels at which an advancement does something. Mirrors each type's `levels` getter. */
export function levelsOf(adv, { itemType } = {}) {
  const config = adv.configuration ?? {};
  switch ( adv.type ) {
    case "ItemChoice": return Object.keys(config.choices ?? {}).map(Number);
    case "ScaleValue": return Object.keys(config.scale ?? {}).map(Number)
      .filter(l => !["class", "subclass"].includes(itemType) || l !== 0);
    case "HitPoints": return Array.from({ length: MAX_LEVEL }, (_, i) => i + 1);
    case "Size": return [0];
    default: return adv.level !== undefined && adv.level !== null ? [Number(adv.level)] : [];
  }
}

/** Does this advancement apply to the character's first (original) class? */
export function appliesToClass(adv, { isOriginalClass = true } = {}) {
  if ( !adv.classRestriction ) return true;
  if ( adv.classRestriction === "primary" ) return isOriginalClass !== false;
  if ( adv.classRestriction === "secondary" ) return !isOriginalClass;
  return true;
}

/**
 * @typedef {object} BoardEntry
 * @property {string} id            `${advancementId}:${level}` plus a suffix for multi-part entries.
 * @property {string} advancementId
 * @property {string} type          Advancement type.
 * @property {string} title
 * @property {number} level
 * @property {"granted"|"choice"|"info"|"native"} kind
 * @property {string} [choiceType]  For choices: "item", "trait", "asi", "subclass", "size", "optional-item".
 * @property {number} [count]       How many picks.
 * @property {string[]} [items]     Granted or optional item UUIDs.
 * @property {string[]} [pool]      Item UUIDs or trait keys to choose from.
 * @property {object} [restriction] ItemChoice restriction, used to search compendiums when the pool is open.
 * @property {string[]} [traits]    Granted trait keys.
 * @property {string} [mode]        Trait mode (default, expertise, mastery, ...).
 */

/** Known types; anything else falls back to the system's own dialog. */
const KNOWN = new Set(["ItemGrant", "ItemChoice", "Trait", "HitPoints", "AbilityScoreImprovement",
  "Subclass", "Size", "ScaleValue"]);

/**
 * Describe one advancement at one level.
 * @returns {BoardEntry[]}
 */
export function describeAdvancement(adv, level) {
  const config = adv.configuration ?? {};
  const base = { advancementId: adv._id, type: adv.type, title: adv.title || adv.type, level };
  const id = `${adv._id}:${level}`;

  switch ( adv.type ) {
    case "ItemGrant": {
      const items = config.items ?? [];
      const optional = config.optional || items.some(i => i.optional);
      if ( optional ) return [{ ...base, id, kind: "choice", choiceType: "optional-item",
        count: items.length, items: items.map(i => i.uuid) }];
      return [{ ...base, id, kind: "granted", items: items.map(i => i.uuid) }];
    }

    case "ItemChoice": {
      const count = config.choices?.[level]?.count ?? 0;
      if ( !count ) return [];
      return [{ ...base, id, kind: "choice", choiceType: "item", count,
        pool: (config.pool ?? []).map(p => p.uuid), restriction: config.restriction ?? {},
        replacement: !!config.choices[level]?.replacement }];
    }

    case "Trait": {
      const out = [];
      const grants = Array.from(config.grants ?? []);
      if ( grants.length ) out.push({ ...base, id: `${id}:grants`, kind: "granted", traits: grants,
        mode: config.mode ?? "default" });
      (config.choices ?? []).forEach((choice, i) => {
        const pool = Array.from(choice.pool ?? []);
        // A "choice" of one option is effectively a grant.
        if ( pool.length === 1 && (choice.count ?? 1) === 1 ) {
          out.push({ ...base, id: `${id}:choice${i}`, kind: "granted", traits: pool, mode: config.mode ?? "default" });
        } else {
          out.push({ ...base, id: `${id}:choice${i}`, kind: "choice", choiceType: "trait",
            count: choice.count ?? 1, pool, mode: config.mode ?? "default" });
        }
      });
      return out;
    }

    case "HitPoints":
      return [{ ...base, id, kind: level === 1 ? "granted" : "choice", choiceType: "hit-points",
        count: level === 1 ? 0 : 1 }];

    case "AbilityScoreImprovement":
      return [{ ...base, id, kind: "choice", choiceType: "asi", count: 1,
        points: config.points ?? 0, cap: config.cap ?? 2, fixed: config.fixed ?? {}, locked: config.locked ?? [] }];

    case "Subclass":
      return [{ ...base, id, kind: "choice", choiceType: "subclass", count: 1 }];

    case "Size": {
      const sizes = Array.from(config.sizes ?? []);
      if ( sizes.length > 1 ) return [{ ...base, id, kind: "choice", choiceType: "size", count: 1, pool: sizes }];
      return [{ ...base, id, kind: "granted", traits: sizes.map(s => `size:${s}`) }];
    }

    case "ScaleValue":
      return [{ ...base, id, kind: "info" }];

    default:
      return KNOWN.has(adv.type) ? [] : [{ ...base, id, kind: "native" }];
  }
}

/**
 * Build board entries for an item from `fromLevel` to `toLevel` (inclusive).
 * For classes, levels are class levels. For species/backgrounds/feats, use 0..character level.
 * @param {object[]} advancements  item.system.advancement source data.
 * @param {object} options
 * @param {number} [options.fromLevel=0]
 * @param {number} options.toLevel
 * @param {string} [options.itemType]
 * @param {boolean} [options.isOriginalClass=true]
 * @returns {{ granted: BoardEntry[], choices: BoardEntry[], info: BoardEntry[], native: BoardEntry[] }}
 */
export function buildBoard(advancements = [], { fromLevel = 0, toLevel, itemType, isOriginalClass = true } = {}) {
  const board = { granted: [], choices: [], info: [], native: [] };
  const list = Array.isArray(advancements) ? advancements : Object.values(advancements);
  for ( let level = fromLevel; level <= toLevel; level++ ) {
    for ( const adv of list ) {
      if ( !appliesToClass(adv, { isOriginalClass }) ) continue;
      if ( !levelsOf(adv, { itemType }).includes(level) ) continue;
      for ( const entry of describeAdvancement(adv, level) ) {
        if ( entry.kind === "choice" && entry.count === 0 ) continue;
        board[entry.kind === "choice" ? "choices" : entry.kind].push(entry);
      }
    }
  }
  return board;
}

/** Number of picks still needed given the current selections ({ [entryId]: string[] }). */
export function remainingChoices(board, selections = {}) {
  return board.choices.reduce((n, entry) => {
    const picked = selections[entry.id]?.length ?? 0;
    return n + Math.max(0, entry.count - picked);
  }, 0);
}
