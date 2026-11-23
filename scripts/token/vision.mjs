/**
 * Token vision for a new character.
 *
 * dnd5e derives a placed token's sight (darkvision and the like) from the actor's senses, but it leaves the actor's prototype
 * token as it was, so a new Dwarf's prototype token shows no darkvision. This copies the sense-derived sight and detection
 * modes onto the prototype token, the same values dnd5e itself would work out for the actor.
 */

/**
 * The prototype token's vision once the actor's senses are applied.
 * @param {Actor5e} actor  The actor, after the species, class and background have been applied.
 * @returns {{ sight: object, detectionModes: object }|null}  Data for `prototypeToken`, or null when there is nothing to
 *   add (the actor has no senses that grant sight or detection) or the system can't work it out (dnd5e before 6.1).
 */
export function senseVision(actor) {
  const TokenDocument = CONFIG.Token?.documentClass;
  const senses = actor.system.attributes?.senses;
  if ( !senses || (typeof TokenDocument?.computeSenseOverrides !== "function") ) return null;
  const { sight, detectionModes } = TokenDocument.computeSenseOverrides(senses);
  if ( !sight.enabled && foundry.utils.isEmpty(detectionModes) ) return null;
  const source = actor.prototypeToken.toObject();
  const target = { sight: foundry.utils.deepClone(source.sight), detectionModes: foundry.utils.deepClone(source.detectionModes ?? {}) };
  TokenDocument.applySenseOverrides(senses, target);
  return target;
}
