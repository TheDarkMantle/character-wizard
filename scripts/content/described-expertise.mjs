/**
 * Pure helpers for a feature whose text grants Expertise but whose data has no Expertise choice. The D&D Beyond import of the
 * Tasha's Ranger's Deft Explorer carries only its language pick; its "Canny" benefit ("Choose one of your skill proficiencies.
 * Your proficiency bonus is doubled for any ability check you make that uses the chosen skill") exists only as text.
 *
 * The rule is narrow: features only, only when the text states the choice in one of the books' plain forms, and never when the
 * item already has an Expertise choice of its own.
 */

/**
 * The id of the added advancement. It must be the same every time the wizard rebuilds the choices: a slot's key includes the
 * advancement id, and a key that changed on each rebuild would throw the player's selection away.
 */
export const EXPERTISE_ADVANCEMENT_ID = "cwExpertise00001";

const NUMBERS = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4 };
const NUMBER = "(a|an|one|two|three|four)";

/** "Choose one of your skill proficiencies. Your proficiency bonus is doubled ..." (Tasha's Canny, Rogue Expertise in the PHB). */
const DOUBLED = new RegExp(`\\bchoose\\s+${NUMBER}\\s+of\\s+your\\s+skill\\s+proficiencies\\b[^.]*\\.\\s*your\\s+proficiency\\s+bonus\\s+is\\s+doubled\\b`, "i");

/** "Choose one of your skill proficiencies with which you lack Expertise. You gain Expertise in that skill." (2024 wording). */
const EXPERTISE = new RegExp(`\\bchoose\\s+${NUMBER}\\s+of\\s+your\\s+skill\\s+proficiencies\\b[^.]*\\bexpertise\\b[^.]*\\.\\s*you\\s+gain\\s+expertise\\b`, "i");

function plain(html) {
  return String(html ?? "")
    .replace(/<section class="secret">[\s\S]*?<\/section>/gi, " ")
    .replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&nbsp;/g, " ").replace(/\s+/g, " ");
}

/**
 * How many skills an item's text says you gain Expertise in.
 * @param {string} html
 * @returns {number}  0 when the text doesn't say so in a recognised form.
 */
export function describedExpertise(html) {
  const match = plain(html).match(DOUBLED) ?? plain(html).match(EXPERTISE);
  return match ? NUMBERS[match[1].toLowerCase()] : 0;
}

/**
 * The Trait advancement to add to an item whose text grants Expertise but whose data doesn't.
 * @param {object} item
 * @param {string} item.type
 * @param {string} item.description
 * @param {{ mode?: string }[]} item.traits  Its Trait advancements.
 * @param {string} [item.id]  An id for the new advancement; the same fixed id by default.
 * @param {string} [item.name]  Its name, which becomes the choice's title. dnd5e fills an empty name with a generic label.
 * @returns {object|null}  Advancement source data, or null when nothing should be added.
 */
export function expertiseAdvancement({ type, description, traits, id = EXPERTISE_ADVANCEMENT_ID, name = "Expertise" }) {
  if ( type !== "feat" ) return null;
  if ( (traits ?? []).some(t => t.mode === "expertise") ) return null;
  const count = describedExpertise(description);
  if ( !count ) return null;
  return {
    _id: id, type: "Trait", level: 1, name, hint: "",
    configuration: { mode: "expertise", allowReplacements: false, grants: [], choices: [{ count, pool: ["skills:*"] }] },
    value: {}
  };
}
