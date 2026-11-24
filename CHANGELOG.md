# Changelog

## Unreleased

- **Fixed: a new Dwarf's prototype token now gets its darkvision.** 0.7.31 copied the character's senses to the prototype token, but while the wizard builds the character dnd5e hasn't yet recorded the species as the actor's own, so the species' darkvision wasn't among the senses it read. The wizard now adds the species' own sense ranges first. Not yet tried in Foundry.

## 0.7.31

- **Added: the world's own Items are scanned for homebrew.** Classes, subclasses, species, backgrounds and feats in the Items sidebar are now offered in the wizard like a compendium's content, so homebrew no longer has to be moved into a compendium first. They appear in Configure content → Sources as "World Items" (enable, rank and "any rules version" work as for a compendium), and the Classes, Species and Subclasses tabs list them for blocking. The wizard refreshes when an item is created, edited or deleted. A player sees only the world items they have at least Observer permission on.

- **Added: the new character's prototype token gets the sight its senses give.** A Dwarf's darkvision (and blindsight, tremorsense and the like) is now copied onto the prototype token when the character is created, using dnd5e's own sense-to-sight rule. dnd5e works this out for a token placed on a scene but leaves the prototype token alone, so a new Dwarf's prototype showed no darkvision. Needs dnd5e 6.1 or newer; on 6.0 nothing is changed.

## 0.7.30

- **Verified on Foundry 14.370 and dnd5e 6.1.1.** The manifest and README now list these as the tested versions. The minimums are unchanged (Foundry 14, dnd5e 6.0.0) and have not been re-tested. Builds were also checked in a world with only the SRD content, as a player on a blank sheet.

## 0.7.29

- **Fixed: the Cult of the Dragon Initiate feat now gives Draconic.** The D&D Beyond import has no data for the feat's "You know Draconic", so the Dragon Cultist background never taught it. The wizard now adds a language grant to a granted feature whose text says "You know <language>" for a language the system lists, unless its data already grants or offers it. A character who already knows the language is asked for another one instead, as the feat's text says. A scan of 3,187 imported items found only this feat.

## 0.7.28

- **Changed: a long list of options on the features board is summarised.** A choice with more than eight options (a feat from every feat in the world) now says "Choose from 40 options" instead of naming them all. Eight or fewer are still listed, so a class's skill list stays readable. The options themselves are unchanged in the picker.

## 0.7.27

- **Fixed: the Deft Explorer Expertise choice couldn't be selected.** The advancement the wizard adds got a new random id every time the choices were rebuilt, and a choice's key includes that id, so each click's selection was stored under a key that was gone by the next rebuild. It now has a fixed id.

## 0.7.26

- **Fixed: the Expertise choice on the imported Deft Explorer is titled "Expertise" and says what to do.** It was headed "Skill Proficiencies". Every Expertise choice (Rogue, Bard, Deft Explorer) now carries a line: "Choose a skill you are already proficient in. Your proficiency bonus is doubled for checks with it."

## 0.7.25

- **Fixed: the imported Tasha's Ranger's Deft Explorer gives a choice of Expertise.** The D&D Beyond import carries only the language pick; its Canny benefit ("Choose one of your skill proficiencies. Your proficiency bonus is doubled...") exists only as text, so no Expertise could be chosen. The wizard now adds an Expertise choice to a granted feature whose text states one in the books' plain wording, unless the feature already has its own. A scan of 3,187 imported items found only this feature (and its unused Canny sub-item).

## 0.7.24

- **Fixed: a language choice that asks for fewer languages than the feature's text promises.** The D&D Beyond import gives the Tasha's Ranger's Deft Explorer one language pick where the book says two, and the Eberron Changeling one where it says two beside Common. The wizard now raises such a choice to the number the text states ("two additional languages of your choice", "Common and two other languages of your choice", "Languages: Two of your choice"). The rule only ever raises a count, only on a feature, species or background with a single language choice, and only when the text states the number in one of those plain forms; the choices step says when it did. A scan of 3,187 imported items found exactly these two it would change, and none that it should leave alone.

## 0.7.23

- **Added: every copy of a class is offered, and the GM can block or rename each one.** The SRD Ranger and a D&D Beyond Ranger used to collapse into one, whichever compendium ranked higher. Now each compendium's copy is its own option, so a table can keep the original and the Tasha's-flavoured import side by side. Where a class has more than one copy the picker names them "Ranger (SRD)" and "Ranger (DDB)": SRD for the system's own compendiums, DDB for D&D Beyond imports, otherwise the compendium's name. Configure content has a new Classes tab listing every copy with a block checkbox and a box to rename it. Blocking a class also lets the GM keep, say, an Artificer out of play. Species and subclass blocks are unchanged.

