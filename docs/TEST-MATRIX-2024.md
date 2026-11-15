# Test matrix: 2024 rules

Status: not started. The 2014 pass is done (`docs/TEST-MATRIX.md`).

One build per class (all twelve), with backgrounds and species chosen so that, between them, the builds exercise every kind
of choice the 2024 wizard handles. The pairings do not need to make sense. Tick a row when the whole build passes.

Test world: the local **Dev Testing** world (Foundry 14.370, dnd5e 6.1.0, checked through the Foundry MCP on 2026-11-14;
this is newer than the verified 14.368 and 6.0.6, so a failure may be a version difference). Set the dnd5e *Rules Version*
setting to the 2024 rules (`modern`) first. The system packs `dnd5e.classes24`, `dnd5e.origins24` and `dnd5e.feats24` hold
only the SRD 5.2 subset (for example 4 backgrounds: Acolyte, Criminal, Sage, Soldier). The rest, such as Farmer, exists only in
the D&D Beyond import packs, whose data differs (the Barbarian build used the DDB class). Where a name exists in both, the wizard offers the copy from the higher-priority pack (Configure content), so a second
pass with the priorities swapped covers the other copy.

2024 order of the wizard: class, background, species. The background carries the +2/+1 (or +1/+1/+1) ability bonus and an
origin feat; the class carries Weapon Mastery, Fighting Style, Divine Order, Primal Order and invocations.

## Builds

| # | Class | Background | Species | What this build exercises |
|---|-------|------------|---------|---------------------------|
| 1 | Barbarian | Farmer | Goliath | Weapon Mastery (2 picks); Goliath giant ancestry choice; Tough origin feat (hit points on Create); carpenter's tools; Unarmored Defense AC; no spells |
| 2 | Bard | Entertainer | Tiefling | 3 any skills; instrument picks, with the Musician feat's instruments greyed against them; 2 cantrips and prepared spells; Tiefling legacy choice and its innate spells |
| 3 | Cleric | Acolyte | Dwarf | Divine Order choice (Protector or Thaumaturge, and the extra cantrip); Magic Initiate (Cleric) spell picks on the background step; prepared spells; calligrapher's supplies; shield and holy symbol |
| 4 | Druid | Guide | Elf (Wood Elf) | Primal Order choice; Magic Initiate (Druid) and the Wood Elf's Druidcraft: held cantrips greyed in the spells step; Elf skill choice; cartographer's tools |
| 5 | Fighter | Soldier | Human | Fighting Style feat choice; Weapon Mastery (3 picks); Human Skillful skill and Versatile origin feat; Savage Attacker; gaming set; take a martial weapon + shield, then repeat with a two-handed weapon (no shield equipped) |
| 6 | Monk | Sailor | Halfling | Tool choice (artisan's tools or instrument); Spear, Dagger and Quarterstaff all offered; Unarmored Defense; Martial Arts; Tavern Brawler; navigator's tools; no species choices |
| 7 | Paladin | Guard | Orc | Weapon Mastery (2 picks); Lay on Hands; spellcasting at level 1 (prepared spells); Alert; gaming set; shield equipped with a one-handed weapon; no species choices |
| 8 | Ranger | Scribe | Gnome (Forest Gnome) | Weapon Mastery (2 picks); Favored Enemy; spellcasting at level 1; Skilled feat (3 skills or tools, with held ones greyed); Gnome lineage choice and its cantrip |
| 9 | Rogue | Criminal | Aasimar | Expertise (2 picks) with overlapping skills; Weapon Mastery (2 picks); thieves' tools from both class and background (second becomes any other tool); Thieves' Cant; Alert; Aasimar cantrip |
| 10 | Sorcerer | Charlatan | Dragonborn | Draconic ancestry choice; 4 cantrips and 2 spells; Innate Sorcery; Skilled feat; forgery kit; no subclass yet |
| 11 | Warlock | Hermit | Human | One Eldritch Invocation at level 1, filtered by prerequisites; Pact Magic slots; cantrips and prepared spells; Healer feat; herbalism kit; Human Skillful and Versatile (a second origin feat must not repeat Healer) |
| 12 | Wizard | Sage | Elf (High Elf) | Spellbook of 6 and 4 prepared; High Elf cantrip (Prestidigitation) greyed against the Wizard's cantrips; Magic Initiate (Wizard) picks; calligrapher's supplies |

Species not used above, worth a quick extra build with any class: Dwarf with Cleric covers it; add Drow, Abyssal and
Chthonic Tiefling, Rock Gnome, and each Goliath and Dragonborn ancestry if the first ones show a problem.

## Checks on every build

1. The class choices step appears when the class has choices, and the background and species likewise.
2. Choices are checked in step order (class, background, species): a later step greys out what an earlier one gave, and
   offers a replacement.
3. Ability scores step works for standard array, point buy and rolling; the background's +2/+1 or +1/+1/+1 adds up.
4. Equipment step: the class's options (A, B, C) and the background's (A items, B 50 GP) each work; packs list their
   contents; the weapon, armor and tool pick lists show standard names, not variants.
5. Spells step appears only for casters, with the right counts and the right class list; held spells (species, feat) are greyed.
6. Origin feat spells (Magic Initiate) are chosen on the background step, not on the spells step.
7. Ideals, personality, alignment and details steps fill in; rolling works; Other text is kept.
8. Review lists everything and shows no message that needs attention.
9. After Create, the sheet shows: full hit points, correct AC (armor equipped), weapons equipped, every proficiency and
   language, weapon masteries, all granted features and the origin feat, the spells, a filled equipment list with packs
   holding their items, the personality text, and no junk items.
10. The player account can do the same on a blank sheet assigned to them.

## Known gaps

- Tasha's language and proficiency swaps are not built.
- Starting above level 1 and level-up are not built; subclasses are chosen at level 3, so none appear here.
