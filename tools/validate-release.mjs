import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const manifest = JSON.parse(await readFile(new URL("../module.json", import.meta.url), "utf8"));
const pkg = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
const tag = process.argv[2];
assert.match(manifest.version, /^\d+\.\d+\.\d+$/);
assert.equal(tag, `v${manifest.version}`, "Release tag must match module version");
assert.equal(pkg.version, manifest.version, "Package and module versions must match");
assert.equal(manifest.manifest, `${manifest.url}/releases/latest/download/module.json`);
assert.equal(manifest.download, `${manifest.url}/releases/download/${tag}/${manifest.id}-${manifest.version}.zip`);
console.log(`Release metadata validated for ${tag}`);
