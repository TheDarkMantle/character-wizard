import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, dirname, extname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const page = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Character Wizard — development preview</title>
<link rel="stylesheet" href="/modules/character-wizard/styles/wizard.css"><style>
*{box-sizing:border-box}body{margin:0;background:#d7ddd8;font-family:Arial,sans-serif;padding:28px;color:#263b40}
.preview-label{max-width:1040px;margin:0 auto 12px;font-size:12px;display:flex;justify-content:space-between}
#preview{max-width:1040px;margin:auto;height:780px;box-shadow:0 18px 70px #1c353b33;border-radius:8px;overflow:hidden}
.window-content{height:100%}.preview-document{position:fixed;inset:15% 18%;overflow:auto;background:#fffdf8;box-shadow:0 0 0 100vmax #0006;padding:30px;z-index:20}
.preview-document button{float:right}button{cursor:pointer}
@media(max-width:800px){body{padding:8px}#preview{height:1000px}}
</style></head><body><div class="preview-label"><strong>CHARACTER WIZARD</strong><span>Development preview · sample content</span></div><div id="preview" class="character-wizard"><div class="window-content"></div></div>
<script src="/handlebars.js"></script><script type="module" src="/preview-foundry.js"></script></body></html>`;

createServer(async (req, res) => {
  const url = new URL(req.url, "http://127.0.0.1");
  let path;
  if (url.pathname === "/") { res.setHeader("Content-Type", "text/html"); return res.end(page); }
  if (url.pathname === "/handlebars.js") path = resolve(root, "node_modules/handlebars/dist/handlebars.js");
  else if (url.pathname === "/preview-foundry.js") path = resolve(root, "tools/preview-foundry.js");
  else if (/^\/modules\/character-wizard\/(scripts|templates|styles)\/[\w.-]+$/.test(url.pathname)) {
    path = resolve(root, url.pathname.replace("/modules/character-wizard/", ""));
  } else { res.writeHead(404); return res.end("Not found"); }
  try {
    const data = await readFile(path);
    res.setHeader("Content-Type", ({ ".js": "text/javascript", ".css": "text/css", ".hbs": "text/plain" })[extname(path)] || "text/plain");
    res.end(data);
  } catch { res.writeHead(404); res.end("Not found"); }
}).listen(4173, "127.0.0.1", () => console.log("Character Wizard preview: http://127.0.0.1:4173"));
