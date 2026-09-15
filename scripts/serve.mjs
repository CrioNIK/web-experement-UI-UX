import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
const root = path.resolve('dist');
const port = Number(process.env.PORT ?? 4173);
const mime = { '.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8' };
http.createServer(async (req,res) => {
  try {
    const decoded = decodeURIComponent(new URL(req.url ?? '/', 'http://local').pathname);
    let file = path.resolve(root, '.' + decoded);
    if (file !== root && !file.startsWith(root + path.sep)) { res.writeHead(403); res.end(); return; }
    if ((await stat(file)).isDirectory()) file = path.join(file,'index.html');
    const content = await readFile(file);
    res.writeHead(200, { 'Content-Type':mime[path.extname(file)] ?? 'application/octet-stream','X-Content-Type-Options':'nosniff','Cache-Control':'no-cache' }); res.end(content);
  } catch { res.writeHead(404); res.end('Not found'); }
}).listen(port, '0.0.0.0', () => console.log(`HORIZON: http://localhost:${port}`));
