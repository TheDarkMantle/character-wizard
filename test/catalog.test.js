import test from "node:test";
import assert from "node:assert/strict";
import { CharacterDraft, contentRules, isEligible } from "../scripts/rules.js";
import { CompendiumCatalog } from "../scripts/catalog.js";

const item = (rules, extra = {}) => ({
  _id: "background", uuid: "Compendium.world.origins.Item.background", pack: "world.origins",
  name: "Acolyte", type: "background", system: { source: { rules } }, ...extra
});
const pack = (entries, extra = {}) => ({
  collection: "world.origins", documentName: "Item", visible: true,
  metadata: { label: "Origins", system: "dnd5e" },
  getIndex: async () => entries,
  getDocument: async id => {
    const entry = entries.find(e => e._id === id);
    return entry ? { type: entry.type, toObject: () => entry } : null;
  },
  ...extra
});
const catalog = (packs, settings = () => ({})) => new CompendiumCatalog({
  packs: () => packs, settings, warn: () => {}
});

// Model the server's nested projection, including the source field indexed by D&D5e.
function indexProjection(fields) {
  const projection = {};
  for (const path of new Set(["name", "img", "type", "system.source", ...fields])) {
    const keys = path.split(".");
    const last = keys.pop();
    let node = projection;
    for (const key of keys) {
      if (!(key in node)) node[key] = {};
      node = node[key];
    }
    if (!(last in node)) node[last] = 1;
  }
  return projection;
}

test("D&D5e source projection loads both editions without parent/child field collisions", async () => {
  assert.throws(() => indexProjection(["system.source.rules"]), /Cannot use 'in' operator/);
  let calls = 0;
  const source = pack([item("2014"), item("2024", { _id: "modern" })], {
    getIndex: async ({ fields }) => {
      calls++;
      const projection = indexProjection(fields);
      assert.equal(projection.system.source, 1);
      return [item("2014"), item("2024", { _id: "modern" })];
    }
  });
  const api = catalog([source]);
  for (const ruleset of ["2014", "2024"]) {
    const result = await api.discover({ ruleset });
    assert.deepEqual(result.unavailable, []);
    assert.equal(result.items.length, 1);
    assert.equal(result.items[0].system.source.rules, ruleset);
  }
  assert.equal(calls, 2);
});

test("both editions reject backgrounds from the other edition and unknown editions", () => {
  for (const rules of ["2014", "2024"]) {
    assert.equal(isEligible(item(rules), rules), true);
    assert.equal(isEligible(item(rules === "2014" ? "2024" : "2014"), rules), false);
    assert.equal(isEligible(item(undefined), rules), false);
  }
  assert.throws(() => isEligible(item("2024"), "modern"));
});

test("GM item designation overrides metadata; pack default only fills unknown metadata", () => {
  const designations = { items: {}, packs: { "world.origins": "2024" } };
  assert.equal(contentRules(item("2014"), designations), "2014");
  assert.equal(contentRules(item(undefined), designations), "2024");
  designations.items[item().uuid] = "2014";
  assert.equal(contentRules(item("2024"), designations), "2014");
});

test("draft rejects incompatible content and invalidates selections on edition change", () => {
  const draft = new CharacterDraft("2024");
  assert.throws(() => draft.select("background", item("2014")));
  draft.select("background", item("2024"));
  draft.setRuleset("2024");
  assert.equal(draft.selections.size, 1);
  assert.throws(() => draft.setRuleset("2025"));
  assert.equal(draft.selections.size, 1);
  draft.setRuleset("2014");
  assert.deepEqual(draft.toJSON(), { schemaVersion: 1, ruleset: "2014", selections: {} });
});

test("catalog discovers mixed packs without merging identical names", async () => {
  const entries = [item("2014"), item("2024", { _id: "modern" }), item(undefined, { _id: "unknown" })];
  const result = await catalog([
    pack(entries), pack([item("2024")], { collection: "module.origins" })
  ]).discover({ ruleset: "2024", type: "background" });
  assert.equal(result.items.length, 2);
  assert.equal(new Set(result.items.map(i => i.uuid)).size, 2);
  assert.equal(result.unclassified, 1);
});

test("catalog respects access, exclusions and game system, and reports failed packs", async () => {
  const result = await catalog([
    pack([item("2024")], { visible: false }),
    pack([item("2024")], { collection: "world.excluded" }),
    pack([item("2024")], { metadata: { system: "pf2e" } }),
    pack([], { collection: "world.broken", getIndex: async () => { throw Error("offline"); } }),
    pack([item("2024")], { collection: "world.allowed" })
  ], () => ({ excludedPacks: ["world.excluded"] })).discover({ ruleset: "2024" });
  assert.equal(result.items.length, 1);
  assert.deepEqual(result.unavailable, ["world.broken"]);
});

test("resolution rechecks settings, access, edition, and document existence", async () => {
  let settings = {};
  const source = pack([item("2024")]);
  const api = catalog([source], () => settings);
  assert.ok(await api.resolve(item().uuid, "2024"));
  await assert.rejects(api.resolve(item().uuid, "2014"));
  await assert.rejects(api.resolve("Compendium.world.origins.Item.missing", "2024"));
  settings = { excludedPacks: [source.collection] };
  await assert.rejects(api.resolve(item().uuid, "2024"));
  settings = {};
  source.visible = false;
  await assert.rejects(api.resolve(item().uuid, "2024"));
});
