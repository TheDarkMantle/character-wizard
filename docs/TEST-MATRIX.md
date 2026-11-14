# Test matrix: 2014 rules

Status: the 2014 pass is complete (2026-11-13); every class built correctly, including the Apothecary. A 2024 pass is next.

One build per class, with species and backgrounds chosen so that, between them, the builds exercise every kind of choice
the wizard handles. The pairings do not need to make sense. Tick a row when the whole build passes.

Content in the test world (checked through the Foundry MCP, 2026-11-06): the SRD packs (`dnd5e.classes`, `dnd5e.races`,
`dnd5e.backgrounds`) plus the D&D Beyond imports (`DDB Classes`, `DDB Species`, `DDB Backgrounds`), which hold 2014 and
2024 copies. Artificer, Aasimar, Genasi, Variant Human and most backgrounds exist only in the DDB packs. When a name
exists in both, the wizard offers the copy from the higher-priority pack (Configure content), so a second pass with the
packs' priorities swapped covers the other copy.

## Builds

| # | Class | Species | Background | What this build exercises |
|---|-------|---------|------------|---------------------------|
| 1 | Fighter | Variant Human | Soldier | Fighting Style choice; Variant Human feat + skill + two +1 abilities; gaming set pick; equipment choices (take a martial weapon + shield, then repeat with a two-handed weapon); auto-equip, no shield with a two-handed weapon |
| 2 | Wizard | High Elf | Sage | Spellbook of 6 and prepared spells; High Elf cantrip greyed against the wizard's cantrips; extra language; Sage pouch gold, background feature item, roll tables |
| 3 | Cleric | Hill Dwarf | Acolyte | Domain chosen at level 1 and domain spells; prepared count; Dwarf tool choice; 2 languages; SRD background with linked tables; shield and holy symbol; pack contents |
| 4 | Rogue | Half-Elf | Criminal | Expertise (2 picks) with duplicate skills from species and background; Half-Elf +1/+1 choice and 2 skills; thieves' tools; Thieves' Cant |
| 5 | Bard | Tiefling | Entertainer | 3 any skills; instrument picks; spells known; Tiefling innate spells; Entertainer pouch gold and the favor of an admirer listed in the Review note |
| 6 | Barbarian | Dragonborn | Folk Hero | Draconic ancestry choice; artisan's tool pick; vehicles; Unarmored Defense AC; Folk Hero feature item |
| 7 | Sorcerer | Aasimar | Hermit | Sorcerous Origin chosen at level 1 (and its language); 4 cantrips, 2 spells known; Aasimar variant; Hermit pouch gold |
| 8 | Warlock | Rock Gnome | Knight | Otherworldly Patron at level 1; pact slots; no invocations yet in 2014; Knight gold and scroll of pedigree in the Review note; gaming set pick |
| 9 | Druid | Wood Elf | Outlander | Druidic; prepared spells; Wood Elf; instrument pick; Outlander gold as a currency entry (must not double) |
| 10 | Monk | Halfling (Lightfoot or Stout) | Urchin | Tool choice (artisan or instrument); Unarmored Defense; Martial Arts; Urchin gold and items |
| 11 | Paladin | Half-Orc | Athlete | Class with no spells at level 1; Athlete feature item from the description; no junk loot; shield equipped with a one-handed weapon |
| 12 | Ranger | Centaur | Noble | Favored Enemy and Natural Explorer choices; Centaur points control (Tasha's off); gaming set pick; no spells at level 1 |
| 13 | Artificer | Air Genasi | Guild Artisan | DDB-only class: spellcasting at level 1; tool proficiencies; Genasi |

Species not used above, worth a quick extra build with any class: Human (SRD), Mountain Dwarf, Drow, Tabaxi, Goliath,
Tortle. Add a second Rogue or Bard if the first one shows problems with expertise or skills.

## Checks on every build

1. The class choices step appears when the class has choices, and the species and background steps likewise.
2. Proficiencies already given by an earlier step are greyed out, and replacements are offered.
3. Ability scores step works for standard array, point buy and rolling; the species and background bonuses add up.
4. Equipment step: every choice is selectable, packs list their contents, gold or equipment both work.
5. Spells step appears only for casters, with the right counts and the right class list; held spells are greyed.
6. Ideals, personality, alignment and details steps fill in; rolling works; Other text is kept.
7. Review lists everything and shows no "not handled" message that needs attention.
8. After Create, the sheet shows: full hit points, correct AC (armor equipped), weapons equipped, every proficiency and
   language, all granted features, the spells, a filled equipment list with packs holding their items, the
   personality text, and no junk items.
9. The player account can do the same on a blank sheet assigned to them.

## Known gaps

- Tasha's language and proficiency swaps are not built.
- Starting above level 1 and level-up are not built.
- A background's text-only gear (a letter, a trinket) is only listed in a Review note; the wizard never adds it.
