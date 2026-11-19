# Character Wizard — Claude Code notes

Foundry VTT **v14** module for the **dnd5e 6.x** system: a guided character builder that pulls classes,
subclasses, species, backgrounds and feats from every Item compendium in the world and follows the world's
2014 / 2024 rules setting. Owner: Shawn (GitHub: TheDarkMantle). Full plan: `docs/PLAN.md`.

## Decisions (don't change without asking)
- Targets: Foundry minimum 14, verified 14.370. dnd5e minimum 6.0.0, verified 6.1.1. No support for older versions.
- Players can use the wizard. The GM can block species and subclasses, enable/disable compendiums and set their
  priority (Game Settings → Character Wizard → Configure content).
- First release = **character creation only**. Level-up comes later.
- Opening: Actors sidebar button (keep it), character sheet header menu entry, and a small wizard hat button in the sheet header beside the lock toggle (shown when a level 0 sheet is unlocked).
  Level 0 opens creation for that actor; level > 0 shows a "level-up coming later" notice.
- Spell picks from the **class** (cantrips known, spells) belong to the **spells step**, not the class choices step. Spell
  picks from a species or background (High Elf cantrip) stay in that step's choices. The spells step
  (`scripts/spells/`) builds them from the finished clone: counts from the class scale values and `preparation.max`, options
  from the class spell list plus unlisted world Items spells, held spells greyed.
- Choices are checked **in wizard step order** (2024: class, background, species; 2014: species, class, background), so
  a later step greys out proficiencies an earlier one gave. A duplicate grant, or a choice whose whole pool is already
  held, becomes "pick any other of that kind" (`traitGroups` in `advancement/slots.mjs`).
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
- `scripts/content/catalog-logic.mjs`: **pure** catalog logic (normalize, rules filter, dedupe, blocking). Unit tested. Class keys include the pack (`class:ranger@pack`), so every compendium's copy is offered; `origin` names it SRD / DDB / pack label.
- `scripts/content/catalog.mjs`: Foundry side: scans pack indexes, caches, applies settings.
- `scripts/advancement/read.mjs`: **pure** advancement data → board entries (granted / choice / info / native). Unit tested.
- `scripts/advancement/apply.mjs`: `HeadlessAdvancer` prototype + `spikeFighter()` console test.
- `scripts/equipment/`: starting equipment. `starting.mjs` (**pure**: the class/background `startingEquipment` tree → choices,
  gold alternative), `packs.mjs` (**pure**: pack contents from a description, SRD 2014 pack table, name matching),
  `gear.mjs` (**pure**: ordinary-gear catalog entries, category pickers), `inventory.mjs` (Foundry side: expands packs,
  builds item data). dnd5e 6.0.6 defines starting equipment data but never grants it; this module does.
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

## Status (2026-11-13)
- v0.7.30 released (verified on Foundry 14.370 and dnd5e 6.1.1). v0.7.29: (a feature whose text says "You know <language>" grants it when its data does not: Cult of the Dragon Initiate). v0.7.28: (the features board says "Choose from N options" for a choice with more than eight). v0.7.27: (the Deft Explorer Expertise choice can be selected). v0.7.26: (the Deft Explorer Expertise choice is titled and explained). v0.7.25: (the imported Tasha's Deft Explorer gives an Expertise choice). v0.7.24: (a language choice is raised to the count its text states: Deft Explorer, the Eberron Changeling). v0.7.23: (every copy of a class is offered, with a Classes tab to block or rename each). v0.7.22: (content without a rules version can be shown under 2014 only, now the default). v0.7.21: (a Review reminder for items an import leaves out). v0.7.20: (spell details and weapon mastery text in the pickers; 0.7.19 failed to build, lint). Always check `npm run lint` by exit code, not by its last line. v0.7.18: the imported Fighter offers Fighting Style feats, not only Blessed Warrior and Druidic Warrior). v0.7.17: the shield is equipped when there is a one-handed or versatile melee weapon). v0.7.16: a generic Magic Initiate takes the spell list its source names, or asks for one). v0.7.15: Magic Initiate now asks which ability casts its spells). v0.7.14: a feature that asks for a casting ability now grants its spell: Tiefling Fire Bolt). v0.7.13: a 2024 background whose feat grant is empty gets its described feat). v0.7.12: a 2024 class or background with no gold amount in its data gets its "or (B) 75 GP" option read from
  the description). v0.7.11: weapon pick lists no longer let variants replace Dagger, Quarterstaff or Spear; a class with
  no equipment list shows its described equipment as a reminder. Testing now happens in the local "Dev Testing" world;
  the 2024 matrix is `docs/TEST-MATRIX-2024.md` (build 1, Barbarian, found the gold gap).
- **Verified by Shawn in Foundry:** every 2014 class builds correctly (the `docs/TEST-MATRIX.md` pass), including the
  Apothecary; 2014 and 2024 builds, proficiency greying, ability scores, equipment and packs, spells (and a patron's expanded
  list), full HP on Create, Warlock invocations filtered by prerequisites, auto-equip, the Class choices step.
- Known data gap: the D&D Beyond Artificer (TCoE) has an empty `startingEquipment`; the wizard shows the described list as a
  reminder only. Fixing the compendium item would only help Shawn's own world, so he left it.
- The SRD 5.2 license lock (`hide-in-embed`) is hidden by CSS in the wizard; Shawn is fine with that since nothing is redistributed.
- Not yet confirmed: the personality and details steps (0.7.0), tested as a player on blank sheets; testing as a player on blank sheets. The 2024 class matrix passed (2026-11-16).
- dnd5e 6.0 renamed an advancement's `title` to `name`. Read `name` (see `advancement/naming.mjs`).

## Next
1. Test the personality and details steps as a player, and the 2024 builds as a player on blank sheets. Maybe a Review reminder for imports that lack a starting item the description names (the Guide's Quiver, the Wizard's Spellbook).
2. Tasha's languages and proficiency swaps (see `docs/PLAN.md`).
3. Players without Create Actor permission build onto a GM-provided blank actor.
4. Later: level-up from the sheet (see "Level-up: things to watch" in `docs/PLAN.md`: patron spells in both editions), including multiclassing. Shawn also wants the wizard to **notice a level-up and open
   (or offer) itself automatically**; see "Level-up prompt" in `docs/PLAN.md`.
