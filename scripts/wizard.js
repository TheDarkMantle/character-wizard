import { CharacterDraft, requireRuleset } from "./rules.js";
import { STEPS, choiceView } from "./presentation.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class CharacterWizard extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    classes: ["character-wizard"],
    window: { title: "Character Wizard", resizable: true },
    position: { width: 1040, height: 760 },
    actions: {
      step: CharacterWizard.onStep,
      next: CharacterWizard.onNext,
      back: CharacterWizard.onBack,
      edition: CharacterWizard.onEdition,
      preview: CharacterWizard.onPreview,
      choose: CharacterWizard.onChoose,
      full: CharacterWizard.onFull,
      refresh: CharacterWizard.onRefresh,
      clear: CharacterWizard.onClear,
      save: CharacterWizard.onSave
    }
  };

  static PARTS = { wizard: { template: "modules/character-wizard/templates/wizard.hbs" } };

  constructor({ catalog, ...options } = {}) {
    super(options);
    this.catalog = catalog ?? game.modules.get("character-wizard").api.catalog;
    this.draft = new CharacterDraft("2024");
    this.characterName = "";
    this.stepIndex = 0;
    this.choices = new Map();
    this.result = null;
    this.query = "";
    this.preview = null;
    this.previewVersion = 0;
    this.busy = false;
    this.error = "";
  }

  async _prepareContext() {
    const step = STEPS[this.stepIndex];
    const selected = this.choices.get(step.id);
    const query = this.query.toLocaleLowerCase().trim();
    const items = (this.result?.items ?? []).filter(item => item.type === step.id)
      .map(choiceView).filter(item => !query || `${item.label} ${item.sourceLabel}`.toLocaleLowerCase().includes(query))
      .map(item => ({ ...item, active: item.uuid === this.preview?.uuid, selected: item.uuid === selected?.uuid }));
    const summary = STEPS.filter(s => !["rules", "review"].includes(s.id)).map(s => ({
      title: s.short, ...this.choices.get(s.id), step: s.id, chosen: this.choices.has(s.id)
    }));
    return {
      step, steps: STEPS.map((s, i) => ({ ...s, number: i + 1, active: i === this.stepIndex, done: this.choices.has(s.id) })),
      isRules: step.id === "rules", isReview: step.id === "review", isBrowse: !["rules", "review"].includes(step.id),
      is2014: this.draft.ruleset === "2014", is2024: this.draft.ruleset === "2024", ruleset: this.draft.ruleset,
      characterName: this.characterName, query: this.query, items, summary,
      preview: this.preview, previewSelected: !!this.preview && selected?.uuid === this.preview.uuid,
      busy: this.busy, error: this.error, count: items.length,
      unclassified: this.result?.unclassified, unavailable: this.result?.unavailable?.join(", "),
      canBack: this.stepIndex > 0, canNext: step.id !== "review" && !this.busy,
      nextLabel: step.id === "feat" ? "Review draft" : "Continue"
    };
  }

  _onRender(context, options) {
    super._onRender(context, options);
    this.element.querySelector('[name="characterName"]')?.addEventListener("input", event => {
      this.characterName = event.target.value;
    });
    const search = this.element.querySelector('[name="search"]');
    search?.addEventListener("input", async event => {
      const start = event.target.selectionStart;
      this.query = event.target.value;
      await this.render();
      const input = this.element.querySelector('[name="search"]');
      input?.focus();
      input?.setSelectionRange(start, start);
    });
  }

  async loadCatalog() {
    this.busy = true;
    this.error = "";
    await this.render({ force: true });
    try {
      this.result = await this.catalog.discover({ ruleset: this.draft.ruleset });
    } catch (error) {
      this.result = null;
      this.error = `Could not load compendiums: ${error.message}`;
    } finally {
      this.busy = false;
      await this.render();
    }
  }

  async goTo(index) {
    if (this.busy || index < 0 || index >= STEPS.length) return;
    this.previewVersion++;
    this.stepIndex = index;
    this.preview = null;
    this.query = "";
    this.error = "";
    if (!this.result && !["rules", "review"].includes(STEPS[index].id)) await this.loadCatalog();
    else await this.render();
    const chosen = this.choices.get(STEPS[index].id);
    if (chosen) await this.showPreview(chosen.uuid);
  }

  async showPreview(uuid) {
    const entry = this.result?.items.find(item => item.uuid === uuid && item.type === STEPS[this.stepIndex].id);
    if (!entry || this.busy) return;
    const version = ++this.previewVersion;
    this.preview = { ...choiceView(entry), loading: true };
    this.error = "";
    await this.render();
    try {
      const doc = await this.catalog.resolve(uuid, this.draft.ruleset);
      const html = await foundry.applications.ux.TextEditor.implementation.enrichHTML(doc.system.description?.value ?? "", {
        secrets: false, relativeTo: doc
      });
      // Derive class summaries from the actual entry, never invent class mechanics.
      const parser = new DOMParser().parseFromString(html, "text/html");
      parser.querySelectorAll("script, style").forEach(node => node.remove());
      const first = [...parser.querySelectorAll("p")].map(p => p.textContent.trim()).find(t => t.length > 70);
      const plain = (first || parser.body.textContent || "").replace(/\s+/g, " ").trim();
      const summary = plain.length > 650 ? `${plain.slice(0, 650).replace(/\s+\S*$/, "")}…` : plain;
      if (version !== this.previewVersion) return;
      this.preview = {
        ...choiceView(entry), loading: false, html, summary, isClass: doc.type === "class",
        noDescription: !plain
      };
    } catch (error) {
      if (version !== this.previewVersion) return;
      this.preview = null;
      this.error = `Could not open this entry: ${error.message}`;
    }
    await this.render();
  }

  static async onStep(event, target) { await this.goTo(STEPS.findIndex(s => s.id === target.dataset.step)); }
  static async onNext() { await this.goTo(this.stepIndex + 1); }
  static async onBack() { await this.goTo(this.stepIndex - 1); }
  static async onPreview(event, target) { await this.showPreview(target.dataset.uuid); }

  static async onEdition(event, target) {
    if (this.busy) return;
    const ruleset = requireRuleset(target.dataset.ruleset);
    if (ruleset === this.draft.ruleset) return;
    this.previewVersion++;
    this.draft.setRuleset(ruleset);
    this.choices.clear();
    this.preview = null;
    this.result = null;
    this.error = "";
    await this.render();
  }

  static async onChoose() {
    if (this.busy || !this.preview || this.preview.loading) return;
    const selection = this.preview;
    const step = STEPS[this.stepIndex].id;
    this.busy = true;
    await this.render();
    try {
      const doc = await this.catalog.resolve(selection.uuid, this.draft.ruleset);
      if (doc.type !== step) throw new Error("This entry does not belong in the current step.");
      // resolve has just checked current GM designations and edition eligibility.
      this.draft.select(step, { uuid: selection.uuid, system: { source: { rules: this.draft.ruleset } } });
      this.choices.set(step, { uuid: selection.uuid, label: selection.label, sourceLabel: selection.sourceLabel });
      this.error = "";
    } catch (error) { this.error = error.message; }
    finally { this.busy = false; await this.render(); }
  }

  static async onFull(event, target) {
    const uuid = target.dataset.uuid || this.preview?.uuid;
    if (!uuid) return;
    try {
      const doc = await this.catalog.resolve(uuid, this.draft.ruleset);
      await doc.sheet.render({ force: true });
    } catch (error) { this.error = error.message; await this.render(); }
  }

  static async onRefresh() {
    if (this.busy) return;
    this.previewVersion++;
    this.preview = null;
    await this.loadCatalog();
  }

  static async onClear(event, target) {
    if (this.busy) return;
    this.choices.delete(target.dataset.step);
    this.draft.selections.delete(target.dataset.step);
    await this.render();
  }

  static async onSave() {
    const data = { ...this.draft.toJSON(), name: this.characterName.trim(), choices: Object.fromEntries(this.choices) };
    foundry.utils.saveDataToFile(JSON.stringify(data, null, 2), "application/json", "character-wizard-draft.json");
  }
}
