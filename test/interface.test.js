import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import Handlebars from "handlebars";
import { choiceLabel } from "../scripts/presentation.js";

globalThis.foundry = { applications: { api: {
  ApplicationV2: class { async render() { return this; } },
  HandlebarsApplicationMixin: base => base
} } };
const { CharacterWizard } = await import("../scripts/wizard.js");
const template = Handlebars.compile(await readFile(new URL("../templates/wizard.hbs", import.meta.url), "utf8"));
const entries = [
  { uuid: "srd", name: "Barbarian", type: "class", ruleset: "2024", packLabel: "SRD", system: { source: { rules: "2024", book: "SRD 5.2" } } },
  { uuid: "ddb", name: "Barbarian", type: "class", ruleset: "2024", packLabel: "DDB Classes", system: { source: { rules: "2024", book: "Player's Handbook" } } }
];

test("labels preserve authored SRD versions without guessing missing source metadata", () => {
  assert.equal(choiceLabel(entries[0]), "Barbarian (2024 · SRD 5.2)");
  assert.equal(choiceLabel({ name: "Barbarian", ruleset: "2014" }), "Barbarian (2014)");
});

test("class view preserves duplicate source entries and searches by source", async () => {
  const app = new CharacterWizard({ catalog: {} });
  app.stepIndex = 3;
  app.result = { items: entries };
  let context = await app._prepareContext();
  assert.equal(context.items.length, 2);
  assert.match(template(context), /Barbarian \(2024 · SRD 5.2\)/);
  app.query = "DDB";
  context = await app._prepareContext();
  assert.deepEqual(context.items.map(i => i.uuid), ["ddb"]);
});

test("edition switching clears chosen entries and preview, but preserves character name", async () => {
  const app = new CharacterWizard({ catalog: {} });
  app.characterName = "An adventurer";
  app.choices.set("class", entries[0]);
  app.draft.select("class", entries[0]);
  app.preview = entries[0];
  await CharacterWizard.onEdition.call(app, null, { dataset: { ruleset: "2014" } });
  assert.equal(app.choices.size, 0);
  assert.equal(app.draft.selections.size, 0);
  assert.equal(app.preview, null);
  assert.equal(app.characterName, "An adventurer");
});

test("selection is revalidated against the live catalog before it enters a draft", async () => {
  const app = new CharacterWizard({ catalog: { resolve: async () => { throw new Error("No longer available"); } } });
  app.stepIndex = 3;
  app.preview = entries[0];
  await CharacterWizard.onChoose.call(app);
  assert.equal(app.choices.size, 0);
  assert.match(app.error, /No longer available/);
  assert.equal(app.busy, false);
});

test("class summary stays escaped while background and feat descriptions render rich text", async () => {
  const app = new CharacterWizard({ catalog: {} });
  app.stepIndex = 3;
  app.preview = { ...entries[0], label: "Barbarian", isClass: true, summary: "<script>bad</script>", html: "<p>Full text</p>" };
  const classHTML = template(await app._prepareContext());
  assert.ok(classHTML.includes("&lt;script&gt;bad&lt;/script&gt;"));
  assert.match(classHTML, /Read full class description/);
  for (const index of [2, 4]) {
    app.stepIndex = index;
    app.preview = { label: "Example", html: "<p>A full description.</p>", isClass: false };
    assert.ok(template(await app._prepareContext()).includes("<p>A full description.</p>"));
  }
});
