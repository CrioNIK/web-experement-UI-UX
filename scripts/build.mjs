import { execFileSync } from 'node:child_process';
import { mkdir, cp, readFile, writeFile, readdir, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
await rm('dist', { recursive: true, force: true });
await mkdir('dist/assets', { recursive: true });
execFileSync(process.platform === 'win32' ? 'tsc.cmd' : 'tsc', ['--project', 'tsconfig.json'], { stdio: 'inherit', shell: process.platform === 'win32' });
await cp('public', 'dist', { recursive: true });
const moduleNames = ['model','storage','evidence','ui','composer','modules','review','lab','app'];
// This tiny application has no external runtime dependencies. Concatenate its known ESM
// graph only for the portable artifact. Production sources remain independent ESM modules.
const code = (await Promise.all(moduleNames.map(n => readFile(`dist/assets/${n}.js`, 'utf8')))).map(text => text.replace(/^import\s+.*?;\s*$/gm, '').replace(/^export\s+/gm, '')).join('\n');
let html = await readFile('dist/index.html', 'utf8');
const css = await readFile('dist/style.css', 'utf8');
html = html.replace('<html lang="ru">','<html lang="ru" data-standalone="true">').replace('<link rel="stylesheet" href="./style.css">', `<style>${css}</style>`).replace('<script type="module" src="./assets/app.js"></script>', `<script type="module">const esc = (...args) => escapeHTML(...args);\n${code.replace(/<\/script/gi, '<\\/script')}</script>`);
await writeFile('dist/horizon-standalone.html', html);
const assets = ['index.html','style.css',...(await readdir('dist/assets')).map(n=>`assets/${n}`)];
const hash = createHash('sha256').update(css).update(code).digest('hex').slice(0, 12);
await writeFile('dist/sw.js', `const CACHE='horizon-${hash}';\nconst ASSETS=${JSON.stringify(assets)};\nself.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS))));\nself.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('horizon-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));\nself.addEventListener('fetch',e=>{if(e.request.method!=='GET'||new URL(e.request.url).origin!==self.location.origin)return; e.respondWith(fetch(e.request).catch(()=>caches.match(e.request).then(r=>r||(e.request.mode==='navigate'?caches.match('./index.html'):Response.error()))));});\n`);
console.log(`Built ${assets.length} cached resources and standalone HTML. No external runtime requests.`);
