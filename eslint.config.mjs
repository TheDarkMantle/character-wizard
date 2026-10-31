import js from "@eslint/js";
import globals from "globals";

const foundryGlobals = Object.fromEntries([
  "foundry", "game", "ui", "Hooks", "CONFIG", "Actor", "Item", "fromUuid", "fromUuidSync", "dnd5e"
].map(name => [name, "readonly"]));

export default [
  js.configs.recommended,
  { rules: { "no-unused-vars": ["error", { args: "none" }] } },
  {
    files: ["scripts/**/*.mjs"],
    languageOptions: { ecmaVersion: 2024, sourceType: "module", globals: { ...globals.browser, ...foundryGlobals } }
  },
  {
    files: ["test/**/*.mjs", "tools/**/*.mjs"],
    languageOptions: { ecmaVersion: 2024, sourceType: "module", globals: globals.node }
  }
];
