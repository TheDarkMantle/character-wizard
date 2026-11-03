import { describe, expect, it } from "vitest";
import { bodyLines } from "../scripts/content/species-info.mjs";

const labels = {
  movement: k => ({ walk: "Walk", fly: "Fly" }[k] ?? k),
  sense: k => ({ darkvision: "Darkvision", blindsight: "Blindsight" }[k] ?? k),
  units: u => u,
  type: t => (t.value ? `${t.value[0].toUpperCase()}${t.value.slice(1)}${t.subtype ? ` (${t.subtype})` : ""}` : "")
};

describe("bodyLines", () => {
  it("reads the flat shape of a 2014 species", () => {
    const lines = bodyLines({
      type: { value: "humanoid", subtype: "dwarf" },
      movement: { walk: 25, fly: null, units: "ft", hover: false },
      senses: { darkvision: 60, blindsight: null, units: "ft", special: "" }
    }, labels);
    expect(lines).toEqual([
      { id: "type", title: "type", detail: "Humanoid (dwarf)" },
      { id: "speed", title: "speed", detail: "Walk 25 ft" },
      { id: "darkvision", title: "Darkvision", detail: "60 ft" }
    ]);
  });

  it("reads the 6.0 shape and skips empty values", () => {
    const lines = bodyLines({
      movement: { speeds: { walk: 30, fly: 30 }, units: "ft", hover: true },
      senses: { ranges: { darkvision: 0, blindsight: 10 }, units: "ft", special: "see invisible" }
    }, labels);
    expect(lines.map(l => `${l.title}: ${l.detail}`)).toEqual([
      "speed: Walk 30 ft, Fly 30 ft", "Blindsight: 10 ft", "senses: see invisible"
    ]);
  });
});
