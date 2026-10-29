import { contentRules } from "./rules.js";

export function choiceLabel(item) {
  const rules = item.ruleset ?? contentRules(item) ?? "Edition unknown";
  const book = item.system?.source?.book?.trim();
  // Use authored source metadata; never guess SRD versions from the edition.
  const version = book && book !== rules ? `${rules} · ${book}` : rules;
  return `${item.name} (${version})`;
}

export function choiceView(item) {
  return { ...item, label: choiceLabel(item), sourceLabel: item.packLabel || item.pack };
}

export const STEPS = Object.freeze([
  { id: "rules", title: "Rules & identity", short: "Begin", hint: "Every adventure begins with a choice." },
  { id: "race", title: "Choose your species", short: "Species", hint: "Discover where your character comes from." },
  { id: "background", title: "Choose your background", short: "Background", hint: "What was your life before the adventure?" },
  { id: "class", title: "Choose your class", short: "Class", hint: "Decide how you meet the challenges ahead." },
  { id: "feat", title: "Explore feats", short: "Feats", hint: "Browse possibilities. Feat eligibility will be checked in a later build." },
  { id: "review", title: "Your character so far", short: "Review", hint: "Review your choices and save a draft." }
]);
