/**
 * Prerequisites written into a feat's description.
 *
 * Imported 2024 Eldritch Invocations carry a wrong level in their data (Devil's Sight says level 1) while the
 * description says "Prerequisite: Level 2+ Warlock". The description is the text players read, so it wins when it asks
 * for more than the data does.
 */

const plain = html => String(html ?? "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();

/**
 * The level and named Pact a description's "Prerequisite:" line asks for.
 * @param {string} html  The feat's description.
 * @returns {{ level: number, items: string[] }}
 */
export function textPrerequisites(html) {
  const source = String(html ?? "");
  const at = source.search(/prerequisites?\s*:/i);
  if ( at === -1 ) return { level: 0, items: [] };
  // The prerequisite is its own paragraph ("Level 5+ Warlock, Pact of the Blade"); don't read on into the feat's text.
  const paragraph = source.slice(at).split(/<\/(?:p|blockquote|li|div)>|<br|\n/i)[0];
  const line = plain(paragraph).replace(/^prerequisites?\s*:\s*/i, "").slice(0, 120);
  const level = Number(line.match(/level\s*(\d+)/i)?.[1] ?? line.match(/(\d+)(?:st|nd|rd|th)[- ]level/i)?.[1]) || 0;
  const items = Array.from(line.matchAll(/pact of the (\w+)/gi), m => `pact-of-the-${m[1].toLowerCase()}`);
  return { level, items };
}

/**
 * Combine the data's prerequisites with those in the description: the higher level, and the items from the data or,
 * when it lists none, from the text.
 */
export function mergePrerequisites(data = {}, text = {}) {
  const items = (data.items?.length ? data.items : text.items) ?? [];
  return { level: Math.max(data.level ?? 0, text.level ?? 0), items: Array.from(items) };
}
