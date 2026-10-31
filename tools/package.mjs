/**
 * Build dist/module.zip and dist/module.json for a GitHub release.
 * Usage: node tools/package.mjs [tag]   (tag like v0.2.0 must match module.json version)
 */
import { createWriteStream, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import archiver from "archiver";

const manifest = JSON.parse(readFileSync("module.json", "utf8"));
const tag = process.argv[2];
if ( tag && tag !== `v${manifest.version}` ) {
  console.error(`Tag ${tag} does not match module.json version ${manifest.version}`);
  process.exit(1);
}
const expected = `https://github.com/TheDarkMantle/character-wizard/releases/download/v${manifest.version}/module.zip`;
if ( manifest.download !== expected ) {
  console.error(`module.json "download" should be ${expected}`);
  process.exit(1);
}

const INCLUDE = ["module.json", "README.md", "CHANGELOG.md", "LICENSE"];
const DIRS = ["scripts", "templates", "styles", "lang"];

mkdirSync("dist", { recursive: true });
writeFileSync("dist/module.json", JSON.stringify(manifest, null, 2));
const output = createWriteStream("dist/module.zip");
const zip = archiver("zip", { zlib: { level: 9 } });
zip.pipe(output);
for ( const file of INCLUDE ) zip.file(file, { name: file });
for ( const dir of DIRS ) zip.directory(dir, dir);
await zip.finalize();
output.on("close", () => console.log(`dist/module.zip (${zip.pointer()} bytes)`));
