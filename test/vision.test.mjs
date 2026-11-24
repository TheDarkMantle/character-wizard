import { describe, expect, it } from "vitest";
import { mergeSenseRanges } from "../scripts/token/vision.mjs";

describe("mergeSenseRanges", () => {
  it("adds a species' darkvision to an actor that has none", () => {
    const actor = { blindsight: null, darkvision: null, tremorsense: null, truesight: null };
    expect(mergeSenseRanges(actor, { darkvision: 120, blindsight: null })).toMatchObject({ darkvision: 120, blindsight: null });
  });

  it("keeps the larger range", () => {
    expect(mergeSenseRanges({ darkvision: 60 }, { darkvision: 120 }).darkvision).toBe(120);
    expect(mergeSenseRanges({ darkvision: 120 }, { darkvision: 60 }).darkvision).toBe(120);
  });

  it("copes with no species or no ranges", () => {
    expect(mergeSenseRanges({ darkvision: 60 }, undefined)).toEqual({ darkvision: 60 });
    expect(mergeSenseRanges(undefined, { darkvision: 60 })).toEqual({ darkvision: 60 });
  });
});
