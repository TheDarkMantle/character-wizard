# Changelog

## 0.2.8

- The choices page no longer jumps to the top when you click an option. This was most noticeable with the long language list.
- Clicking an option's name now only shows its description. Choosing is separate: tick the checkbox on the option, or use the Choose button in the description panel. Before, a click both selected it and showed it.
- Still untested in Foundry.

## 0.2.7

- **Spell choices.** A species or feature that asks you to pick a spell from a spell list (the 2014 High Elf's cantrip from the wizard list) is now a real choice. The options come from the system's spell lists, filtered by level and school, kept to the world's 2014/2024 rules, and each spell is offered once even if several compendiums have it. Choices tied to your character level (spells available at your level) are still listed on Review as not handled.
- **Choices inside granted features now show in the preview.** Cantrip, Extra Language, Fighting Style, Weapon Mastery and similar were missing from "You choose" because 6.0 stores an item's advancements as an object, not a list.
- **Tasha's racial ability scores now use the +/- points control** from the 2024 backgrounds, listing all six abilities. The species' fixed increases become points to spend (High Elf +2 and +1 are 3 points), with no more on one ability than the largest single increase, starting on the standard increases with a "Back to standard" button. Species that only have points to spend (Centaur) keep their own control and cap, so you can put up to 2 on one ability.
- Still untested in Foundry.

## 0.2.6

- **2014 racial ability score increases are now applied.** They were being skipped, so a High Elf came out without +2 Dexterity and +1 Intelligence. They also show under "You get" (for example "Dexterity +2, Intelligence +1").
- The species preview shows creature type, speed and senses such as darkvision.
- New GM setting, off by default: "Tasha's: customize racial ability score increases". With it on, a 2014 species gets a choice step where each increase can be moved to an ability of your choice (one increase per ability), starting from the standard ones. Language and proficiency swaps from the same Tasha's rule are not in yet.
- Species are listed under their base race in the picker (Elf > High Elf, Wood Elf). D&D Beyond species use the importer's group name, and the system's own species are grouped by name.
- New Languages tab in Configure content: hide languages from the wizard's language choices, by group or one at a time. Languages a species grants outright are not affected.
- The Actors sidebar button is hidden from users who can't create actors.
- Still untested in Foundry.

## 0.2.5

- Features now have real names. dnd5e 6.0 renamed an advancement's `title` to `name`, so the wizard was showing "ItemGrant" and "Trait". You now see "Class features", "Saving Throw Proficiencies", "Armor Training", "Weapon Mastery" and so on, and unnamed choices are named after the feature that carries them (Fighting Style, Primal Order).
- The class and species preview lists choices that sit inside granted features, such as Fighting Style and Weapon Mastery.
- Clicking a skill, weapon, armor or tool option shows what it is (the skill's ability, or the system's item text).
- 2024 Dragonborn: the ancestry choice is titled "Draconic Ancestry" and lists the dragon colours for each damage type.
- Backgrounds: the 2024 background ability score improvement is now a points control (+2/+1 or +1/+1/+1, up to 2 on one ability, locked abilities left out).
- Origin feats that ask for a spellcasting ability (Magic Initiate) now offer the choice. Before, the feat was skipped silently. Anything still skipped is listed on Review.
- The large banner on level 0 sheets is replaced by a small wizard hat button next to the lock toggle in the sheet header, shown when the sheet is unlocked.
- Still untested in Foundry.

## 0.2.4

- The Review step can now create the character. It runs your picks and choices through the system's own advancements and writes the result in one update, either onto the level 0 character you opened the wizard from or onto a new actor.
- Create is blocked, with a reason, when you can't create actors, haven't picked a class, or haven't finished your choices.
- Ability scores, equipment and spells aren't part of creation yet; set them on the sheet.
- First build that writes to an actor, still untested in Foundry. Please compare a Fighter against one built on the normal sheet.

## 0.2.3

- Subclass choices now appear in the class choices step when a class grants its subclass at level 1 (2014 Cleric, Sorcerer, Warlock). Options follow the world's rules and the GM's blocked subclasses.
- A choice with no available options no longer blocks Next; it's listed on Review as not handled yet.
- Still untested in Foundry.

## 0.2.2

- New choice steps: after you pick a class, species or background that asks for decisions (fighting style, skills, tools, weapon mastery, primal order, draconic ancestry and so on), a "Class choices", "Species choices" or "Background choices" step appears. Next stays disabled until every pick is made, and Review lists them.
- Choices are found by running the system's own advancements on a throwaway copy of the character, so homebrew with native advancements shows up too. Spell picks, ability score improvements and subclasses aren't handled yet.
- Untested in Foundry: this is a test build.

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
