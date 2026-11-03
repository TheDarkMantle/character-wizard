/**
 * Pure formatting of a species' body traits (speed, senses, creature type) for the "You get" list.
 * These live on the species item rather than in an advancement, and the system applies them to the actor itself.
 */

/**
 * @param {object} system  A species item's `system` data. Accepts both the 6.0 shapes (`movement.speeds`,
 *                         `senses.ranges`) and the older flat ones.
 * @param {object} labels
 * @param {(key: string) => string} labels.movement  Label for a movement type ("walk" → "Walk").
 * @param {(key: string) => string} labels.sense     Label for a sense ("darkvision" → "Darkvision").
 * @param {(units: string) => string} labels.units   Abbreviation for a unit ("ft").
 * @param {(type: object) => string} labels.type     Label for a creature type object.
 * @returns {{ id: string, title: string, detail: string }[]}
 */
export function bodyLines(system = {}, labels) {
  const lines = [];
  const type = labels.type(system.type ?? {});
  if ( type ) lines.push({ id: "type", title: "type", detail: type });

  const movement = system.movement ?? {};
  const speeds = movement.speeds ?? movement;
  const moveUnits = labels.units(movement.units || "ft");
  const speed = Object.entries(speeds)
    .filter(([key, value]) => (key !== "units") && (key !== "hover") && Number(value) > 0)
    .map(([key, value]) => `${labels.movement(key)} ${value} ${moveUnits}`);
  if ( speed.length ) lines.push({ id: "speed", title: "speed", detail: speed.join(", ") });

  const senses = system.senses ?? {};
  const ranges = senses.ranges ?? senses;
  const senseUnits = labels.units(senses.units || "ft");
  for ( const [key, value] of Object.entries(ranges) ) {
    if ( ["units", "special"].includes(key) || !(Number(value) > 0) ) continue;
    lines.push({ id: key, title: labels.sense(key), detail: `${value} ${senseUnits}` });
  }
  if ( senses.special ) lines.push({ id: "special", title: "senses", detail: String(senses.special) });
  return lines;
}
