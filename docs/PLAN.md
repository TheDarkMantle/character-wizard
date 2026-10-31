# Character Wizard — Plan (v4, 2026-10-31)

A Foundry VTT v14 module for the dnd5e system: guided character creation (and later level-up), using whatever content is in the world's compendiums, respecting the world's 2014 / 2024 rules setting.

## Decisions
- **System:** dnd5e 6.x only (module.json: minimum 6.0.0, verified 6.0.6). Foundry minimum 14, verified 14.368. dnd5e 6.0.6 itself requires core 14.367+.
- **Players can use it.** The GM can block specific species and subclasses, turn compendiums on or off and set their priority. There's also a GM toggle, "Players can use the wizard".
- **First release = character creation.** Level-up comes later.
- **Opening:** keep the Actors sidebar button. From a character sheet: a header menu entry plus a banner on level 0 sheets. Level 0 opens the creation wizard for that actor. Level > 0 shows a "level-up coming later" notice for now.
- **Next button** on picker steps chooses the highlighted option if Choose wasn't clicked. The step list doesn't.
- **Repo:** https://github.com/TheDarkMantle/character-wizard. The old ChatGPT code was cleared in commit f0e8ace (v0.2.0). Work continues in Claude Code locally in `/Users/shawn/Development/Character Wizard`.

## Core principle
Don't re-implement D&D rules. The wizard **reads** each item's advancements to build its own UI (the features board), collects choices, then **applies them through the system's own advancement `apply()` methods** on a clone of the actor and commits in one bulk update. That's what dnd5e's AdvancementManager does, minus its dialogs. Homebrew works as long as it uses native advancements.

## Verified against dnd5e 6.0.6 source
- Rules setting: `game.settings.get("dnd5e", "rulesVersion")` → `"modern"` | `"legacy"`. Item tag: `system.source.rules` → `"2024"` | `"2014"`.
- dnd5e already adds `system.identifier`, `system.source` and `system.container` to compendium index fields. Never request a child of those (for example `system.source.rules`), because Foundry's projection breaks. We add `system.classIdentifier` and `system.type`.
- AdvancementManager:
  - Clones the actor (`actor.clone({}, {keepId:true})`).
  - `forNewItem` sets class `system.levels = 0` and `details.originalClass`.
  - `createLevelChangeSteps` order per level: species → class → subclass → other items.
  - Newly granted items with advancements get "synthetic" steps.
  - `#complete` → `actor.performBulkUpdate({actor, create, delete, item}, {isAdvancement: true, updateOptions: {diff:false, recursive:false}})`.
- `apply(level, data)` shapes:
  - ItemGrant: `{ selected: [uuid], ability }`
  - ItemChoice: `{ selected: [uuid] }` (+ `replace` for swaps); config `choices[level].count`, `pool[{uuid}]`, `restriction{type, subtype, list, level}`
  - Trait: `{ chosen: [key] }` (grants must be included); `unfulfilledChoices()` returns one slot per pick, grants included
  - HitPoints: `{ [level]: "max" | "avg" | number }`
  - AbilityScoreImprovement: `{ type: "asi", assignments: {str: 2, ...} }` or `{ type: "feat", uuid }`
  - Subclass: `{ uuid }`; Size: `{ size }`
  - `automaticApplicationValue(level)` returns data, or `false` when input is needed.
- Trait labels: `dnd5e.documents.Trait.keyLabel(key)`.

## Built so far (v0.2.1)
- **Catalog:** scans all visible Item packs, filters by rules, and de-duplicates by identity key (`type:identifier`; subclasses use `subclass:class:identifier`) using GM pack priority. Untagged content can be shown or hidden. The pure logic is unit tested.
- **GM "Configure content" window:** Sources (enable and priority), Species and Subclasses (allow or block).
- **Entry points** as decided above. The 0.2.1 sidebar button fix isn't confirmed in Foundry yet.
- **Wizard shell:**
  - Step order follows the ruleset.
  - Class, species and background have searchable pickers with a description and a read-only "You get / You choose" preview built from advancements.
  - Abilities, equipment and spells steps are placeholders. Review doesn't create yet.
- **Advancement reader** (`scripts/advancement/read.mjs`): advancements → granted / choice / info / native entries. Unit tested.
- **Headless engine prototype** (`scripts/advancement/apply.mjs`) plus a console spike, `game.modules.get("character-wizard").api.spike()`. Not yet verified in Foundry.
- **Tooling:** 23 Vitest tests, ESLint, and a release workflow (tag `vX.Y.Z` → attaches module.json and module.zip).

## Features board (next)
Three columns when a class, species, background or feat is selected:
- **Granted** (locked): ItemGrant without choices, HP, fixed traits, size.
- **Your choices** (drop slots): ItemChoice (fighting styles and similar), Trait choices (skills, tools, languages, expertise, weapon mastery), ASI or feat, subclass, size, optional grants.
- **Options pool** for the active slot, with a description preview.

How it behaves:
- Drag and drop **plus** click-to-place and keyboard support.
- Checks for duplicates across sources, and an "N choices left" counter gates Next.
- An ItemChoice with an empty pool and a restriction searches the catalog's feats by type and subtype.
- Items granted mid-flow that have their own choices (for example 2024 origin feats like Magic Initiate) appear as extra slots. To discover them, simulate on a clone after each change.
- Unknown advancement types fall back to the native dialog for that step.

## Next steps
1. Run the spike in a 2024 world and a 2014 world, compare against native builds, and fix the engine.
2. Features board UI, with selections wired into the engine's resolver.
3. Ability scores (standard array, point buy, 4d6, manual), equipment, spells.
4. Review → Create (a new actor, or the level-0 actor the wizard was opened from). Players without Create Actor permission build onto a GM-provided blank actor.
5. Polish, docs, release 0.3/1.0. Later: level-up from the sheet.

## Similar modules (reference only)
- "Character Builder" (dnd5e-character-builder). Shawn tried it and didn't like it.
- plaksiy/foundry-charecter-creator; Simple DnD5e Character Creator (IainFielding).
