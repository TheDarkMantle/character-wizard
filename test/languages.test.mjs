import { describe, expect, it } from "vitest";
import { blockedLanguageKeys, languageGroups } from "../scripts/content/languages.mjs";
import { withoutBlocked } from "../scripts/advancement/slots.mjs";

const config = {
  standard: { label: "Standard", children: { common: "Common", dwarvish: "Dwarvish" } },
  exotic: { label: "Exotic", children: {
    deep: "Deep Speech",
    primordial: { label: "Primordial", children: { aquan: "Aquan", ignan: "Ignan" } }
  } },
  cant: "Thieves' Cant",
  ddb: { label: "D&D Beyond Rare Languages", children: { ergot: "Ergot", aklo: "Aklo" } }
};

describe("languageGroups", () => {
  const groups = languageGroups(config, k => k, "Other");

  it("makes a group per category and flattens nested ones", () => {
    expect(groups.map(g => g.id)).toEqual(["standard", "exotic", "ddb", "other"]);
    expect(groups[1].languages.map(l => l.path)).toEqual(["exotic:primordial:aquan", "exotic:deep", "exotic:primordial:ignan"]);
  });

  it("sorts by label and collects uncategorised languages", () => {
    expect(groups[2].languages.map(l => l.label)).toEqual(["Aklo", "Ergot"]);
    expect(groups[3].languages).toEqual([{ path: "cant", label: "Thieves' Cant" }]);
  });
});

describe("blocking", () => {
  it("turns paths into trait keys", () => {
    expect([...blockedLanguageKeys(["ddb:ergot"])]).toEqual(["languages:ddb:ergot"]);
  });

  it("removes blocked options and keeps the pick count reachable", () => {
    const blocked = blockedLanguageKeys(["ddb:ergot", "ddb:aklo"]);
    const group = { options: ["languages:ddb:ergot", "languages:ddb:aklo", "languages:standard:common"], count: 2 };
    expect(withoutBlocked(group, blocked)).toEqual({ options: ["languages:standard:common"], count: 1 });
    expect(withoutBlocked(group, new Set())).toBe(group);
  });
});
