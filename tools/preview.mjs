import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, dirname, extname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const foundryURL = process.env.FOUNDRY_PREVIEW_URL;
const stylesheet = foundryURL ? new URL("css/foundry2.css", foundryURL.endsWith("/") ? foundryURL : `${foundryURL}/`).href : null;
const page = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Character Wizard — development preview</title>
${stylesheet ? `<link rel="stylesheet" href="${stylesheet}">` : ""}
<link rel="stylesheet" href="/modules/character-wizard/styles/wizard.css"><style>
body{margin:0;padding:20px;overflow:auto}
.preview-label{max-width:800px;margin:0 auto 12px;display:flex;align-items:center;justify-content:space-between;gap:12px}
#preview{position:relative;inset:auto;width:min(800px,100%);height:680px;margin:auto;display:flex;flex-direction:column}
#preview>.window-content{min-height:0;flex:1}
.preview-document{position:fixed;inset:15% 18%;overflow:auto;padding:20px;z-index:200}
.preview-document button{float:right}
</style></head><body class="theme-dark"><div class="preview-label"><span>Development preview · sample content${stylesheet ? " · Foundry core stylesheet" : " · Set FOUNDRY_PREVIEW_URL to load your Foundry stylesheet"}</span><label>Theme <select id="preview-theme"><option value="dark">Dark</option><option value="light">Light</option></select></label></div>
<div id="preview" class="application character-wizard"><header class="window-header"><h1 class="window-title">Character Wizard</h1></header><div class="window-content"></div></div>
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
