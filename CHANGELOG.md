# Changelog

## Unreleased

- **Fixed: variants could take the standard weapon's place in the pick lists.** "Jade Dagger", "Wooden Staff" and others share a base item with the Dagger and the Quarterstaff, and when their pack ranked better they replaced them: "any simple melee weapon" had no Dagger, Quarterstaff or Spear. Each base item's standard name now comes from the system (weapons, armor and tools), and the item with that name is offered; variants only appear when the standard one isn't available.
## 0.7.10

- **Fixed: the Great Old One's expanded spells were still missing.** A spell name usually exists in both a 2014 and a 2024 version. The wizard looked up each name, took the first copy it met, and then dropped it if it was the other edition's, so the 2014 Dissonant Whispers never made it in. It now chooses among the copies that fit the world's rules.
- **Fixed: the SRD Fiend patron's expanded spells still weren't offered.** The system's own patron lists link each spell (`@UUID[...]{Burning Hands}`), and the wizard read the whole link as the name. It now uses the link's label, so the Fiend's Burning Hands and Command (and the others as you gain levels) are offered, as the Great Old One's already were.
- **Fixed: monster attacks listed as simple weapons.** Monster modules store attacks and traits as weapon items ("Wind Blast", "Bell", "Big Meaty Feast"). A Warlock's "any simple weapon" pick listed them. Weapons that don't name a kind of weapon (the base item every real weapon has) are no longer treated as gear, in the pick lists or when matching a pack's contents.
## 0.7.9

- **A patron's expanded spell list is offered in the spells step.** A 2014 Warlock patron (Great Old One, Fiend, Archfey...) "lets you choose from an expanded list of spells when you learn a warlock spell". Those spells were missing from the options. They are now added to the Warlock's list (still your choice, and only spells you can cast yet). The system's own subclass lists are used when there is one; for imports, the spell names are read from the Expanded Spell List feature's table.
- **Fixed: the gear reminder cut an item short.** "Scroll case stuffed full of notes from" lost "your studies or prayers" because the wizard trimmed phrases at the word "your". The reminder now shows each item exactly as the background words it.
- **Fixed: Review said "Not handled by the wizard yet" for spellcasting.** The Bard's Spellcasting feature carries a spell choice of its own, and the wizard asked whether that feature (not the class) casts spells, so it reported the choice as unhandled even though the spells step covers it. It now checks the class.
- **Review: the "add these yourself" note is easier to see.** It moved to the bottom, just above the Create button, with a dividing line above it and larger text and icon.
- **Equipment step: a note when a source has nothing to choose.** A background that simply gives its equipment (the Criminal/Spy, for example) showed a heading with nothing under it. It now says "No choices from this background. The equipment it provides is in the list below."

## 0.7.8

- **Fixed: the large lock in SRD 5.2 descriptions.** The system marks that lock (and its license message) `hide-in-embed` and hides it in its own windows; the wizard's panels didn't, so it showed full size. The wizard now hides anything marked that way, and keeps any stray icon in a description small.

## 0.7.7

- **No more large lock in descriptions.** The system's SRD 5.2 backgrounds and classes embed their full rules text, and where the system may not show it, it draws a big lock and "This is free rules content that isn't covered under the Creative Commons license...". The wizard now removes that placeholder, and also leaves out embedded pages the user can't open.
- **Fixed: the Class choices step failed for Cleric, Warlock and others in 0.7.5 and 0.7.6** ("clone.items.flatMap is not a function"). The prerequisite check read the character's items as an array, but Foundry's item collection isn't one. It now reads them correctly, and a failure while reading the character can no longer stop the choice.

## 0.7.6

- **Hardening: a feat that can't be read no longer breaks a whole choice.** After 0.7.5, picking a Warlock stopped the Class choices step from appearing (and every later step, since the Warlock stayed picked). The prerequisite check now catches any failure on a single feat, or on the check as a whole, logs a warning to the browser console and offers the option instead.

## 0.7.5

- **Fixed: 0.7.4's invocation filter missed the official 2024 Warlock.** That class lists its invocations as a fixed pool, and the filter only ran on choices that search by type, so Ascendant Step (level 5) was still offered at level 1. Both kinds of choice are now filtered. If filtering would leave nothing to pick, the full list is shown so a choice can never be unfinishable.

## 0.7.4