## 0.7.22

- **Added: "Show it under 2014 rules only" for content without a rules version, now the default.** Homebrew and older content that isn't tagged 2014 or 2024 is almost always 2014, so the setting gains a third choice, offering it only in a 2014 world, and that is the default. "Show it under either ruleset" and "Hide it" are still there. A world that never changed the setting now follows the new default: untagged content stops appearing in a 2024 world until you pick "either ruleset".

## 0.7.21

- **Added: a Review reminder for items an import leaves out.** A 2024 class or background imported from D&D Beyond sometimes lacks an item its own text lists: the Guide has no Quiver, the Wizard no Spellbook. The Review step now lists any item named in the "(A)" equipment text that the character didn't get, so you can add it by hand. Picks (a focus, a gaming set, an instrument) and money are never listed, and nothing is created from the text. It is not shown when you took the gold instead.

## 0.7.20

- Same changes as 0.7.19, whose build failed on a lint error (so it has no downloadable files). Use this version.

## 0.7.19

- **Added: spell details in the spell picker.** Clicking a spell (the spells step, a feat's or species' spell picks) shows its level and school, then casting time, range, components (with the material), duration, whether it is a ritual, whether it needs concentration, and which classes have it, above its text, with a link that opens the spell.

- **Added: a weapon's mastery is explained when you look at it.** Clicking a weapon in a Weapon Mastery pick (or any weapon proficiency) shows the weapon's text and, under it, "Weapon mastery: Nick" with the system's rules text for that mastery. If the rules page can't be read, the mastery's name links to it instead.

## 0.7.18

- **Fixed: the D&D Beyond Fighter offered only the Paladin's and Ranger's Fighting Styles.** The imported Fighter's Fighting Style asks for class features that are Fighting Styles, and the only ones are Blessed Warrior and Druidic Warrior, which belong to other classes. When Fighting Style feats exist (Archery, Defense and the others), that choice now offers them instead.

## 0.7.17

- **Changed: the shield is equipped when there is a one-handed or versatile melee weapon.** Before, any two-handed weapon in the gear (a Druid's Shortbow beside a Sickle and a Quarterstaff) kept the shield off. The shield is now equipped when the character has a one-handed or versatile melee weapon to hold, since that is the weapon they would use with it. With only a two-handed melee weapon, or only a bow, it stays off.

## 0.7.16

- **Fixed: the SRD Acolyte (and any source granting the generic Magic Initiate) offered spells from every list.** The system's Magic Initiate is open to the Cleric, Druid and Wizard lists, and the SRD Acolyte grants it without fixing one, though its text says "Magic Initiate (Cleric)". The wizard now reads the list from that text and restricts the cantrips and the level 1 spell to it. When a source names no list (a Human's Versatile origin feat), the feat's choices include a "Spell list" pick, and the cantrips and spell then come from that one list, as the rules say.

## 0.7.15

- **Fixed: Magic Initiate never asked which ability casts its spells.** The feat lets you choose Intelligence, Wisdom or Charisma, but when it sat on a background (Acolyte, Sage, Guide) the wizard didn't ask and the system used the first, Intelligence, for its cantrips and spell. The feat's choices now include "Spellcasting Ability", one answer for all of its spells.

## 0.7.14

- **Fixed: a feature that asks which ability casts its spell granted no spell.** The Tiefling's legacy (Fire Bolt) and any feature of that kind (Magic Initiate's spells, other lineages) asked for the casting ability, then added nothing, because the system only grants the items it is handed once an ability is given. The wizard now hands over the items with the ability.

## 0.7.13

- **Fixed: a D&D Beyond 2024 background showed "Feat" with no feat, and never granted it.** The import's feat grant is empty, but its description names the feat ("Feat: Tough", "Feat: Musician"). The wizard now reads that line, finds the feat among the enabled compendiums (an origin feat first), and puts it in the grant, so it shows in the "You get" box, its own choices (Magic Initiate spells, Skilled skills) are asked, and Create adds it. The Barbarian built from the Farmer background had no Tough for this reason.

## 0.7.12

- **Fixed: no choice between equipment and gold for a 2024 class with no gold amount in its data.** The D&D Beyond Barbarian lists its equipment but not the 75 GP alternative, so the equipment step showed no choice. When a 2024 class or background has no gold amount, the wizard now reads the "or (B) 75 GP" option from its description. Only an option that is nothing but gold is read.

## 0.7.11

- **Classes with no equipment list.** The Artificer imported from D&D Beyond has no starting equipment in its data (only the 5d4 × 10 gp alternative), so the equipment step offered nothing and the character got nothing. The step now says so and shows the equipment list from the class description as a reminder, the Review step lists it above the Create button, and taking the gold still works. Items are never created from that text.
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
