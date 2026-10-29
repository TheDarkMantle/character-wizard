// Development-only adapter. The packaged module uses Foundry's real ApplicationV2.
class PreviewApplication {
  constructor() { this.id = "character-wizard-preview"; }
  async render() {
    const context = await this._prepareContext();
    const source = await fetch("/modules/character-wizard/templates/wizard.hbs").then(r => r.text());
    this.element = document.querySelector("#preview");
    this.element.querySelector(".window-content").innerHTML = Handlebars.compile(source)(context);
    for (const button of this.element.querySelectorAll("[data-action]")) {
      button.addEventListener("click", event => this.constructor.DEFAULT_OPTIONS.actions[button.dataset.action]?.call(this, event, button));
    }
    this._onRender(context, {});
    return this;
  }
  _onRender() {}
}

globalThis.foundry = {
  applications: {
    api: { ApplicationV2: PreviewApplication, HandlebarsApplicationMixin: base => base },
    ux: { TextEditor: { implementation: { enrichHTML: async html => html } } }
  },
  utils: {
    saveDataToFile: (data, type, name) => {
      const link = document.createElement("a");
      link.href = URL.createObjectURL(new Blob([data], { type }));
      link.download = name;
      link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    }
  }
};

function entry(id, name, type, rules, book, description) {
  return { _id: id, name, type, system: { source: { rules, book }, description: { value: description } } };
}
const classDescription = `<p>A bold adventurer who meets danger head on. This sample class description demonstrates the summary panel. In your world, the text will come directly from the selected compendium entry.</p><h2>A life of adventure</h2><p>This longer sample section appears when you open the full class description. No game mechanics are supplied by this preview.</p>`;
const packs = [];
for (const rules of ["2014", "2024"]) {
  const book = rules === "2014" ? "SRD 5.1" : "SRD 5.2";
  for (const [source, label, sourceBook] of [["srd", "Classes & Origins (SRD)", book], ["ddb", "DDB Imported Content", "Player's Handbook"]]) {
    const entries = [
      entry("barbarian", "Barbarian", "class", rules, sourceBook, classDescription),
      entry("fighter", "Fighter", "class", rules, sourceBook, classDescription.replace("bold", "disciplined")),
      entry("scholar", "Scholar", "background", rules, sourceBook, "<p>You spent your early life surrounded by books, questions, and the company of other curious minds.</p><h3>A question unanswered</h3><p>Something you discovered has drawn you out into the world. What do you hope to learn?</p>"),
      entry("traveler", "Traveler", "background", rules, sourceBook, "<p>You have made a home in many places. Familiar faces and half-remembered roads connect you to a wider world.</p><p>Choose this background to see it appear in your draft review.</p>"),
      entry("elf", "Elf", "race", rules, sourceBook, "<p>This is sample species content for testing navigation. Your real compendium supplies the description.</p>"),
      entry("observant", "Observant", "feat", rules, sourceBook, "<p>You have a knack for noticing the small details that others overlook.</p><p>This sample feat has no mechanical benefits. Real feat text appears here in Foundry, including any authored prerequisites.</p>")
    ];
    const collection = `sample.${source}${rules}`;
    packs.push({ collection, documentName: "Item", visible: true, metadata: { label, system: "dnd5e" },
      getIndex: async () => entries,
      getDocument: async id => {
        const data = entries.find(e => e._id === id);
        if (!data) return null;
        return { ...data, toObject: () => data, sheet: { render: async () => {
          document.querySelector(".preview-document")?.remove();
          const panel = document.createElement("section");
          panel.className = "application preview-document standard-form";
          panel.setAttribute("role", "dialog");
          panel.setAttribute("aria-label", "Full compendium entry");
          const close = document.createElement("button");
          close.textContent = "Close full entry";
          close.addEventListener("click", () => panel.remove());
          const title = document.createElement("h2"); title.textContent = data.name;
          const body = document.createElement("div"); body.innerHTML = data.system.description.value;
          panel.append(close, title, body); document.body.append(panel); close.focus();
        } } };
      }
    });
  }
}
const { CompendiumCatalog } = await import("/modules/character-wizard/scripts/catalog.js");
const { CharacterWizard } = await import("/modules/character-wizard/scripts/wizard.js");
const catalog = new CompendiumCatalog({ packs: () => packs, settings: () => ({}) });
await new CharacterWizard({ catalog }).render({ force: true });

document.querySelector("#preview-theme").addEventListener("change", event => {
  document.body.className = `theme-${event.target.value}`;
});