- **Fixed: Eldritch Invocations ignored their prerequisites.** A 1st-level Warlock was offered every invocation, including ones that need level 2, level 5 or a Pact Boon. Feat choices now leave out feats whose level or required item the character doesn't meet. This reads the system's prerequisite data, and also the "Prerequisite:" line in the description, because imported 2024 invocations carry the wrong level in their data (Devil's Sight says level 1 but its text says Level 2+). The higher of the two wins.

## 0.7.3

- **Fixed: a new character started below full hit points.** Hit points are set when the class is applied, which happens before the background's Constitution bonus and feats such as Tough raise the maximum. A halfling cleric ended up at 9 of 12. The character now starts at full health after everything is applied.

## 0.7.2

- **No shield with a two-handed weapon.** If a character starts with a two-handed weapon (a greatsword, a longbow), the shield is left unequipped, since a hand can't hold both. It stays in the inventory to equip by hand.

## 0.7.1

- **Starting armor and weapons are equipped.** On the sheet, armor class only counts equipped armor and shields, and the actions list only shows equipped weapons, so a new character started with the wrong AC and no attacks until the gear was equipped by hand. Every starting weapon is now equipped, plus one suit of body armor and one shield. Items that need attunement and anything inside a pack are left alone.

## 0.7.0

- **Personality and details.** The last step is now three: *Ideals, bonds and flaws*, *Personality and alignment* (traits, up to two), and *Details* (name, age, height, weight, gender, eyes, hair, skin, faith, appearance). Each trait, ideal, bond and flaw shows the background's own table when it has one (found through the roll tables its description links), with a Roll button when the table is an ordinary die, and an "Other" box for your own words, added after whatever you picked. A background with no tables (2024) just has the box. Alignment is a list. The biography is left blank, with a note that it can be written on the sheet. Review lists what was filled in.
- **Arrows and bolts go in the quiver.** A quiver is an empty container in the data, so the ammunition that came with the kit sat loose beside it and the wizard warned that the quiver lists no contents. If the character is getting an empty quiver and arrows or bolts, the ammunition now goes inside it (a bolt case takes only bolts). A quiver with contents of its own is left alone.
## 0.6.2

- **Items a background only describes are now a reminder, not inventory.** 0.6.1 tried to turn the "Equipment:" text of a 2014 background into loot items, and on the Athlete it also made items out of feature sentences. That is gone. Review now lists the things the text mentions that no item covers (a trinket, a letter) as a note above the Create button, so you can add them by hand. The parser no longer runs past the Equipment paragraph, and skips anything long or sentence-like.
- **Background features from the description.** A 2014 background with no feature item to grant (imports from D&D Beyond keep the feature only as text, like the Athlete's Echoes of Victory) now adds that feature to the sheet as its own feature item, with its text. Review lists it. Backgrounds whose feature the system grants are unchanged.
- **Pack contents on the equipment step.** When a choice includes an equipment pack (the Fighter's dungeoneer's or explorer's pack), the list of what is inside is shown under that option, so you can compare before choosing.

## 0.6.1

- **Fixed: a 2014 background's starting gold.** Some backgrounds (imports from D&D Beyond) only state the purse as a gold amount (the Sage's 10 gp, the Knight's 25 gp) and the wizard never added it. It is now added unless an item or a gold entry in the equipment already supplies it.
- (Replaced in the next version by a Review note.) **Gear a background only describes.** A 2014 background's "Equipment:" text can name things with no item to link, such as the Sage's letter from a dead colleague or the Knight's scroll of pedigree. Those now become plain loot items. Anything that shares a word with an item you already get is skipped, to avoid duplicates.

## 0.6.0

- **Spells step.** Spellcasting classes now pick their spells in the wizard: cantrips, spells known (2014 Bard, Sorcerer, Warlock), spells prepared (Cleric, Druid and every 2024 caster), and a Wizard's spellbook of 6 with the spells to prepare from it. The step only appears for a caster, and Create adds the spells to the sheet with the class as their source.
- **The right list.** Options come from the class's own spell list, kept to the world's rules and to enabled compendiums, with leveled spells limited to the slots the character has. Spells in the world's Items folder that no list claims are treated as homebrew and offered to every caster.
- **Spells you already have are greyed out**, like proficiencies: a cantrip from your species (the High Elf's) or a feat can't be taken again.
- Untested in Foundry.

## 0.5.1

- **Fixed: ammunition came out as 1 instead of a full stack.** Bolts and Arrows are stored as a stack of 20. A background that lists "Bolts" with no count means that stack, but the wizard replaced it with a quantity of 1. An equipment entry now only overrides an item's own quantity when it states a count (the Soldier's "20 Arrows", the Fighter's 8 javelins). Pack contents follow the same rule, and the equipment preview shows the real quantities.
- Fixed a pack description parsing bug where a number such as "1,000 ball bearings" was split at its comma.
- Characters already created keep their old quantities; fix those on the sheet.
- Still untested in Foundry.

## 0.5.0

- **Equipment step.** Your class and background give starting equipment, and now you choose it in the wizard. 2024 shows "A, B or gold" (the Fighter's two kits or 155 gp, a background's list or 50 gp). 2014 shows each "(a) or (b)" as its own choice, with starting gold as a separate switch.
- **Picks from a category.** "Any martial melee weapon", "a gaming set" and "a holy symbol" become dropdowns of ordinary gear. Magic items are left out, and copies of the same item in several compendiums appear once, with your world's rules winning.
- **Gold.** A flat amount is just taken. A formula such as 5d4 × 10 is rolled once, through chat, so Dice So Nice shows it.
- **Packs.** Equipment packs (Explorer's, Dungeoneer's and so on) are empty containers in the compendiums, so their contents are worked out from items stored in the container, then from the pack's description (item links or a plain list), then from a built-in table of the 2014 SRD packs. Contents go inside the pack on the character. Anything that can't be matched is listed on Review.
- Create adds the chosen items and gold. Armor and weapons aren't equipped automatically.
- Option names no longer repeat the choice's title, so "Fighting Style: Archery" reads "Archery".
- Still untested in Foundry.

## 0.4.1

- **Use a compendium under any rules version.** New "Any rules version" checkbox for each compendium on the Sources tab of Configure content. When it's on, the wizard offers everything in that compendium whatever its 2014 or 2024 tag says, so a 2014-tagged homebrew class (the Drakkenheim Apothecary) can be used in a 2024 world. Entries from the other edition are marked with their rules version in the picker.
- Point buy now shows the minus button on the left, the score in the middle and the plus on the right.
- The ability scores table keeps its scroll position when you change a score, instead of jumping to the top.
- Rolling 4d6 now goes through Foundry's dice and posts to chat as a normal roll, so Dice So Nice animates it. The scores appear once the 3D dice have landed.
- The custom array setting no longer names where the sample array came from.
- A choice that follows another in the same advancement (a tool from a short list, then "another of your choice") can't take what the first one picked.
- Still untested in Foundry.

## 0.4.0

- **Ability scores step.** Set scores by standard array, point buy (27 points, 8 to 15), rolling 4d6 and dropping the lowest, or typing them in. A table shows base score, bonus, final score and modifier for each ability.
- Your base scores are applied before the species and background, so their increases (including Tasha's choices and a background's +2/+1) add on top, up to 20. Next and Create wait until all six scores are set, and Review shows the final scores.
- **GM settings, both off by default.** "Offer a custom ability score array" adds your own array as a method. Its text field starts as the Dungeon Dudes array (17, 15, 13, 12, 10, 8) and is read-only until the toggle is on. "4d6: reroll 1s" rerolls any die that shows a 1.
- Rolling happens once per wizard run. There is no drag and drop yet; scores are assigned with dropdowns.
- Still untested in Foundry.

## 0.3.0

- **Proficiencies you already have are greyed out.** Choices are now checked in the wizard's step order (2024: class, background, species; 2014: species, class, background), so a later step sees what an earlier one gave. Taken skills, tools and languages show dimmed and can't be ticked.
- **Duplicates become a replacement.** If a fixed proficiency duplicates one you already have, or every option in a choice is already taken, you get to pick any other of that kind. Before, a duplicate grant was dropped and you lost the proficiency.
- A choice with no real decision left (as many options as picks) is granted without asking.
- Expertise and weapon mastery are unchanged.
- Still untested in Foundry.

## 0.2.9

- Cantrips and spells a **class** asks for are no longer offered in the Class choices step. They belong to the spells step, which isn't built yet, so for now they are listed on Review as not handled. Species and background spell picks (the High Elf cantrip) stay where they were.
- The Configure content window is now a fixed-height column with the active tab scrolling, so long lists such as Languages can be scrolled to the end.
- Still untested in Foundry.

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
