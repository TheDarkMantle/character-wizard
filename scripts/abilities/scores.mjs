/**
 * Pure logic for the ability scores step: the generation methods, point buy and the arithmetic around them.
 * Nothing here touches Foundry, so it is unit tested in Node.
 */

/** The standard array. */
export const STANDARD_ARRAY = Object.freeze([15, 14, 13, 12, 10, 8]);

/** Point buy: 27 points, scores 8 to 15 before bonuses. */
export const POINT_BUY = Object.freeze({
  budget: 27, min: 8, max: 15,
  costs: Object.freeze({ 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 })
});

/** Highest ability score the rules allow, and lowest the wizard accepts when typing scores in. */
export const SCORE_MAX = 20;
export const SCORE_MIN = 1;

/** Methods, in the order they are offered. `custom` only appears when the GM has set an array. */
export const METHODS = Object.freeze(["standard", "pointbuy", "roll", "manual", "custom"]);

/** Ability modifier for a score. */
export function modifier(score) {
  return Math.floor((score - 10) / 2);
}

/**
 * Parse the GM's custom array: six whole numbers separated by commas, spaces or semicolons.
 * @param {string} text
 * @param {number} [count=6]
 * @returns {number[]|null}  The array, highest first, or null when it isn't a usable array.
 */
export function parseArray(text, count = 6) {
  const parts = String(text ?? "").split(/[\s,;]+/).filter(Boolean);
  if ( parts.length !== count ) return null;
  const numbers = parts.map(Number);
  if ( numbers.some(n => !Number.isInteger(n) || (n < SCORE_MIN) || (n > SCORE_MAX)) ) return null;
  return numbers.sort((a, b) => b - a);
}

/** Dice formula for one rolled score: 4d6 drop lowest, optionally rerolling 1s (an old-school house rule). */
export function rollFormula(rerollOnes = false) {
  return rerollOnes ? "4d6rr1dl1" : "4d6dl1";
}

/**
 * Values from an array that no other ability is using. For an ability's own dropdown, its current value stays
 * available. An array with repeated values (15, 15, ...) can be used that many times.
 * @param {number[]} array
 * @param {Record<string, number>} scores   Assigned scores by ability.
 * @param {string[]} ids                    All ability ids.
 * @param {string} [exceptId]               Ability whose own value should be treated as unassigned.
 * @returns {number[]}  Highest first.
 */
export function remainingValues(array, scores, ids, exceptId) {
  const pool = [...array];
  for ( const id of ids ) {
    if ( id === exceptId ) continue;
    const index = pool.indexOf(scores[id]);
    if ( (scores[id] !== undefined) && (index !== -1) ) pool.splice(index, 1);
  }
  return pool.sort((a, b) => b - a);
}

/** Points spent in point buy. An unset ability counts as 8. */
export function pointBuySpent(scores, ids) {
  return ids.reduce((sum, id) => sum + (POINT_BUY.costs[scores[id] ?? POINT_BUY.min] ?? 0), 0);
}

/**
 * Raise or lower one ability in point buy, within 8 to 15 and the budget.
 * @returns {Record<string, number>}  New scores, or the same object when the change isn't allowed.
 */
export function adjustPointBuy(scores, id, delta, ids) {
  const next = (scores[id] ?? POINT_BUY.min) + delta;
  if ( (next < POINT_BUY.min) || (next > POINT_BUY.max) ) return scores;
  const updated = { ...scores, [id]: next };
  return (pointBuySpent(updated, ids) > POINT_BUY.budget) ? scores : updated;
}

/**
 * Are the scores complete for the chosen method?
 * @param {string} method
 * @param {Record<string, number>} scores
 * @param {string[]} ids
 * @param {number[]} [array]  The array in play for array methods (standard, custom, rolled).
 */
export function isComplete(method, scores, ids, array = []) {
  switch ( method ) {
    case "pointbuy":
      return ids.every(id => (scores[id] >= POINT_BUY.min) && (scores[id] <= POINT_BUY.max))
        && (pointBuySpent(scores, ids) <= POINT_BUY.budget);
    case "manual":
      return ids.every(id => Number.isInteger(scores[id]) && (scores[id] >= SCORE_MIN) && (scores[id] <= SCORE_MAX));
    case "standard":
    case "custom":
    case "roll":
      return (array.length === ids.length) && ids.every(id => scores[id] !== undefined)
        && (remainingValues(array, scores, ids).length === 0);
    default:
      return false;
  }
}

/**
 * Base score, bonus and final score for each ability.
 * @param {Record<string, number>} base    Chosen base scores.
 * @param {Record<string, number>} finals  Scores after the species and background bonuses were applied.
 * @param {string[]} ids
 */
export function breakdown(base, finals, ids) {
  return ids.map(id => {
    const baseScore = base[id];
    // Without a base score there is nothing to add the bonus to.
    const final = (baseScore === undefined) ? undefined : (finals[id] ?? baseScore);
    return {
      id, base: baseScore, final,
      bonus: (baseScore !== undefined && final !== undefined) ? final - baseScore : 0,
      mod: (final !== undefined) ? modifier(final) : undefined
    };
  });
}
