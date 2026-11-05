import { describe, expect, it } from "vitest";
import { backgroundFeature } from "../scripts/content/background-feature.mjs";

describe("backgroundFeature", () => {
  it("takes the feature's own section at the end of an imported description", () => {
    const html = '<div><p><strong>Equipment:</strong> A discus</p><hr><h5>Feature: Echoes of Victory</h5><p>You have attracted admiration.</p><h2>Echoes of Victory</h2><p>You have attracted admiration.</p><p>Between adventures, you might compete.</p></div>';
    expect(backgroundFeature(html)).toEqual({
      name: "Echoes of Victory", html: "<p>You have attracted admiration.</p><p>Between adventures, you might compete.</p>"
    });
  });

  it("accepts a closing heading with no Feature label after the equipment", () => {
    const html = "<div><p><strong>Equipment:</strong> clothes</p><h2>Knightly Regard</h2><p>You receive shelter.</p></div>";
    expect(backgroundFeature(html)).toEqual({ name: "Knightly Regard", html: "<p>You receive shelter.</p>" });
  });

  it("falls back to the text after a Feature label and tidies capitals", () => {
    const html = '<div><blockquote><p><strong>FEATURE: RUSTIC HOSPITALITY</strong></p><p>Since you come.</p></blockquote><hr><p>More</p></div>';
    expect(backgroundFeature(html)).toEqual({ name: "Rustic Hospitality", html: "<p>Since you come.</p>" });
  });

  it("finds nothing when the description has no feature", () => {
    expect(backgroundFeature("<div><p>Flavor only</p></div>")).toBeNull();
  });
});
