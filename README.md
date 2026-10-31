# Character Wizard

A guided character builder for the **D&D 5e** system on **Foundry VTT v14**.

- Pulls classes, subclasses, species, backgrounds and feats from **every Item compendium** in your world — SRD, official books, third-party and homebrew.
- Follows your world's **2014 or 2024 rules** setting (Game Settings → D&D 5e → Rules Version).
- Works through the system's own **advancement** data, so features, proficiencies, fighting styles and other choices come straight from the content you own.

> Status: early development (0.2.x). Browsing and previewing content works; the drag-and-drop features board and character creation are next.

## Requirements

- Foundry VTT v14
- D&D 5e system 6.0 or newer

## Install

In Foundry: **Add-on Modules → Install Module**, paste this manifest URL:

```
https://github.com/TheDarkMantle/character-wizard/releases/latest/download/module.json
```

## Opening the wizard

- **Actors sidebar:** the *Character Wizard* button at the top.
- **Character sheet:** a level 0 character shows a *Build with the Character Wizard* banner. The sheet's header menu also has a *Character Wizard* entry.

## GM settings

**Game Settings → Character Wizard → Configure content**

- **Sources:** turn compendiums on or off and set their priority. When the same option exists in more than one compendium (e.g. the SRD Fighter and the Player's Handbook Fighter), the higher one wins.
- **Species / Subclasses:** uncheck anything players shouldn't be able to pick.

Other settings:
- **Content without a rules version:** show or hide homebrew that isn't marked 2014 or 2024.
- **Players can use the wizard:** turn off to make it GM-only.

## For developers

```bash
npm install
npm test        # unit tests (Vitest)
npm run lint
npm run package # builds dist/module.zip and dist/module.json
```

Releases: bump `version` and `download` in `module.json`, then publish a GitHub release tagged `vX.Y.Z`. The release workflow attaches `module.json` and `module.zip`.

### Advancement engine spike

As GM in a test world, run in the browser console:

```js
await game.modules.get("character-wizard").api.spike()
```

It builds a level 1 Fighter with no dialogs (first valid option for every choice) and logs what was applied and anything that still needed input. Compare the result against a Fighter built through the normal sheet.

## License

MIT
