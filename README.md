# Character Wizard

A guided character builder for the **D&D 5e** system on **Foundry VTT v14**.

Players and GMs build a level 1 character step by step: class, species and background, ability scores, starting equipment, spells and the personality details. The wizard uses the content already in your world, so it offers whatever classes, species, backgrounds and feats you own, whether that is the SRD, the official books, third-party content or your own homebrew. It follows your world's **2014 or 2024 rules** setting.

Character Wizard includes no D&D content of its own. What it offers depends on the compendiums in your world.

## What it does

- **Builds from your compendiums.** It reads every Item compendium in the world and lists the classes, species, backgrounds and feats it finds, filtered to the world's rules version. Content from several sources is shown together. A class that exists in more than one compendium (for example the SRD Fighter and a D&D Beyond import) is offered once per source, labelled "(SRD)", "(DDB)" or the compendium's name.
- **Uses the system's own advancement data.** It does not re-implement the rules. It reads each item's advancements, asks the player for the choices, and applies them through dnd5e's own advancement code, so features, proficiencies, fighting styles, ability score increases, languages and the rest come from the content itself. Homebrew with normal advancements works without extra setup.
- **A features board.** Picking a class, species or background shows what it grants ("You get") and what the player has to choose ("You choose"), with the full description beside it.
- **Choices are checked in order.** A later step greys out proficiencies an earlier step already gave, and offers a replacement ("pick any other") where the rules say to.
- **Ability scores:** standard array, point buy, rolling 4d6, manual entry, or a custom array the GM sets. Background and species bonuses are applied.
- **Starting equipment:** the class and background equipment options, or starting gold. Packs are expanded into their contents, weapon and armor picks list ordinary items, and armor, weapons and shields are equipped. A 2014 background's gear that exists only as text in the description, like "a letter from a dead colleague", is added as a plain loot item. On a 2024 class or background, an item the text lists but the data lacks is not added, and the Review step reminds you to add it by hand.
- **Spells:** cantrips and spells for casters, taken from the class spell list, with spells the character already has from a species or feat greyed out. Spell details such as casting time, range, components and duration are shown beside each spell.
- **Personality and details:** ideals, bonds, flaws, personality traits, alignment and the character's description, with the background's tables where the background has them.
- **Review before creating.** Create makes the character, with full hit points. Any notes for adjustments needed after creation will show on the Review step.

## Requirements

- Foundry VTT v14 (verified on 14.370)
- D&D 5e system 6.0 or newer (verified on 6.1.1)

## Install

In Foundry: **Add-on Modules → Install Module**, and paste this manifest URL:

```
https://github.com/TheDarkMantle/character-wizard/releases/latest/download/module.json
```

## Opening the wizard

- **Actors sidebar:** the *Character Wizard* button at the top.
- **Character sheet:** an unlocked level 0 character shows a small wizard hat button in the sheet header, next to the lock toggle. The sheet's header menu also has a *Character Wizard* entry.

A player can open the wizard from the sidebar to make a new character if they have permission to create actors. A player who can't create actors can build onto a blank level 0 sheet that the GM has made for them.

## GM settings

**Game Settings → Character Wizard → Configure content** has these tabs:

- **Sources:** turn compendiums on or off and set their priority. When the same option exists in more than one compendium, the one higher in the list wins. A compendium can be marked "any rules version" so its content is offered under either ruleset.
- **Classes, Species, Subclasses:** every copy is listed with a checkbox. Uncheck anything players shouldn't be able to pick. The Classes tab lists every copy of every class, and has a box to rename a copy ("SRD", "DDB" or your own wording).
- **Languages:** hide languages from the language choices, for example the very long list that some imports add.

Other settings in the module's settings page:

- **Players can use the wizard:** turn off to make it GM-only.
- **Content without a rules version:** whether homebrew that isn't marked 2014 or 2024 is offered. By default it is offered under 2014 only.
- **Tasha's: customize racial ability score increases** (2014 rules only, off by default): lets players spend a species' fixed increases on any abilities.
- **Offer a custom ability score array:** add your own array next to the standard array.
- **4d6: reroll 1s:** for tables that reroll ones when rolling ability scores.

## Using D&D Beyond imports

The wizard has been tried with content imported by the D&D Beyond importer module. A few imported items are missing data that their text describes, and the wizard fills in the following where the text is plain:

- A language choice that asks for fewer languages than the feature says (the Tasha's Ranger's Deft Explorer, the Eberron Changeling).
- An Expertise choice that the feature's text grants but its data lacks (Deft Explorer's Canny benefit).
- A language the feature says you know but doesn't grant (the Cult of the Dragon Initiate feat).

These are narrow rules, checked against a large D&D Beyond import. They only add what a feature's own text says, and they only act when the data doesn't already do it. Imports from other tools, or older versions of the importer, may have other gaps.

Items an import leaves out of a class or background's starting equipment (for example a Quiver or a Spellbook) are listed on the Review step as a reminder, so you can add them by hand.

## What it does not do yet

- **Character creation only.** The wizard builds a level 1 character. Level-up, multiclassing and starting above level 1 are not built. Opening it on a character above level 0 shows a notice.
- **Features from level 2 onward are not part of the build.** A level 1 character gets level 1 features only. Choices that come later, such as a 2024 Ranger's Fighting Style or any subclass chosen at level 3, belong to level-up.
- **The 2024 SRD is a small subset.** The system's free 2024 content includes only four backgrounds (Acolyte, Criminal, Sage, Soldier). Anything beyond that needs content you have imported or bought.

## For developers

```bash
npm install
npm test        # unit tests (Vitest)
npm run lint
npm run package # builds dist/module.zip and dist/module.json
```

Foundry-free logic lives in pure modules under `scripts/` so it can be tested in Node. Releases: bump `version` and `download` in `module.json`, then publish a GitHub release tagged `vX.Y.Z`. The release workflow attaches `module.json` and `module.zip`.

### Advancement engine spike

As GM in a test world, run in the browser console:

```js
await game.modules.get("character-wizard").api.spike()
```

It builds a level 1 Fighter with no dialogs (the first valid option for every choice) and logs what was applied and anything that still needed input.

## License

MIT
