/**
 * Token vision for a new character.
 *
 * dnd5e derives a placed token's sight (darkvision and the like) from the actor's senses, but it leaves the actor's prototype
 * token as it was, so a new Dwarf's prototype token shows no darkvision. This copies the sense-derived sight and detection
 * modes onto the prototype token, the same values dnd5e itself would work out for the actor.
 */

/**
 * Sense ranges with a species' own ranges added. While the wizard builds the character on a copy of the actor, the species
 * isn't yet the actor's recorded species, so dnd5e hasn't merged its senses (a Dwarf's darkvision) into the actor's.
 * The larger range wins for each sense.
 * @param {Record<string, number|null>} [actorRanges]
 * @param {Record<string, number|null>} [speciesRanges]
 * @returns {Record<string, number|null>}
 */
export function mergeSenseRanges(actorRanges = {}, speciesRanges = {}) {
  const merged = { ...actorRanges };
  for ( const [key, range] of Object.entries(speciesRanges ?? {}) ) {
    if ( Number(range) > Number(merged[key] ?? 0) ) merged[key] = Number(range);
  }
  return merged;
}

/**
 * The prototype token's vision once the actor's senses are applied.
 * @param {Actor5e} actor  The actor, after the species, class and background have been applied.
 * @returns {{ sight: object, detectionModes: object }|null}  Data for `prototypeToken`, or null when there is nothing to
 *   add (the actor has no senses that grant sight or detection) or the system can't work it out (dnd5e before 6.1).
 */
export function senseVision(actor) {
  const TokenDocument = CONFIG.Token?.documentClass;
  const own = actor.system.attributes?.senses;
  if ( !own || (typeof TokenDocument?.computeSenseOverrides !== "function") ) return null;
  const species = actor.items.find(i => i.type === "race");
  const senses = { ...own, ranges: mergeSenseRanges(own.ranges, species?.system?.senses?.ranges) };
  const { sight, detectionModes } = TokenDocument.computeSenseOverrides(senses);
  if ( !sight.enabled && foundry.utils.isEmpty(detectionModes) ) return null;
  const source = actor.prototypeToken.toObject();
  const target = { sight: foundry.utils.deepClone(source.sight), detectionModes: foundry.utils.deepClone(source.detectionModes ?? {}) };
  TokenDocument.applySenseOverrides(senses, target);
  return target;
}
