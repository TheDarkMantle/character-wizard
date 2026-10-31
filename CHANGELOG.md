# Changelog

## 0.2.1

- Fixed the Actors sidebar button showing no label on Foundry v14: it now uses the same structure as core's header buttons.
- Clicking Next on the Class, Species or Background step now chooses the highlighted option if you forgot to click Choose. Jumping to another step from the step list doesn't.

## 0.2.0 — Rebuild

Complete rewrite.

- Foundry v14 and dnd5e 6.0+ only.
- Compendium scan across every Item compendium, filtered by the world's 2014/2024 rules, with duplicates resolved by GM pack priority.
- GM content settings: enable/disable and order compendiums, block species and subclasses, choose how untagged content is handled.
- Entry points: Actors sidebar button, character sheet header menu, and a banner on level 0 character sheets.
- Wizard window with ruleset-specific step order, searchable pickers for class, species and background, and a preview of what each option grants and what it asks you to choose.
- Prototype headless advancement engine and a console spike (`api.spike()`) to verify it against the system.
