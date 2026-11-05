/**
 * The feature of a background that only exists in its description.
 *
 * The system's own 2014 backgrounds grant their feature as an item ("Shelter of the Faithful"). Imported ones (D&D
 * Beyond) usually don't: the feature is a heading and a couple of paragraphs inside the background's description, so
 * the character gets no feature on the sheet. This finds that section so the wizard can add it as a feature item.
 */

const clean = html => String(html).replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();

/** "RUSTIC HOSPITALITY" → "Rustic Hospitality"; mixed case is left alone. */
function tidy(name) {
  if ( name !== name.toUpperCase() ) return name;
  return name.toLowerCase().replace(/\b[a-z]/g, c => c.toUpperCase()).replace(/\b(Of|The|And|For|To|In|A)\b(?!^)/g, w => w.toLowerCase())
    .replace(/^./, c => c.toUpperCase());
}

/**
 * @param {string} html  The background's description.
 * @returns {{ name: string, html: string }|null}
 */
export function backgroundFeature(html) {
  const text = String(html ?? "");
  const headings = [...text.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/gi)];
  const last = headings.at(-1);
  const label = text.match(/feature:\s*([^<]+)/i)?.[1]?.trim();

  // A heading at the end of the description is the feature's own section: "<h2>Echoes of Victory</h2><p>…</p>".
  if ( last ) {
    const name = clean(last[1]);
    const after = text.slice(last.index + last[0].length).replace(/<\/div>\s*$/i, "").trim();
    const sameAsLabel = label && (clean(label).toLowerCase() === name.toLowerCase());
    // Without a "Feature:" label the heading still counts when it follows the equipment or the suggested traits.
    const followsDetails = /equipment:|suggested characteristics/i.test(text.slice(0, last.index));
    if ( name && after && (name.split(" ").length <= 6) && (sameAsLabel || (!label && followsDetails)) ) {
      return { name: tidy(name), html: after };
    }
  }

  // Otherwise the text right after a "Feature: Name" heading, up to the next rule or heading.
  if ( label ) {
    const start = text.search(/feature:\s*[^<]+/i);
    const rest = text.slice(start).replace(/^feature:\s*[^<]+<\/[^>]+>/i, "");
    const body = rest.replace(/^(\s*<\/[^>]+>)+/, "").split(/<hr|<h\d|<\/blockquote>|<table/i)[0].trim();
    if ( clean(body) ) return { name: tidy(clean(label)), html: body };
  }
  return null;
}
