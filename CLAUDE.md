# Character Wizard — Claude Code notes

Foundry VTT **v14** module for the **dnd5e 6.x** system: a guided character builder that pulls classes,
subclasses, species, backgrounds and feats from every Item compendium in the world and follows the world's
2014 / 2024 rules setting. Owner: Shawn (GitHub: TheDarkMantle). Full plan: `docs/PLAN.md`.

## Decisions (don't change without asking)
- Targets: Foundry minimum 14, verified 14.368. dnd5e minimum 6.0.0, verified 6.0.6. No support for older versions.
- Players can use the wizard. The GM can block species and subclasses, enable/disable compendiums and set their
  priority (Game Settings → Character Wizard → Configure content).
- First release = **character creation only**. Level-up comes later.
- Opening: Actors sidebar button (keep it), character sheet header menu entry, and a small wizard hat button in the sheet header beside the lock toggle (shown when a level 0 sheet is unlocked).
  Level 0 opens creation for that actor; level > 0 shows a "level-up coming later" notice.
- On picker steps, **Next** chooses the highlighted option if Choose wasn't clicked. Jumping via the step list doesn't.
- UX goal: a **features board**. When a class/species/background is picked, show "granted" features (locked),
  "your choices" slots (fighting style, skills, tools, languages, weapon mastery, ASI/feat, subclass), and a pool of
  options to drag into slots. Click-to-place and keyboard must also work, not drag only.

## Core principle
Don't re-implement D&D rules. Read each item's **advancements** to build the UI, collect choices, then apply them
with the system's own `advancement.apply(level, data)` on a clone of the actor and commit in one
`actor.performBulkUpdate(..., { isAdvancement: true })`. This mirrors dnd5e's AdvancementManager without its
dialogs, so later level-ups and undo keep working and homebrew with native advancements just works.

## Layout
- `module.json`: manifest. `download` URL must match `version` (tools/package.mjs checks this).
- `scripts/main.mjs`: init, API at `game.modules.get("character-wizard").api` (`catalog`, `open({actor})`,
  `HeadlessAdvancer`, `spike()`).
- `scripts/constants.mjs`: ids, rules map, step order per ruleset, index fields.
- `scripts/settings.mjs`: settings (`contentSources`, `blockedContent`, `untaggedContent`, `allowPlayers`).
- `scripts/content/catalog-logic.mjs`: **pure** catalog logic (normalize, rules filter, dedupe, blocking). Unit tested.
- `scripts/content/catalog.mjs`: Foundry side: scans pack indexes, caches, applies settings.
- `scripts/advancement/read.mjs`: **pure** advancement data → board entries (granted / choice / info / native). Unit tested.
- `scripts/advancement/apply.mjs`: `HeadlessAdvancer` prototype + `spikeFighter()` console test.
- `scripts/apps/wizard.mjs`: ApplicationV2 wizard (steps, pickers, preview). `apps/content-settings.mjs`: GM window.
- `scripts/integration/entry-points.mjs`: sidebar button, sheet header menu entry, level-0 header button beside the lock toggle.
- `templates/`, `styles/character-wizard.css` (inside `@layer modules`), `lang/en.json` (all UI text, prefix `CHARWIZ`).
- `test/*.test.mjs`: Vitest.

## Conventions
- ApplicationV2 + HandlebarsApplicationMixin only. No V1 Application, no jQuery.
- Keep Foundry-free logic in pure modules so it can be tested in Node.
- All user-facing text goes through `lang/en.json`.
- Pack ids contain `.` and content keys contain `:`, so read those checkboxes from the DOM, not form field names.
- Never request a child of an index field dnd5e already adds (`system.identifier`, `system.source`,
  `system.container`). For example, `system.source.rules` breaks Foundry's projection. Request the parent.

## dnd5e 6.0.6 facts (verified in the system source)
- Rules: `game.settings.get("dnd5e", "rulesVersion")` → `"modern"` | `"legacy"`. Items: `system.source.rules` → `"2024"` | `"2014"`.
- Species item type is `"race"`. Subclass → class link: `system.classIdentifier`. Feat subtype: `system.type.subtype`
  (for example `fightingStyle`, `origin`).
- `apply(level, data)` shapes:
  - ItemGrant `{ selected: [uuid], ability }`
  - ItemChoice `{ selected: [uuid] }` (config `choices[level].count`, `pool[{uuid}]`, `restriction{type,subtype,list,level}`; an empty pool means search by restriction)
  - Trait `{ chosen: [key] }` (include grants; `unfulfilledChoices()` returns one slot per pick)
  - HitPoints `{ [level]: "max" | "avg" | n }`
  - AbilityScoreImprovement `{ type: "asi", assignments }` or `{ type: "feat", uuid }`
  - Subclass `{ uuid }`; Size `{ size }`
  - `automaticApplicationValue(level)` returns `false` when input is needed.
- AdvancementManager order per level: species → class → subclass → other items. Items granted mid-flow with
  advancements get their own steps. Class items start at `system.levels = 0` and set `details.originalClass`.
- Labels: `dnd5e.documents.Trait.keyLabel(key)`. Reference: github.com/foundryvtt/dnd5e at tag `release-6.0.6`
  (module/documents/advancement/*, module/applications/advancement/advancement-manager.mjs).
- v14 hooks used: `renderActorDirectory`, `getHeaderControlsCharacterActorSheet`, `renderCharacterActorSheet`.

## Commands
- `npm install`, `npm test`, `npm run lint`, `npm run package` (builds `dist/module.zip` and `dist/module.json`).

## Release
1. Bump `version` and the `vX.Y.Z` in `download` in `module.json`, plus `version` in `package.json` and the two root
   entries in `package-lock.json` (only those two; don't sed the whole lockfile). Add a CHANGELOG entry.
2. Commit and push `main`.
3. `gh release create vX.Y.Z --target main --title "vX.Y.Z" --notes "..."`. The Release workflow attaches
   `module.json` and `module.zip`. Foundry updates from
   `https://github.com/TheDarkMantle/character-wizard/releases/latest/download/module.json`.
- Commit author: Shawn <darkmantle@gmail.com>.

## Status (2026-11-02)
- v0.2.5 released. Catalog, GM content settings, entry points (sidebar button, header menu entry, hat button beside
  the lock toggle on unlocked level 0 sheets), pickers with previews, choices steps after class/species/background
  (item choices, trait choices, subclass, size, optional grants, spellcasting ability, background ASI points) and
  Review → Create are in.
- **Verified in Foundry by Shawn (2026-11-02):** a 2024 character built from the wizard (new actor) and from a level 0
  character, both worked. The simulation + `HeadlessAdvancer` + commit path is therefore good for 2024.
- **Not yet verified:** 2014 builds (2014 Cleric subclass at level 1 was fixed in 0.2.3, untested), Druid Primal Order,
  Dragonborn ancestry, the proficiency details panel.
- Abilities (base scores), equipment and spells steps are placeholders. Spell picks are reported on Review as not handled.
- dnd5e 6.0 renamed an advancement's `title` to `name`. Read `name` (see `advancement/naming.mjs`).

## Next
1. Test a 2014 build end to end and fix what breaks.
2. Ability scores (standard array, point buy, 4d6 drop lowest, manual). Planned GM settings, both off by default
   (see `docs/PLAN.md`): a custom array text field (Dungeon Dudes' array 17, 15, 13, 12, 10, 8) and "reroll 1s" for 4d6.
3. Equipment, spells (including origin feat and class spell picks), details.
4. Players without Create Actor permission build onto a GM-provided blank actor.
5. Later: level-up from the sheet, including multiclassing.
