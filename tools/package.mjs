import { readFile, mkdir, rm, copyFile, cp } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(await readFile(resolve(root, "module.json"), "utf8"));
const stage = resolve(root, "dist", manifest.id);
await rm(stage, { recursive: true, force: true });
await mkdir(stage, { recursive: true });
await copyFile(resolve(root, "module.json"), resolve(stage, "module.json"));
await cp(resolve(root, "scripts"), resolve(stage, "scripts"), { recursive: true });
await copyFile(resolve(root, "README.md"), resolve(stage, "README.md"));
await copyFile(resolve(root, "LICENSE"), resolve(stage, "LICENSE"));
const zip = resolve(root, "dist", `${manifest.id}-${manifest.version}.zip`);
await rm(zip, { force: true });
execFileSync("zip", ["-qr", zip, manifest.id], { cwd: resolve(root, "dist") });
console.log(zip);
