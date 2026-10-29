# Character Wizard

A Foundry VTT module for guided D&D 5e character creation. Both 2014 and 2024 rules are planned, with strict separation between editions. Level advancement comes later.

## Current state

The first interface supports rules and identity, species, background, class, provisional feat browsing, and draft review/export. Select an entry to read its description, then choose it for your draft. Backgrounds and feats show the entry's full description; classes show a short excerpt with a button to open the full compendium document. Duplicate entries remain separate, labelled with edition, source book when provided, and compendium name. No SRD version is guessed when metadata is missing.

Actor creation, mechanical eligibility, ability scores, subclass selection, and advancement choices are not implemented yet. Compatibility targets Foundry 14 and D&D5e 6.0.6; live module validation is pending. No verified compatibility is claimed in the manifest.

## Rules policy

- Players choose 2014 or 2024 before selecting content. All selectable content must match, including backgrounds.
- Resolve edition using an explicit GM item designation, then `system.source.rules`, then a GM pack default when an item has no recognized edition.
- Pack defaults never override a recognized item edition. Unknown content stays excluded until designated by the GM.
- Changing edition clears the draft's selections.
- Preserve distinct source entries even if their names match.
- Cross-edition options are outside the current scope.

## Dynamic content

Discover accessible Item compendiums belonging to the world, system, and active content modules. Index only metadata; load full documents when chosen. Respect current user access and GM exclusions. Failed packs are reported separately from empty results. Selection resolution rechecks access, edition, and existence.

The catalog covers species (`race` in the system), backgrounds, classes, subclasses, feats, spells, and equipment. Discovery does not establish mechanical eligibility: class prerequisites, subclass timing, spell lists, advancement grants, and equipment choices still need the D&D5e integration layer.

## Development

Use Node.js 22 or later. Foundry provides the runtime APIs and Handlebars. The development preview uses Handlebars as a development dependency.

```sh
npm ci
npm test
npm run preview
```

For local testing, copy `module.json`, `LICENSE`, and the `scripts`, `styles`, and `templates` folders into `Data/modules/character-wizard`, restart Foundry, and enable Character Wizard. Open it from the Actors directory's **Character Wizard** button or **Configure Settings → Character Wizard → Open Character Wizard**. A console API is also available:

```js
const api = game.modules.get("character-wizard").api;
api.open();
const result = await api.catalog.discover({ ruleset: "2024", type: "background" });
const draft = api.createDraft("2024");
```

GM settings currently use the Foundry settings API; a settings UI is planned. Do not publish compendium contents with this module.

## Next implementation milestones

1. GM content-source settings, duplicate preferences, and edition designation UI.
2. Expand the wizard with ability scores, subclass timing, advancement choices, and spells/equipment.
3. D&D5e advancement integration and validation, including grants that reference another edition.
4. Safe actor creation after review, with cancellation and recovery behavior.
5. Live tests for both editions, mixed packs, missing metadata, player permissions, and homebrew.
6. GitHub release packaging with `module.json`, a module ZIP, and stable manifest/download URLs.
7. Later: level up, multiclassing, and separately designed cross-edition options.

Source: [TheDarkMantle/character-wizard](https://github.com/TheDarkMantle/character-wizard). Licensed under the [MIT License](LICENSE).

The local manifest intentionally omits installation and update URLs until a downloadable GitHub release exists.

## References

- [Foundry module development](https://foundryvtt.com/article/module-development/)
- [D&D5e advancement](https://github.com/foundryvtt/dnd5e/wiki/Advancement)
- [D&D5e 6.0.6 source edition field](https://github.com/foundryvtt/dnd5e/blob/release-6.0.6/module/data/shared/source-field.mjs)
